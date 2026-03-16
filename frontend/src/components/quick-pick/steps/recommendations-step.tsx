'use client';

import { useEffect, useState, useMemo } from 'react';
import { Loader2, Search, Play, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import api from '@/lib/api';
import { proxyImageUrl } from '@/lib/image-proxy';
import { useStreamPlayer } from '@/components/stream-player-context';
import type { SourceType, WizardChannel, ChannelLiveness } from '../wizard-shell';

const PAGE_SIZE = 50;

const SOURCE_LABELS: Record<string, string> = {
  all: 'All',
  'iptv-org': 'IPTV-org',
  'pluto-tv': 'Pluto TV',
  'samsung-tv-plus': 'Samsung TV+',
};

const LIVENESS_COLORS: Record<string, string> = {
  alive: 'bg-signal-green',
  dead: 'bg-signal-red',
  unknown: 'bg-muted-foreground/40',
};

type LivenessFilter = 'all' | 'alive' | 'dead' | 'unknown';

interface RecommendationsStepProps {
  selectedSources: SourceType[];
  countrySelections: Record<string, string>;
  selectedLanguages: string[];
  selectedCategories: string[];
  fetchedChannels: WizardChannel[];
  selectedChannelIds: Set<string>;
  onSetFetchedChannels: (channels: WizardChannel[]) => void;
  onToggleChannel: (uid: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

export function RecommendationsStep({
  selectedSources,
  countrySelections,
  selectedLanguages,
  selectedCategories,
  fetchedChannels,
  selectedChannelIds,
  onSetFetchedChannels,
  onToggleChannel,
  onSelectAll,
  onDeselectAll,
}: RecommendationsStepProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceType | 'all'>('all');
  const [page, setPage] = useState(1);
  const { playStream } = useStreamPlayer();

  // Liveness state
  const [livenessFilter, setLivenessFilter] = useState<LivenessFilter>('all');
  const [livenessMap, setLivenessMap] = useState<Map<string, ChannelLiveness>>(new Map());
  const [checkingIds, setCheckingIds] = useState<Set<string>>(new Set());
  const [bulkChecking, setBulkChecking] = useState(false);

  function getChannelLiveness(ch: WizardChannel): ChannelLiveness {
    return livenessMap.get(ch.uid) || ch.liveness || { status: 'unknown' };
  }

  // --- Check single channel liveness ---
  async function checkSingleLiveness(ch: WizardChannel) {
    setCheckingIds((prev) => {
      const n = new Set(prev);
      n.add(ch.uid);
      return n;
    });
    try {
      let res;
      if (ch.source === 'iptv-org') {
        res = await api.post(`/iptv-org/check-liveness/${ch.channelId}`, {
          streamUrl: ch.channelUrl,
        });
      } else {
        const id = ch.docId || ch.channelId;
        res = await api.post(`/external-sources/check-liveness/${id}`);
      }
      const data = res.data.data;
      const lv = data?.liveness || data;
      if (lv?.status) {
        setLivenessMap((prev) => {
          const n = new Map(prev);
          n.set(ch.uid, {
            status: lv.status,
            lastCheckedAt: lv.lastCheckedAt,
            responseTimeMs: lv.responseTimeMs,
          });
          return n;
        });
      }
    } catch {
      // leave status unchanged
    } finally {
      setCheckingIds((prev) => {
        const n = new Set(prev);
        n.delete(ch.uid);
        return n;
      });
    }
  }

  // Stable key that changes when filter selections change
  const filterKey = useMemo(
    () =>
      JSON.stringify({
        sources: selectedSources,
        countries: countrySelections,
        languages: selectedLanguages,
        categories: selectedCategories,
      }),
    [selectedSources, countrySelections, selectedLanguages, selectedCategories],
  );

  // --- Fetch channels from all sources ---
  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    async function fetchAll() {
      setLoading(true);
      setError('');
      const allChannels: WizardChannel[] = [];

      const promises: Promise<void>[] = [];

      if (selectedSources.includes('iptv-org')) {
        const params = new URLSearchParams();
        const country = countrySelections['iptv-org'];
        if (country) params.set('country', country);
        if (selectedLanguages.length > 0) params.set('languages', selectedLanguages.join(','));
        if (selectedCategories.length > 0) params.set('category', selectedCategories.join(','));

        promises.push(
          api
            .get(`/iptv-org/fetch?${params.toString()}`, { signal })
            .then((res) => {
              const data = res.data.data || [];
              data.forEach((ch: Record<string, unknown>, i: number) => {
                const lv = ch.liveness as Record<string, unknown> | undefined;
                allChannels.push({
                  uid: `iptv-org_${i}_${ch.channelId || ch.channelName}`,
                  source: 'iptv-org',
                  channelId: (ch.channelId as string) || '',
                  channelName: (ch.channelName as string) || '',
                  channelUrl: (ch.channelUrl as string) || '',
                  tvgLogo: (ch.tvgLogo as string) || '',
                  groupTitle:
                    (ch.groupTitle as string) || (ch.channelCategories as string[])?.[0] || '',
                  country: (ch.country as string) || '',
                  language: Array.isArray(ch.languages)
                    ? (ch.languages as string[]).join(', ')
                    : '',
                  languages: Array.isArray(ch.languages) ? (ch.languages as string[]) : [],
                  liveness: lv?.status
                    ? {
                        status: String(lv.status),
                        lastCheckedAt: lv.lastCheckedAt as string | undefined,
                        responseTimeMs: lv.responseTimeMs as number | undefined,
                      }
                    : undefined,
                });
              });
            })
            .catch((err) => {
              if (err.name !== 'CanceledError') console.warn('iptv-org fetch failed:', err.message);
            }),
        );
      }

      if (selectedSources.includes('pluto-tv')) {
        const country = countrySelections['pluto-tv'] || 'us';
        promises.push(
          api
            .get(`/external-sources/pluto-tv/channels?country=${country}`, { signal })
            .then((res) => {
              const data = res.data.data || [];
              data.forEach((ch: Record<string, unknown>) => {
                const lv = ch.liveness as Record<string, unknown> | undefined;
                allChannels.push({
                  uid: `pluto-tv_${ch.channelId}`,
                  source: 'pluto-tv',
                  channelId: (ch.channelId as string) || '',
                  channelName: (ch.channelName as string) || '',
                  channelUrl: (ch.channelUrl as string) || '',
                  tvgLogo: (ch.tvgLogo as string) || '',
                  groupTitle: (ch.groupTitle as string) || '',
                  country: (ch.country as string) || '',
                  language: '',
                  languages: [],
                  docId: (ch._uid as string) || '',
                  liveness: lv?.status
                    ? {
                        status: String(lv.status),
                        lastCheckedAt: lv.lastCheckedAt as string | undefined,
                        responseTimeMs: lv.responseTimeMs as number | undefined,
                      }
                    : undefined,
                });
              });
            })
            .catch((err) => {
              if (err.name !== 'CanceledError') console.warn('pluto-tv fetch failed:', err.message);
            }),
        );
      }

      if (selectedSources.includes('samsung-tv-plus')) {
        const country = countrySelections['samsung-tv-plus'] || 'us';
        promises.push(
          api
            .get(`/external-sources/samsung-tv-plus/channels?country=${country}`, { signal })
            .then((res) => {
              const data = res.data.data || [];
              data.forEach((ch: Record<string, unknown>) => {
                const lv = ch.liveness as Record<string, unknown> | undefined;
                allChannels.push({
                  uid: `samsung-tv-plus_${ch.channelId}`,
                  source: 'samsung-tv-plus',
                  channelId: (ch.channelId as string) || '',
                  channelName: (ch.channelName as string) || '',
                  channelUrl: (ch.channelUrl as string) || '',
                  tvgLogo: (ch.tvgLogo as string) || '',
                  groupTitle: (ch.groupTitle as string) || '',
                  country: (ch.country as string) || '',
                  language: '',
                  languages: [],
                  docId: (ch._uid as string) || '',
                  liveness: lv?.status
                    ? {
                        status: String(lv.status),
                        lastCheckedAt: lv.lastCheckedAt as string | undefined,
                        responseTimeMs: lv.responseTimeMs as number | undefined,
                      }
                    : undefined,
                });
              });
            })
            .catch((err) => {
              if (err.name !== 'CanceledError')
                console.warn('samsung-tv-plus fetch failed:', err.message);
            }),
        );
      }

      await Promise.allSettled(promises);
      if (signal.aborted) return;

      // Client-side category filter for external sources
      let filtered = allChannels;
      if (selectedCategories.length > 0) {
        const catsLower = selectedCategories.map((c) => c.toLowerCase());
        filtered = allChannels.filter((ch) => {
          if (ch.source === 'iptv-org') return true; // already filtered server-side
          return catsLower.some((cat) => ch.groupTitle.toLowerCase().includes(cat));
        });
        // If filtering removes too many, fall back to all
        if (filtered.length < allChannels.length * 0.1) {
          filtered = allChannels;
        }
      }

      onSetFetchedChannels(filtered);
      if (filtered.length === 0) {
        setError('No channels found. Try adjusting your filters.');
      }
      setLoading(false);
    }

    fetchAll();
    return () => controller.abort();
  }, [filterKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Filtering & pagination ---

  // Base filter: source + search (before liveness)
  const displayChannelsBase = useMemo(() => {
    let list = fetchedChannels;
    if (sourceFilter !== 'all') {
      list = list.filter((ch) => ch.source === sourceFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (ch) =>
          ch.channelName.toLowerCase().includes(q) ||
          ch.groupTitle.toLowerCase().includes(q) ||
          ch.country.toLowerCase().includes(q),
      );
    }
    return list;
  }, [fetchedChannels, sourceFilter, search]);

  // Liveness counts (computed from base, before liveness filter)
  const livenessCounts = useMemo(() => {
    const counts = { all: displayChannelsBase.length, alive: 0, dead: 0, unknown: 0 };
    displayChannelsBase.forEach((ch) => {
      const lv = livenessMap.get(ch.uid) || ch.liveness || { status: 'unknown' };
      const s = lv.status as 'alive' | 'dead' | 'unknown';
      if (s in counts) counts[s]++;
      else counts.unknown++;
    });
    return counts;
  }, [displayChannelsBase, livenessMap]);

  // Final filtered list (with liveness)
  const displayChannels = useMemo(() => {
    if (livenessFilter === 'all') return displayChannelsBase;
    return displayChannelsBase.filter((ch) => {
      const lv = livenessMap.get(ch.uid) || ch.liveness || { status: 'unknown' };
      return lv.status === livenessFilter;
    });
  }, [displayChannelsBase, livenessFilter, livenessMap]);

  const totalPages = Math.max(1, Math.ceil(displayChannels.length / PAGE_SIZE));
  const pageChannels = displayChannels.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Page-level select all
  const allPageSelected =
    pageChannels.length > 0 && pageChannels.every((ch) => selectedChannelIds.has(ch.uid));
  const somePageSelected =
    !allPageSelected && pageChannels.some((ch) => selectedChannelIds.has(ch.uid));

  function togglePageSelection() {
    if (allPageSelected) {
      // Deselect all on this page
      pageChannels.forEach((ch) => {
        if (selectedChannelIds.has(ch.uid)) onToggleChannel(ch.uid);
      });
    } else {
      // Select all on this page
      pageChannels.forEach((ch) => {
        if (!selectedChannelIds.has(ch.uid)) onToggleChannel(ch.uid);
      });
    }
  }

  // Build page number array for pagination
  const pageNumbers = useMemo((): (number | '...')[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | '...')[] = [1];
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    if (start > 2) pages.push('...');
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages - 1) pages.push('...');
    pages.push(totalPages);
    return pages;
  }, [totalPages, page]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, sourceFilter, livenessFilter]);

  // --- Check all channels on current page ---
  async function checkPageLiveness() {
    setBulkChecking(true);
    const BATCH = 5;
    for (let i = 0; i < pageChannels.length; i += BATCH) {
      const batch = pageChannels.slice(i, i + BATCH);
      await Promise.allSettled(batch.map((ch) => checkSingleLiveness(ch)));
    }
    setBulkChecking(false);
  }

  const sourceCounts = useMemo(() => {
    const counts: Record<string, number> = { all: fetchedChannels.length };
    fetchedChannels.forEach((ch) => {
      counts[ch.source] = (counts[ch.source] || 0) + 1;
    });
    return counts;
  }, [fetchedChannels]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">
          Fetching channels from {selectedSources.length} source
          {selectedSources.length !== 1 ? 's' : ''}...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-4 ">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">Step 5</p>
        <h2 className="text-base font-display font-bold uppercase tracking-[0.08em]">
          Select Your Channels
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {fetchedChannels.length} channels found &middot; {selectedChannelIds.size} selected
        </p>
      </div>

      {error && (
        <div className="border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search channels..."
            aria-label="Search channels"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-border bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={checkPageLiveness}
            disabled={bulkChecking || pageChannels.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs uppercase tracking-[0.1em] font-medium border border-border bg-card hover:border-primary/40 transition-colors disabled:opacity-40 disabled:pointer-events-none"
            title="Check liveness of channels on this page"
            aria-label="Check liveness of channels on this page"
          >
            {bulkChecking ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            {bulkChecking ? 'Checking...' : 'Check Page'}
          </button>
          <span className="text-muted-foreground/40">|</span>
          <button
            onClick={onSelectAll}
            className="text-xs uppercase tracking-[0.1em] text-primary hover:text-primary/80 font-medium"
          >
            Select All
          </button>
          <span className="text-muted-foreground">|</span>
          <button
            onClick={onDeselectAll}
            className="text-xs uppercase tracking-[0.1em] text-primary hover:text-primary/80 font-medium"
          >
            Deselect All
          </button>
        </div>
      </div>

      {/* Source tabs */}
      {selectedSources.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {(['all' as const, ...selectedSources] as const).map((src) => {
            if (src !== 'all' && !sourceCounts[src]) return null;
            return (
              <button
                key={src}
                onClick={() => setSourceFilter(src)}
                className={`px-3 py-1.5 text-xs border transition-colors ${
                  sourceFilter === src
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-border bg-card hover:border-primary/40'
                }`}
              >
                {SOURCE_LABELS[src]} ({sourceCounts[src] || 0})
              </button>
            );
          })}
        </div>
      )}

      {/* Liveness filter */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs uppercase tracking-[0.1em] text-muted-foreground mr-1">
          Status:
        </span>
        {(['all', 'alive', 'dead', 'unknown'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setLivenessFilter(status)}
            aria-label={`Filter by ${status} status`}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border transition-colors ${
              livenessFilter === status
                ? 'border-primary bg-primary/10 text-primary font-medium'
                : 'border-border bg-card hover:border-primary/40'
            }`}
          >
            {status !== 'all' && (
              <span className={`w-1.5 h-1.5 rounded-full ${LIVENESS_COLORS[status]}`} />
            )}
            {status.charAt(0).toUpperCase() + status.slice(1)} ({livenessCounts[status]})
          </button>
        ))}
      </div>

      {/* Channel list */}
      <div className="border border-border divide-y divide-border">
        {/* Header row */}
        <div className="flex items-center gap-3 px-4 py-2 bg-muted/60 sticky top-0 z-10">
          <input
            type="checkbox"
            checked={allPageSelected}
            ref={(el) => {
              if (el) el.indeterminate = somePageSelected;
            }}
            onChange={togglePageSelection}
            className="accent-primary shrink-0"
            aria-label="Select all channels on page"
            title={allPageSelected ? 'Deselect all on page' : 'Select all on page'}
          />
          <div className="h-7 w-7 shrink-0" /> {/* spacer for logo column */}
          <span className="flex-1 text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium">
            Channel
          </span>
          <span className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium shrink-0 w-2 text-center"></span>
          <span className="hidden sm:inline text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium shrink-0">
            Source
          </span>
          <span className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium shrink-0 w-[30px] text-center"></span>
          <span className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium shrink-0 w-[30px] text-center"></span>
        </div>
        <div className="max-h-[400px] overflow-y-auto divide-y divide-border">
          {pageChannels.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No channels match your filters.
            </p>
          )}
          {pageChannels.map((ch) => {
            const lv = getChannelLiveness(ch);
            const isChecking = checkingIds.has(ch.uid);
            return (
              <div
                key={ch.uid}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedChannelIds.has(ch.uid)}
                  onChange={() => onToggleChannel(ch.uid)}
                  className="accent-primary shrink-0"
                />
                {ch.tvgLogo ? (
                  <img
                    src={proxyImageUrl(ch.tvgLogo)}
                    alt={ch.channelName}
                    loading="lazy"
                    className="h-7 w-7 rounded-sm object-contain shrink-0 bg-muted"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="h-7 w-7 rounded-sm bg-muted shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{ch.channelName}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {ch.groupTitle}
                    {ch.country ? ` · ${ch.country}` : ''}
                  </p>
                </div>
                {/* Liveness dot */}
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    lv.status === 'alive'
                      ? 'bg-signal-green'
                      : lv.status === 'dead'
                        ? 'bg-signal-red'
                        : 'bg-muted-foreground/40'
                  }`}
                  title={`Status: ${lv.status}${lv.responseTimeMs ? ` (${lv.responseTimeMs}ms)` : ''}`}
                >
                  <span className="sr-only">Status: {lv.status}</span>
                </span>
                <span className="hidden sm:inline text-xs uppercase tracking-[0.1em] text-muted-foreground bg-muted px-1.5 py-0.5 shrink-0">
                  {SOURCE_LABELS[ch.source] || ch.source}
                </span>
                {/* Check liveness button */}
                <button
                  onClick={() => checkSingleLiveness(ch)}
                  disabled={isChecking}
                  className="p-1.5 text-muted-foreground hover:text-primary transition-colors shrink-0 disabled:pointer-events-none"
                  aria-label={`Check liveness for ${ch.channelName}`}
                  title="Check liveness"
                >
                  {isChecking ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                </button>
                {ch.channelUrl && (
                  <button
                    onClick={() =>
                      playStream(
                        { name: ch.channelName, url: ch.channelUrl, logo: ch.tvgLogo },
                        { mode: 'direct-fallback' },
                      )
                    }
                    className="p-1.5 text-muted-foreground hover:text-primary transition-colors shrink-0"
                    aria-label={`Preview ${ch.channelName}`}
                    title="Preview stream"
                  >
                    <Play className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages} ({displayChannels.length} channels)
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2.5 py-2 text-xs border border-border hover:border-primary/40 disabled:opacity-30 disabled:pointer-events-none"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            {pageNumbers.map((n, i) =>
              n === '...' ? (
                <span
                  key={`ellipsis-${i}`}
                  className="px-1 text-xs text-muted-foreground"
                  aria-hidden="true"
                >
                  ...
                </span>
              ) : (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  aria-label={`Go to page ${n}`}
                  aria-current={page === n ? 'page' : undefined}
                  className={`px-2.5 py-2 text-xs border transition-colors ${
                    page === n
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border hover:border-primary/40'
                  }`}
                >
                  {n}
                </button>
              ),
            )}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-2.5 py-2 text-xs border border-border hover:border-primary/40 disabled:opacity-30 disabled:pointer-events-none"
              aria-label="Next page"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
