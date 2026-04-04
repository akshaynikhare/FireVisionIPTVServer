import axios from 'axios';
import { ExternalSourceCacheMeta, ExternalSourceChannel } from '../models/ExternalSourceCache';
import { SeedChannel } from '../models/SeedChannel';
import { probeStream } from './stream-prober';
import { ytDlpResolver } from './yt-dlp-resolver';
import type { ExternalSourceType } from '@firevision/shared';

const CACHE_TTL = parseInt(process.env.EXT_SOURCE_CACHE_TTL_MS || '3600000', 10); // 1 hour
const LIVENESS_CONCURRENCY = parseInt(process.env.EXT_SOURCE_LIVENESS_CONCURRENCY || '20', 10);
// Pluto TV JWT session management — keyed by country to avoid cross-region leaks
const plutoSessionCache = new Map<string, { token: string; timestamp: number }>();
const PLUTO_SESSION_TTL = 1800000; // 30 min

function buildCacheKey(source: string, region: string): string {
  return `${source}:${region}`;
}

class ExternalSourceCacheService {
  private refreshPromises = new Map<string, Promise<void>>();
  private livenessPromises = new Map<string, Promise<void>>();

  // ─── Pluto TV JWT ────────────────────────────────────────

  async getPlutoSessionToken(country: string): Promise<string> {
    const key = (country || 'US').toUpperCase();
    const cached = plutoSessionCache.get(key);
    if (cached && Date.now() - cached.timestamp < PLUTO_SESSION_TTL) {
      return cached.token;
    }
    const bootUrl = `https://boot.pluto.tv/v4/start?appName=web&appVersion=9&deviceMake=Chrome&deviceModel=web&deviceType=web&deviceVersion=131&clientModelNumber=1.0.0&serverSideAds=false&clientID=1&country=${encodeURIComponent(key)}`;
    const res = await axios.get(bootUrl, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const token = res.data.sessionToken;
    plutoSessionCache.set(key, { token, timestamp: Date.now() });
    return token;
  }

  buildPlutoStreamUrl(channelId: string, jwt: string): string {
    return `https://service-stitcher-ipv4.clusters.pluto.tv/v2/stitch/hls/channel/${channelId}/master.m3u8?appName=web&appVersion=9&deviceDNT=false&deviceId=1&deviceMake=Chrome&deviceModel=web&deviceType=web&deviceVersion=131&sid=${channelId}&terminate=false&serverSideAds=false&jwt=${jwt}`;
  }

  // ─── Metadata ───────────────────────────────────────────

  async getCacheMeta(source: ExternalSourceType, region: string) {
    return ExternalSourceCacheMeta.findOne({
      cacheKey: buildCacheKey(source, region),
    }).lean();
  }

  async isCacheStale(source: ExternalSourceType, region: string): Promise<boolean> {
    const meta = await ExternalSourceCacheMeta.findOne({
      cacheKey: buildCacheKey(source, region),
    });
    if (!meta || !meta.lastRefreshedAt) return true;
    return Date.now() - meta.lastRefreshedAt.getTime() > CACHE_TTL;
  }

  private async isCacheEmpty(source: ExternalSourceType, region: string): Promise<boolean> {
    const count = await ExternalSourceChannel.countDocuments({
      source,
      region,
    });
    return count === 0;
  }

  // ─── Get Channels (main query) ──────────────────────────

  async getChannels(source: ExternalSourceType, region: string, filters: { status?: string } = {}) {
    const empty = await this.isCacheEmpty(source, region);
    const stale = await this.isCacheStale(source, region);

    if (empty) {
      await this.refreshRegion(source, region);
    } else if (stale) {
      this.refreshRegion(source, region).catch((err) =>
        console.error(
          `[ext-cache] Background refresh failed for ${source}:${region}:`,
          err.message,
        ),
      );
    }

    const query: Record<string, any> = { source, region };
    const allowedStatuses = ['online', 'offline', 'error', 'unknown'];
    if (
      filters.status &&
      typeof filters.status === 'string' &&
      allowedStatuses.includes(filters.status)
    ) {
      query['liveness.status'] = filters.status;
    }

    const channels = await ExternalSourceChannel.find(query).sort({ channelName: 1 }).lean();

    // For Pluto TV, inject live stream URLs with fresh JWT
    if (source === 'pluto-tv') {
      let jwt = '';
      try {
        jwt = await this.getPlutoSessionToken(region);
      } catch (e: any) {
        console.warn('[ext-cache] Failed to get Pluto session token:', e.message);
      }
      return channels.map((ch) => ({
        ...ch,
        streamUrl: jwt ? this.buildPlutoStreamUrl(ch.channelId, jwt) : '',
      }));
    }

    return channels;
  }

  // ─── Refresh Region (fetch + upsert) ────────────────────

  async refreshRegion(
    source: ExternalSourceType,
    region: string,
  ): Promise<{ channelCount: number; durationMs: number }> {
    const key = buildCacheKey(source, region);

    // Dedup concurrent refreshes.
    // NOTE: The check and assignment below are synchronous (no await between them),
    // so no concurrent call can slip through in single-threaded Node.js.
    if (this.refreshPromises.has(key)) {
      await this.refreshPromises.get(key);
      const meta = await this.getCacheMeta(source, region);
      return {
        channelCount: meta?.channelCount || 0,
        durationMs: meta?.refreshDurationMs || 0,
      };
    }

    let resolve!: () => void;
    let reject!: (err: Error) => void;
    const promise = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    this.refreshPromises.set(key, promise);

    const startTime = Date.now();

    try {
      await ExternalSourceCacheMeta.findOneAndUpdate(
        { cacheKey: key },
        { $set: { refreshInProgress: true, source, region } },
        { upsert: true },
      );

      let channels: any[] = [];

      switch (source) {
        case 'pluto-tv':
          channels = await this.fetchPlutoChannels(region);
          break;
        case 'samsung-tv-plus':
          channels = await this.fetchSamsungChannels(region);
          break;
        case 'youtube-live':
          channels = await this.fetchYouTubeLiveChannels(region);
          break;
        case 'prasar-bharati':
          channels = await this.fetchPrasarBharatiChannels(region);
          break;
      }

      // Upsert via bulkWrite (overlay — never delete)
      if (channels.length > 0) {
        const BATCH_SIZE = 500;
        for (let i = 0; i < channels.length; i += BATCH_SIZE) {
          const batch = channels.slice(i, i + BATCH_SIZE);
          const ops = batch.map((doc: any) => ({
            updateOne: {
              filter: { source, region, channelId: doc.channelId },
              update: {
                $set: {
                  channelName: doc.channelName,
                  streamUrl: doc.streamUrl,
                  streamUrlExpiresAt: doc.streamUrlExpiresAt || null,
                  tvgLogo: doc.tvgLogo,
                  groupTitle: doc.groupTitle,
                  country: doc.country,
                  summary: doc.summary,
                  codec: doc.codec || null,
                  bitrate: doc.bitrate || null,
                  language: doc.language || '',
                  votes: doc.votes || null,
                  homepage: doc.homepage || null,
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

          await ExternalSourceChannel.bulkWrite(ops, { ordered: false });
        }
      }

      const durationMs = Date.now() - startTime;

      await ExternalSourceCacheMeta.findOneAndUpdate(
        { cacheKey: key },
        {
          $set: {
            lastRefreshedAt: new Date(),
            refreshInProgress: false,
            channelCount: channels.length,
            refreshDurationMs: durationMs,
          },
        },
        { upsert: true },
      );

      await this.updateLivenessStats(source, region);

      console.log(
        `[ext-cache] Refresh complete for ${source}:${region}: ${channels.length} channels in ${durationMs}ms`,
      );

      resolve();
      return { channelCount: channels.length, durationMs };
    } catch (err: any) {
      await ExternalSourceCacheMeta.findOneAndUpdate(
        { cacheKey: key },
        { $set: { refreshInProgress: false } },
      ).catch(() => {});

      console.error(`[ext-cache] Refresh failed for ${source}:${region}:`, err.message);
      reject(err);
      throw err;
    } finally {
      this.refreshPromises.delete(key);
    }
  }

  // ─── Clear Cache ────────────────────────────────────────

  async clearCache(source?: ExternalSourceType, region?: string): Promise<void> {
    if (source && region) {
      await Promise.all([
        ExternalSourceChannel.deleteMany({ source, region }),
        ExternalSourceCacheMeta.deleteMany({
          cacheKey: buildCacheKey(source, region),
        }),
      ]);
    } else if (source) {
      await Promise.all([
        ExternalSourceChannel.deleteMany({ source }),
        ExternalSourceCacheMeta.deleteMany({ source }),
      ]);
    } else {
      await Promise.all([
        ExternalSourceChannel.deleteMany({}),
        ExternalSourceCacheMeta.deleteMany({}),
      ]);
    }
    console.log(
      `[ext-cache] Cache cleared${source ? ` for ${source}` : ''}${region ? `:${region}` : ''}`,
    );
  }

  // ─── Liveness: Single Stream ────────────────────────────

  async checkSingleStream(docId: string) {
    const doc = await ExternalSourceChannel.findById(docId);
    if (!doc) return null;

    let streamUrl = doc.streamUrl;

    // For Pluto TV, generate a fresh stream URL
    if (doc.source === 'pluto-tv') {
      try {
        const jwt = await this.getPlutoSessionToken(doc.region);
        streamUrl = this.buildPlutoStreamUrl(doc.channelId, jwt);
      } catch {
        return {
          channelId: doc.channelId,
          status: 'dead' as const,
          error: 'Failed to get Pluto TV session token',
        };
      }
    }

    if (!streamUrl) {
      return {
        channelId: doc.channelId,
        status: 'dead' as const,
        error: 'No stream URL',
      };
    }

    const result = await probeStream(streamUrl, { timeout: 10000 });

    await ExternalSourceChannel.updateOne(
      { _id: doc._id },
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

    await this.updateLivenessStats(doc.source as ExternalSourceType, doc.region);

    return { channelId: doc.channelId, ...result };
  }

  // ─── Liveness: Batch Check ──────────────────────────────

  async runBatchLivenessCheck(
    source: ExternalSourceType,
    region: string,
  ): Promise<{ checked: number; alive: number; dead: number }> {
    const key = buildCacheKey(source, region);

    if (this.livenessPromises.has(key)) {
      await this.livenessPromises.get(key);
      const meta = await this.getCacheMeta(source, region);
      return {
        checked: (meta?.livenessStats?.alive || 0) + (meta?.livenessStats?.dead || 0),
        alive: meta?.livenessStats?.alive || 0,
        dead: meta?.livenessStats?.dead || 0,
      };
    }

    let resolve!: () => void;
    let reject!: (err: Error) => void;
    const promise = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    this.livenessPromises.set(key, promise);

    try {
      await ExternalSourceCacheMeta.findOneAndUpdate(
        { cacheKey: key },
        { $set: { livenessCheckInProgress: true } },
        { upsert: true },
      );

      // For Pluto TV, get a fresh JWT
      let plutoJwt = '';
      if (source === 'pluto-tv') {
        try {
          plutoJwt = await this.getPlutoSessionToken(region);
        } catch (e: any) {
          console.warn('[ext-cache] Failed to get Pluto JWT for liveness check:', e.message);
        }
      }

      const totalDocs = await ExternalSourceChannel.countDocuments({
        source,
        region,
      });
      console.log(
        `[ext-cache] Starting batch liveness for ${source}:${region} (${totalDocs} channels, concurrency: ${LIVENESS_CONCURRENCY})`,
      );

      let checked = 0;
      let alive = 0;
      let dead = 0;
      const PAGE_SIZE = 200;

      // Cursor-based pagination (avoids slow skip() on large collections)
      let lastId: unknown = null;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const query: Record<string, unknown> = { source, region };
        if (lastId) query._id = { $gt: lastId };
        const batch = await ExternalSourceChannel.find(query)
          .sort({ _id: 1 })
          .limit(PAGE_SIZE)
          .lean();

        if (batch.length === 0) break;
        lastId = batch[batch.length - 1]._id;

        const probeResults = await this.parallelMap(
          batch,
          async (doc) => {
            try {
              let url = doc.streamUrl;
              if (source === 'pluto-tv' && plutoJwt) {
                url = this.buildPlutoStreamUrl(doc.channelId, plutoJwt);
              }
              if (!url) return { _id: doc._id, result: null, status: 'dead' as const };

              const result = await probeStream(url, { timeout: 10000 });
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
          await ExternalSourceChannel.bulkWrite(bulkOps, { ordered: false });
        }

        for (const r of probeResults) {
          checked++;
          if (r.status === 'alive') alive++;
          else if (r.status === 'dead') dead++;
          // 'unknown' is neither alive nor dead -- skipped from counts
        }

        if (checked % 500 === 0 || batch.length < PAGE_SIZE) {
          await this.updateLivenessStats(source, region);
          console.log(
            `[ext-cache] Liveness progress ${source}:${region}: ${checked}/${totalDocs} (${alive} alive, ${dead} dead)`,
          );
        }
      }

      await ExternalSourceCacheMeta.findOneAndUpdate(
        { cacheKey: key },
        {
          $set: {
            livenessCheckInProgress: false,
            lastLivenessCheckAt: new Date(),
          },
        },
      );

      await this.updateLivenessStats(source, region);

      console.log(
        `[ext-cache] Batch liveness complete for ${source}:${region}: ${checked} checked, ${alive} alive, ${dead} dead`,
      );

      resolve();
      return { checked, alive, dead };
    } catch (err: any) {
      await ExternalSourceCacheMeta.findOneAndUpdate(
        { cacheKey: key },
        { $set: { livenessCheckInProgress: false } },
      ).catch(() => {});

      console.error(`[ext-cache] Batch liveness failed for ${source}:${region}:`, err.message);
      reject(err);
      throw err;
    } finally {
      this.livenessPromises.delete(key);
    }
  }

  // ─── Region / Country Fetchers ──────────────────────────

  async getPlutoRegions() {
    const data = await this.loadMjhChannels('PlutoTV');
    return Object.entries(data.regions || {}).map(([code, info]: [string, any]) => ({
      code,
      name: info.name || code.toUpperCase(),
      channelCount: Object.keys(info.channels || {}).length,
    }));
  }

  async getSamsungRegions() {
    const data = await this.loadMjhChannels('SamsungTVPlus');
    return Object.entries(data.regions || {}).map(([code, info]: [string, any]) => ({
      code,
      name: info.name || code.toUpperCase(),
      channelCount: Object.keys(info.channels || {}).length,
    }));
  }

  async getYouTubeLiveRegions() {
    const count = await SeedChannel.countDocuments({ source: 'youtube-live', enabled: true });
    return [{ code: 'in', name: 'India', channelCount: count }];
  }

  async getPrasarBharatiRegions() {
    const count = await SeedChannel.countDocuments({ source: 'prasar-bharati', enabled: true });
    return [{ code: 'in', name: 'India', channelCount: count }];
  }

  // ─── YouTube URL Refresh (for scheduler) ──────────────

  async refreshYouTubeUrls(): Promise<{ refreshed: number; failed: number }> {
    const now = new Date();
    // Find all youtube-live and prasar-bharati channels with expired or missing stream URLs
    const expiredChannels = await ExternalSourceChannel.find({
      source: { $in: ['youtube-live', 'prasar-bharati'] },
      $or: [{ streamUrlExpiresAt: { $lt: now } }, { streamUrlExpiresAt: null }, { streamUrl: '' }],
    }).lean();

    if (expiredChannels.length === 0) {
      console.log('[ext-cache] No YouTube URLs need refreshing');
      return { refreshed: 0, failed: 0 };
    }

    // Get the corresponding seed channels to find ytChannelIds
    const seedChannels = await SeedChannel.find({
      source: { $in: ['youtube-live', 'prasar-bharati'] },
      enabled: true,
      ytChannelId: { $ne: null },
    }).lean();

    // Map channelId -> ytChannelId from seed data
    const ytIdMap = new Map<string, string>();
    for (const seed of seedChannels) {
      if (seed.ytChannelId) {
        ytIdMap.set(seed.ytChannelId, seed.ytChannelId);
      }
    }

    // Filter to channels that need yt-dlp resolution
    const toResolve = expiredChannels.filter((ch) => ytIdMap.has(ch.channelId));
    if (toResolve.length === 0) {
      return { refreshed: 0, failed: 0 };
    }

    console.log(`[ext-cache] Refreshing ${toResolve.length} YouTube stream URLs...`);

    const channelIds = toResolve.map((ch) => ch.channelId);
    const results = await ytDlpResolver.resolveBatch(channelIds);

    let refreshed = 0;
    let failed = 0;
    const bulkOps = [];

    for (const ch of toResolve) {
      const result = results.get(ch.channelId);
      if (result) {
        bulkOps.push({
          updateOne: {
            filter: { _id: ch._id },
            update: {
              $set: {
                streamUrl: result.url,
                streamUrlExpiresAt: result.expiresAt,
              },
            },
          },
        });
        refreshed++;
      } else {
        failed++;
      }
    }

    if (bulkOps.length > 0) {
      await ExternalSourceChannel.bulkWrite(bulkOps, { ordered: false });
    }

    console.log(
      `[ext-cache] YouTube URL refresh complete: ${refreshed} refreshed, ${failed} failed`,
    );

    return { refreshed, failed };
  }

  // ─── Private: Update liveness stats in meta ─────────────

  private async updateLivenessStats(source: ExternalSourceType, region: string) {
    const filter = { source, region };
    const [alive, dead, unknown] = await Promise.all([
      ExternalSourceChannel.countDocuments({
        ...filter,
        'liveness.status': 'alive',
      }),
      ExternalSourceChannel.countDocuments({
        ...filter,
        'liveness.status': 'dead',
      }),
      ExternalSourceChannel.countDocuments({
        ...filter,
        'liveness.status': 'unknown',
      }),
    ]);

    await ExternalSourceCacheMeta.findOneAndUpdate(
      { cacheKey: buildCacheKey(source, region) },
      { $set: { livenessStats: { alive, dead, unknown } } },
    );
  }

  // ─── Private: Fetch from APIs ───────────────────────────

  private mjhCache: Record<string, { data: any; timestamp: number }> = {};

  private async loadMjhChannels(service: string): Promise<any> {
    const cacheKey = `mjh_${service}`;
    const cached = this.mjhCache[cacheKey];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.data;

    const url = `https://i.mjh.nz/${service}/.channels.json`;
    const response = await axios.get(url, { timeout: 20000 });
    this.mjhCache[cacheKey] = { data: response.data, timestamp: Date.now() };
    return response.data;
  }

  private async fetchPlutoChannels(region: string): Promise<any[]> {
    const data = await this.loadMjhChannels('PlutoTV');
    const regionData = data.regions?.[region];
    if (!regionData || !regionData.channels) return [];

    return Object.entries(regionData.channels).map(([id, ch]: [string, any]) => ({
      channelId: id,
      channelName: ch.name || '',
      streamUrl: '', // Generated on-the-fly with JWT
      tvgLogo: ch.logo || '',
      groupTitle: ch.group || 'Uncategorized',
      country: region.toUpperCase(),
      summary: ch.description || '',
    }));
  }

  private async fetchSamsungChannels(region: string): Promise<any[]> {
    const data = await this.loadMjhChannels('SamsungTVPlus');
    const slug = data.slug || 'stvp-{id}';
    const regionData = data.regions?.[region];
    if (!regionData || !regionData.channels) return [];

    return Object.entries(regionData.channels)
      .filter(([, ch]: [string, any]) => !ch.license_url) // Skip DRM
      .map(([id, ch]: [string, any]) => ({
        channelId: id,
        channelName: ch.name || '',
        streamUrl: `https://jmp2.uk/${slug.replace('{id}', id)}`,
        tvgLogo: ch.logo || '',
        groupTitle: ch.group || 'Uncategorized',
        country: region.toUpperCase(),
        summary: ch.description || '',
      }));
  }

  private async fetchYouTubeLiveChannels(_region: string): Promise<any[]> {
    const seeds = await SeedChannel.find({
      source: 'youtube-live',
      enabled: true,
    }).lean();

    if (seeds.length === 0) return [];

    const ytChannelIds = seeds.filter((s) => s.ytChannelId).map((s) => s.ytChannelId!);

    const resolved = await ytDlpResolver.resolveBatch(ytChannelIds);

    return seeds.map((seed) => {
      const result = seed.ytChannelId ? resolved.get(seed.ytChannelId) : null;
      return {
        channelId: seed.ytChannelId || seed._id.toString(),
        channelName: seed.channelName,
        streamUrl: result?.url || '',
        streamUrlExpiresAt: result?.expiresAt || null,
        tvgLogo: seed.tvgLogo || '',
        groupTitle: seed.groupTitle || 'Uncategorized',
        country: 'IN',
        language: seed.language || '',
        summary: '',
      };
    });
  }

  private async fetchPrasarBharatiChannels(_region: string): Promise<any[]> {
    const seeds = await SeedChannel.find({
      source: 'prasar-bharati',
      enabled: true,
    }).lean();

    if (seeds.length === 0) return [];

    // Separate direct-URL channels from YouTube-based ones
    const directChannels = seeds.filter((s) => s.directUrl);
    const ytChannels = seeds.filter((s) => s.ytChannelId && !s.directUrl);

    const ytChannelIds = ytChannels.map((s) => s.ytChannelId!);
    const resolved =
      ytChannelIds.length > 0 ? await ytDlpResolver.resolveBatch(ytChannelIds) : new Map();

    const results: any[] = [];

    for (const seed of directChannels) {
      results.push({
        channelId: seed._id.toString(),
        channelName: seed.channelName,
        streamUrl: seed.directUrl || '',
        streamUrlExpiresAt: null,
        tvgLogo: seed.tvgLogo || '',
        groupTitle: seed.groupTitle || 'Uncategorized',
        country: 'IN',
        language: seed.language || '',
        summary: '',
      });
    }

    for (const seed of ytChannels) {
      const result = resolved.get(seed.ytChannelId!);
      results.push({
        channelId: seed.ytChannelId!,
        channelName: seed.channelName,
        streamUrl: result?.url || '',
        streamUrlExpiresAt: result?.expiresAt || null,
        tvgLogo: seed.tvgLogo || '',
        groupTitle: seed.groupTitle || 'Uncategorized',
        country: 'IN',
        language: seed.language || '',
        summary: '',
      });
    }

    return results;
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

export const externalSourceCacheService = new ExternalSourceCacheService();

module.exports = { externalSourceCacheService, ExternalSourceCacheService };
