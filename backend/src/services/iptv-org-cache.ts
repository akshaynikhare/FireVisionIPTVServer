import axios from 'axios';
import { IptvOrgCacheMeta, IptvOrgChannel } from '../models/IptvOrgCache';
import { probeStream } from './stream-prober';

const IPTV_ORG_API_BASE = 'https://iptv-org.github.io/api';
const CACHE_TTL = parseInt(process.env.IPTV_ORG_CACHE_TTL_MS || '3600000', 10); // 1 hour
const LIVENESS_CONCURRENCY = parseInt(process.env.IPTV_ORG_LIVENESS_CONCURRENCY || '20', 10);

// 2-letter → 3-letter ISO 639-3 mapping
const lang2to3Map: Record<string, string> = {
  en: 'eng',
  hi: 'hin',
  es: 'spa',
  fr: 'fra',
  de: 'deu',
  it: 'ita',
  pt: 'por',
  ru: 'rus',
  ja: 'jpn',
  ko: 'kor',
  zh: 'zho',
  ar: 'ara',
  tr: 'tur',
  nl: 'nld',
  pl: 'pol',
  sv: 'swe',
  no: 'nor',
  da: 'dan',
  fi: 'fin',
  cs: 'ces',
  el: 'ell',
  he: 'heb',
  id: 'ind',
  ms: 'msa',
  th: 'tha',
  vi: 'vie',
  uk: 'ukr',
  ro: 'ron',
  hu: 'hun',
  sk: 'slk',
  bg: 'bul',
  hr: 'hrv',
  sr: 'srp',
  sl: 'slv',
  et: 'est',
  lv: 'lav',
  lt: 'lit',
  ur: 'urd',
  bn: 'ben',
  ta: 'tam',
  te: 'tel',
  mr: 'mar',
  ml: 'mal',
  kn: 'kan',
  gu: 'guj',
  pa: 'pan',
  tl: 'tgl',
  fa: 'fas',
  ka: 'kat',
  hy: 'hye',
};

export interface EnrichedChannelFilters {
  country?: string;
  language?: string;
  languages?: string[];
  category?: string;
  status?: 'alive' | 'dead' | 'unknown';
  search?: string;
  limit?: number;
  skip?: number;
}

interface RawSources {
  channels: any[];
  streams: any[];
  languages: any[];
  guides: any[];
  feeds: any[];
  logos: any[];
}

class IptvOrgCacheService {
  private refreshPromise: Promise<void> | null = null;
  private livenessPromise: Promise<void> | null = null;

  // ─── Metadata ───────────────────────────────────────────

  async getCacheMeta() {
    return IptvOrgCacheMeta.findOne({ cacheKey: 'iptv-org-main' }).lean();
  }

  async isCacheStale(): Promise<boolean> {
    const meta = await IptvOrgCacheMeta.findOne({ cacheKey: 'iptv-org-main' });
    if (!meta) return true;
    return Date.now() - meta.lastRefreshedAt.getTime() > CACHE_TTL;
  }

  private async isCacheEmpty(): Promise<boolean> {
    const count = await IptvOrgChannel.countDocuments();
    return count === 0;
  }

  // ─── Get Enriched Channels (main query) ─────────────────

  async getEnrichedChannels(filters: EnrichedChannelFilters = {}) {
    const empty = await this.isCacheEmpty();
    const stale = await this.isCacheStale();

    // First run — block until populated
    if (empty) {
      await this.refreshCache();
    } else if (stale) {
      // Stale-while-revalidate: serve existing, refresh in background
      this.refreshCache().catch((err) =>
        console.error('Background cache refresh failed:', err.message),
      );
    }

    // Build query
    const query: Record<string, any> = {};

    if (filters.country) {
      query.country = filters.country.toUpperCase();
    }

    if (filters.languages?.length) {
      query.languageCodes = {
        $in: filters.languages.map((l) => l.toLowerCase()),
      };
    } else if (filters.language) {
      query.languageCodes = filters.language.toLowerCase();
    }

    if (filters.category) {
      const cats = filters.category
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);
      if (cats.length === 1) {
        query.categories = { $regex: new RegExp(cats[0], 'i') };
      } else if (cats.length > 1) {
        query.categories = { $regex: new RegExp(cats.join('|'), 'i') };
      }
    }

    if (filters.status) {
      query['liveness.status'] = filters.status;
    }

    if (filters.search) {
      query.$text = { $search: filters.search };
    }

    const skip = filters.skip || 0;
    const limit = filters.limit || 0; // 0 = no limit

    const [channels, total] = await Promise.all([
      IptvOrgChannel.find(query).sort({ channelName: 1 }).skip(skip).limit(limit).lean(),
      IptvOrgChannel.countDocuments(query),
    ]);

    return {
      channels,
      total,
      stale,
      fromCache: !empty,
    };
  }

  // ─── Refresh Cache (fetch + enrich + upsert) ───────────

  async refreshCache(): Promise<{ enrichedCount: number; durationMs: number }> {
    // Dedup concurrent refresh calls.
    // NOTE: The check and assignment below are synchronous (no await between them),
    // so no concurrent call can slip through in single-threaded Node.js.
    if (this.refreshPromise) {
      await this.refreshPromise;
      const meta = await this.getCacheMeta();
      return {
        enrichedCount: meta?.enrichedCount || 0,
        durationMs: meta?.refreshDurationMs || 0,
      };
    }

    let resolve!: () => void;
    let reject!: (err: Error) => void;
    this.refreshPromise = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    const startTime = Date.now();

    try {
      // Mark in-progress
      await IptvOrgCacheMeta.findOneAndUpdate(
        { cacheKey: 'iptv-org-main' },
        { $set: { refreshInProgress: true } },
        { upsert: true },
      );

      // 1. Fetch all sources
      const sources = await this.fetchAllSources();

      // 2. Enrich
      const enriched = this.enrichStreams(sources);

      // 3. Upsert via bulkWrite (overlay — never delete)
      if (enriched.length > 0) {
        const BATCH_SIZE = 500;
        for (let i = 0; i < enriched.length; i += BATCH_SIZE) {
          const batch = enriched.slice(i, i + BATCH_SIZE);
          const ops = batch.map((doc) => ({
            updateOne: {
              filter: { channelId: doc.channelId, streamUrl: doc.streamUrl },
              update: {
                $set: {
                  channelName: doc.channelName,
                  streamQuality: doc.streamQuality,
                  streamUserAgent: doc.streamUserAgent,
                  streamReferrer: doc.streamReferrer,
                  tvgLogo: doc.tvgLogo,
                  country: doc.country,
                  categories: doc.categories,
                  languageCodes: doc.languageCodes,
                  languageNames: doc.languageNames,
                  channelNetwork: doc.channelNetwork,
                  channelWebsite: doc.channelWebsite,
                  channelIsNsfw: doc.channelIsNsfw,
                  channelGroup: doc.channelGroup,
                  // NOTE: liveness is NOT touched here
                },
                $setOnInsert: {
                  liveness: {
                    status: 'unknown' as const,
                    lastCheckedAt: null,
                    responseTimeMs: null,
                    statusCode: null,
                    error: null,
                    manifestValid: null,
                    segmentReachable: null,
                    manifestInfo: null,
                  },
                },
              },
              upsert: true,
            },
          }));

          await IptvOrgChannel.bulkWrite(ops, { ordered: false });
        }
      }

      const durationMs = Date.now() - startTime;

      // 4. Update meta
      await IptvOrgCacheMeta.findOneAndUpdate(
        { cacheKey: 'iptv-org-main' },
        {
          $set: {
            lastRefreshedAt: new Date(),
            refreshInProgress: false,
            enrichedCount: enriched.length,
            refreshDurationMs: durationMs,
            sourceCounts: {
              channels: sources.channels.length,
              streams: sources.streams.length,
              languages: sources.languages.length,
              guides: sources.guides.length,
              feeds: sources.feeds.length,
              logos: sources.logos.length,
            },
          },
        },
        { upsert: true },
      );

      // 5. Update liveness stats
      await this.updateLivenessStats();

      console.log(
        `[iptv-org-cache] Refresh complete: ${enriched.length} channels upserted in ${durationMs}ms`,
      );

      resolve();
      return { enrichedCount: enriched.length, durationMs };
    } catch (err: any) {
      // Reset in-progress flag
      await IptvOrgCacheMeta.findOneAndUpdate(
        { cacheKey: 'iptv-org-main' },
        { $set: { refreshInProgress: false } },
      ).catch(() => {});

      console.error('[iptv-org-cache] Refresh failed:', err.message);
      reject(err);
      throw err;
    } finally {
      this.refreshPromise = null;
    }
  }

  // ─── Clear Cache (explicit admin action only) ──────────

  async clearCache(): Promise<void> {
    await Promise.all([IptvOrgChannel.deleteMany({}), IptvOrgCacheMeta.deleteMany({})]);
    console.log('[iptv-org-cache] Cache cleared');
  }

  // ─── Startup ────────────────────────────────────────────

  async initializeOnStartup(): Promise<void> {
    const empty = await this.isCacheEmpty();
    if (empty) {
      console.log('[iptv-org-cache] DB empty, fetching iptv-org data...');
      await this.refreshCache();
    } else {
      const stale = await this.isCacheStale();
      if (stale) {
        console.log('[iptv-org-cache] Cache stale, refreshing in background...');
        this.refreshCache().catch((err) =>
          console.error('[iptv-org-cache] Background refresh failed:', err.message),
        );
      } else {
        const meta = await this.getCacheMeta();
        console.log(
          `[iptv-org-cache] Cache OK: ${meta?.enrichedCount || 0} channels, last refreshed ${meta?.lastRefreshedAt?.toISOString() || 'never'}`,
        );
      }
    }
  }

  // ─── Liveness: Single Stream ────────────────────────────

  async checkSingleStream(channelId: string, streamUrl: string) {
    const doc = await IptvOrgChannel.findOne({ channelId, streamUrl });
    if (!doc) return null;

    const result = await probeStream(streamUrl, {
      userAgent: doc.streamUserAgent || undefined,
      referrer: doc.streamReferrer || undefined,
    });

    await IptvOrgChannel.updateOne(
      { channelId, streamUrl },
      {
        $set: {
          'liveness.status': result.status,
          'liveness.lastCheckedAt': new Date(),
          'liveness.responseTimeMs': result.responseTimeMs,
          'liveness.statusCode': result.statusCode,
          'liveness.error': result.error,
          'liveness.manifestValid': result.manifestValid,
          'liveness.segmentReachable': result.segmentReachable,
          'liveness.manifestInfo': result.manifestInfo,
        },
      },
    );

    await this.updateLivenessStats();

    return {
      channelId,
      streamUrl,
      ...result,
    };
  }

  // ─── Liveness: Batch Check ──────────────────────────────

  async runBatchLivenessCheck(): Promise<{
    checked: number;
    alive: number;
    dead: number;
  }> {
    // Dedup concurrent batch checks
    if (this.livenessPromise) {
      await this.livenessPromise;
      const meta = await this.getCacheMeta();
      return {
        checked: (meta?.livenessStats?.alive || 0) + (meta?.livenessStats?.dead || 0),
        alive: meta?.livenessStats?.alive || 0,
        dead: meta?.livenessStats?.dead || 0,
      };
    }

    let resolve!: () => void;
    this.livenessPromise = new Promise<void>((res) => {
      resolve = res;
    });

    try {
      await IptvOrgCacheMeta.findOneAndUpdate(
        { cacheKey: 'iptv-org-main' },
        { $set: { livenessCheckInProgress: true } },
        { upsert: true },
      );

      const totalDocs = await IptvOrgChannel.countDocuments();
      console.log(
        `[iptv-org-cache] Starting batch liveness check for ${totalDocs} streams (concurrency: ${LIVENESS_CONCURRENCY})`,
      );

      let checked = 0;
      let alive = 0;
      let dead = 0;
      const PAGE_SIZE = 200;

      // Cursor-based pagination (avoids slow skip() on large collections)
      let lastId: unknown = null;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const query: Record<string, unknown> = {};
        if (lastId) query._id = { $gt: lastId };
        const batch = await IptvOrgChannel.find(query).sort({ _id: 1 }).limit(PAGE_SIZE).lean();

        if (batch.length === 0) break;
        lastId = batch[batch.length - 1]._id;

        // Process in parallel with concurrency limit, collecting results for bulk update
        const probeResults = await this.parallelMap(
          batch,
          async (doc) => {
            try {
              const result = await probeStream(doc.streamUrl, {
                userAgent: doc.streamUserAgent || undefined,
                referrer: doc.streamReferrer || undefined,
                timeout: 10000,
              });
              return { _id: doc._id, result, status: result.status as 'alive' | 'dead' };
            } catch {
              // Outer catch: probe itself failed (not an HTTP error from the stream).
              // Mark as unknown rather than dead to avoid false negatives from transient errors.
              return { _id: doc._id, result: null, status: 'unknown' as const };
            }
          },
          LIVENESS_CONCURRENCY,
        );

        // Bulk write all updates at once instead of individual updateOne calls
        const bulkOps = probeResults
          .filter((r) => r.result)
          .map((r) => ({
            updateOne: {
              filter: { _id: r._id },
              update: {
                $set: {
                  'liveness.status': r.result!.status,
                  'liveness.lastCheckedAt': new Date(),
                  'liveness.responseTimeMs': r.result!.responseTimeMs,
                  'liveness.statusCode': r.result!.statusCode,
                  'liveness.error': r.result!.error,
                  'liveness.manifestValid': r.result!.manifestValid,
                  'liveness.segmentReachable': r.result!.segmentReachable,
                  'liveness.manifestInfo': r.result!.manifestInfo,
                },
              },
            },
          }));
        if (bulkOps.length > 0) {
          await IptvOrgChannel.bulkWrite(bulkOps, { ordered: false });
        }

        for (const r of probeResults) {
          checked++;
          if (r.status === 'alive') alive++;
          else if (r.status === 'dead') dead++;
          // 'unknown' is neither alive nor dead -- skipped from counts
        }

        // Periodically update stats
        if (checked % 1000 === 0 || batch.length < PAGE_SIZE) {
          await this.updateLivenessStats();
          console.log(
            `[iptv-org-cache] Liveness progress: ${checked}/${totalDocs} (${alive} alive, ${dead} dead)`,
          );
        }
      }

      await IptvOrgCacheMeta.findOneAndUpdate(
        { cacheKey: 'iptv-org-main' },
        {
          $set: {
            livenessCheckInProgress: false,
            lastLivenessCheckAt: new Date(),
          },
        },
      );

      await this.updateLivenessStats();

      console.log(
        `[iptv-org-cache] Batch liveness complete: ${checked} checked, ${alive} alive, ${dead} dead`,
      );

      resolve();
      return { checked, alive, dead };
    } catch (err: any) {
      await IptvOrgCacheMeta.findOneAndUpdate(
        { cacheKey: 'iptv-org-main' },
        { $set: { livenessCheckInProgress: false } },
      ).catch(() => {});

      console.error('[iptv-org-cache] Batch liveness failed:', err.message);
      resolve();
      throw err;
    } finally {
      this.livenessPromise = null;
    }
  }

  // ─── Private: Update liveness stats in meta ─────────────

  private async updateLivenessStats() {
    const [alive, dead, unknown] = await Promise.all([
      IptvOrgChannel.countDocuments({ 'liveness.status': 'alive' }),
      IptvOrgChannel.countDocuments({ 'liveness.status': 'dead' }),
      IptvOrgChannel.countDocuments({ 'liveness.status': 'unknown' }),
    ]);

    await IptvOrgCacheMeta.findOneAndUpdate(
      { cacheKey: 'iptv-org-main' },
      { $set: { livenessStats: { alive, dead, unknown } } },
    );
  }

  // ─── Private: Fetch all iptv-org API sources ────────────

  private async fetchAllSources(): Promise<RawSources> {
    const fetchJson = async (endpoint: string, timeout = 30000) => {
      const res = await axios.get(`${IPTV_ORG_API_BASE}/${endpoint}`, {
        timeout,
        maxContentLength: 100 * 1024 * 1024,
        maxBodyLength: 100 * 1024 * 1024,
      });
      return res.data;
    };

    const [channels, streams, languages, guides, feeds, logos] = await Promise.all([
      fetchJson('channels.json'),
      fetchJson('streams.json'),
      fetchJson('languages.json'),
      fetchJson('guides.json', 60000),
      fetchJson('feeds.json'),
      fetchJson('logos.json'),
    ]);

    console.log(
      `[iptv-org-cache] Fetched: ${channels.length} channels, ${streams.length} streams, ${languages.length} languages, ${guides.length} guides, ${feeds.length} feeds, ${logos.length} logos`,
    );

    return { channels, streams, languages, guides, feeds, logos };
  }

  // ─── Private: Enrich streams with metadata ──────────────

  private enrichStreams(sources: RawSources) {
    const { channels, streams, languages, guides, feeds, logos } = sources;

    // Build lookup maps
    const channelsMap = new Map<string, any>();
    channels.forEach((ch: any) => channelsMap.set(ch.id, ch));

    const languagesMap = new Map<string, any>();
    languages.forEach((lang: any) => languagesMap.set(lang.code, lang));

    const logosMap = new Map<string, any>();
    logos.forEach((logo: any) => {
      if (logo.channel && logo.url) {
        const existing = logosMap.get(logo.channel);
        if (!existing || (!logo.feed && existing.feed) || logo.width > (existing.width || 0)) {
          logosMap.set(logo.channel, logo);
        }
      }
    });

    // Channel → languages from guides (2-letter codes)
    const channelToLanguagesMap = new Map<string, Set<string>>();
    guides.forEach((guide: any) => {
      if (guide.channel && guide.lang) {
        if (!channelToLanguagesMap.has(guide.channel)) {
          channelToLanguagesMap.set(guide.channel, new Set());
        }
        channelToLanguagesMap.get(guide.channel)!.add(guide.lang);
      }
    });

    // Channel → languages from feeds (3-letter codes)
    const feedsLanguagesMap = new Map<string, Set<string>>();
    feeds.forEach((feed: any) => {
      if (feed.channel && feed.languages && Array.isArray(feed.languages)) {
        if (!feedsLanguagesMap.has(feed.channel)) {
          feedsLanguagesMap.set(feed.channel, new Set());
        }
        feed.languages.forEach((lang: string) => {
          feedsLanguagesMap.get(feed.channel)!.add(lang);
        });
      }
    });

    // Enrich each stream
    return streams
      .filter((stream: any) => stream.channel)
      .map((stream: any) => {
        const channelMeta = channelsMap.get(stream.channel) || {};

        // Resolve language codes (priority: feeds > guides > channel metadata)
        let languageCodes: string[] = [];

        if (feedsLanguagesMap.has(stream.channel)) {
          languageCodes = Array.from(feedsLanguagesMap.get(stream.channel)!);
        } else if (channelToLanguagesMap.has(stream.channel)) {
          const guideLangs = Array.from(channelToLanguagesMap.get(stream.channel)!);
          languageCodes = guideLangs.map((lang2) => lang2to3Map[lang2] || lang2);
        } else if (channelMeta.languages) {
          languageCodes = channelMeta.languages;
        }

        const languageNames = languageCodes.map((code: string) => {
          const lang = languagesMap.get(code);
          return lang ? lang.name : code;
        });

        const logoEntry = logosMap.get(stream.channel);
        const logoUrl = logoEntry?.url || channelMeta.logo || null;

        return {
          channelId: stream.channel,
          channelName: channelMeta.name || stream.title || 'Unknown',
          streamUrl: stream.url,
          streamQuality: stream.quality || null,
          streamUserAgent: stream.user_agent || null,
          streamReferrer: stream.referrer || null,
          tvgLogo: logoUrl,
          country: channelMeta.country || null,
          categories: channelMeta.categories || [],
          languageCodes,
          languageNames,
          channelNetwork: channelMeta.network || null,
          channelWebsite: channelMeta.website || null,
          channelIsNsfw: channelMeta.is_nsfw || false,
          channelGroup: channelMeta.categories?.[0] || 'Uncategorized',
        };
      });
  }

  // ─── Private: Parallel map with concurrency limit ───────

  private async parallelMap<T, R>(
    items: T[],
    fn: (item: T) => Promise<R>,
    concurrency: number,
  ): Promise<R[]> {
    const results: R[] = [];
    let index = 0;

    async function worker() {
      while (index < items.length) {
        const i = index++;
        results[i] = await fn(items[i]);
      }
    }

    const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
    await Promise.all(workers);
    return results;
  }
}

export const iptvOrgCacheService = new IptvOrgCacheService();

module.exports = { iptvOrgCacheService, IptvOrgCacheService };
