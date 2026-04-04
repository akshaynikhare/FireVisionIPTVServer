'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Loader2,
  Globe,
  RefreshCw,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckSquare,
  Square,
  Zap,
  Layers,
  List,
} from 'lucide-react';
import api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useBulkSelection } from '@/hooks/use-bulk-selection';
import { useClientSideTable } from '@/hooks/use-client-side-table';
import { useStreamPlayer } from '@/components/stream-player-context';
import { proxyImageUrl } from '@/lib/image-proxy';
import Pagination from '@/components/ui/pagination';
import ColumnFilter from '@/components/ui/column-filter';
import SearchInput from '@/components/ui/search-input';
import SelectionToolbar from '@/components/ui/selection-toolbar';
import StatusDot from '@/components/ui/status-dot';
import ChannelLogo from '@/components/ui/channel-logo';
import LivenessStatsBar from '@/components/ui/liveness-stats-bar';
import ChannelDetailModal, { type ChannelField } from '@/components/channel-detail-modal';
import ChannelRowActions from '@/components/ui/channel-row-actions';
import DataTable, { type DataTableColumn } from '@/components/ui/data-table';
import GroupedStreamRow, { type GroupedStream } from '@/components/grouped-stream-row';

interface PlaylistFilter {
  country?: string;
  language?: string;
  languages?: string[];
  category?: string;
  categories?: string[];
}

interface Playlist {
  id: string;
  name: string;
  country?: string;
  languages?: string[];
  categories?: string[];
  filter?: PlaylistFilter;
}

interface EnrichedChannel {
  _uid: string;
  channelId: string;
  channelName: string;
  channelUrl: string;
  channelCategories?: string[];
  languages?: string[];
  tvgLogo?: string;
  channelImg?: string;
  groupTitle?: string;
  country?: string;
  channelNetwork?: string;
  channelWebsite?: string;
  streamQuality?: string;
  streamUserAgent?: string;
  streamReferrer?: string;
  channelIsNsfw?: boolean;
  channelLaunched?: string;
  liveness?: {
    status: 'alive' | 'dead' | 'unknown';
    lastCheckedAt?: string | null;
    responseTimeMs?: number | null;
    error?: string | null;
  };
  [key: string]: unknown;
}

interface GroupedChannel {
  _uid: string;
  channelId: string;
  channelName: string;
  tvgLogo?: string;
  country?: string;
  categories?: string[];
  languageNames?: string[];
  channelNetwork?: string;
  channelWebsite?: string;
  channelIsNsfw?: boolean;
  channelGroup?: string;
  streamCount: number;
  bestStream: GroupedStream;
  streams: GroupedStream[];
}

type SortField = 'name' | 'category' | 'language';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 50;

interface ImportPageShellProps {
  mode: 'admin' | 'user';
}

export default function ImportPageShell({ mode }: ImportPageShellProps) {
  const isAdmin = mode === 'admin';
  const { toast } = useToast();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null);
  const [channels, setChannels] = useState<EnrichedChannel[]>([]);
  const [fetchingChannels, setFetchingChannels] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(false);

  // Grouped mode
  const [groupedMode, setGroupedMode] = useState(true);
  const [groupedChannels, setGroupedChannels] = useState<GroupedChannel[]>([]);
  const [groupedTotal, setGroupedTotal] = useState(0);
  const [groupedPage, setGroupedPage] = useState(1);
  const [testingStreamUrl, setTestingStreamUrl] = useState<string | null>(null);
  const [groupedSearch, setGroupedSearch] = useState('');
  const [groupedStatus, setGroupedStatus] = useState<string>('');
  const groupedSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Region selector
  const [regions, setRegions] = useState<{ code: string; channelCount: number }[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [showAllRegions, setShowAllRegions] = useState(false);

  const regionDisplayNames = useMemo(() => {
    const dn = (() => {
      try {
        return new Intl.DisplayNames(['en'], { type: 'region' });
      } catch {
        return null;
      }
    })();
    return Object.fromEntries(
      regions.map((r) => {
        try {
          return [r.code, dn?.of(r.code) || r.code];
        } catch {
          return [r.code, r.code];
        }
      }),
    );
  }, [regions]);

  // Datatable state
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);

  // Column filter state
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

  // Liveness testing (admin only)
  const [testingChannelId, setTestingChannelId] = useState<string | null>(null);
  const [batchTesting, setBatchTesting] = useState(false);
  const [livenessStats, setLivenessStats] = useState<{
    alive: number;
    dead: number;
    unknown: number;
  } | null>(null);

  // Modals
  const [detailChannel, setDetailChannel] = useState<EnrichedChannel | null>(null);
  const { playStream } = useStreamPlayer();

  // Bulk selection
  const {
    isSelected,
    toggleOne,
    selectMany,
    unselectMany,
    unselectAll,
    count: selectedCount,
  } = useBulkSelection();

  const handlePlay = useCallback(
    (ch: EnrichedChannel) => {
      playStream(
        {
          name: ch.channelName || 'Stream Preview',
          url: ch.channelUrl,
          logo: ch.tvgLogo ? proxyImageUrl(ch.tvgLogo) : undefined,
        },
        { mode: 'direct-fallback' },
      );
    },
    [playStream],
  );

  useEffect(() => {
    const controller = new AbortController();
    async function fetchInitial() {
      try {
        const [playlistRes, regionRes] = await Promise.all([
          api.get('/iptv-org/playlists', { signal: controller.signal }),
          api.get('/iptv-org/countries', { signal: controller.signal }),
        ]);
        if (!controller.signal.aborted) {
          setPlaylists(playlistRes.data.data || []);
          setRegions(regionRes.data.data || []);
        }
      } catch {
        // ignore
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    fetchInitial();
    if (isAdmin) fetchLivenessStats(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  async function fetchLivenessStats(signal?: AbortSignal) {
    try {
      const res = await api.get('/iptv-org/liveness-status', { signal });
      if (!signal?.aborted) {
        setLivenessStats(res.data.data?.livenessStats || null);
        setBatchTesting(res.data.data?.livenessCheckInProgress || false);
      }
    } catch {
      // ignore
    }
  }

  function resetTableState() {
    setFetchingChannels(true);
    setChannels([]);
    unselectAll();
    setImportResult(null);
    setSearch('');
    setPage(1);
    setSelectedCategories([]);
    setSelectedLanguages([]);
    setSelectedCountries([]);
    setGroupedSearch('');
    setGroupedStatus('');
  }

  async function handleSelectRegion(code: string) {
    setSelectedRegion(code);
    setSelectedPlaylist(null);
    resetTableState();

    try {
      const params = new URLSearchParams();
      params.set('country', code);
      if (groupedMode) {
        await fetchGroupedChannels(params, 1);
      } else {
        await fetchChannelsFromApi(params);
      }
    } catch {
      toast('Failed to fetch channels', 'error');
    } finally {
      setFetchingChannels(false);
    }
  }

  async function handleSelectPlaylist(playlist: Playlist) {
    setSelectedPlaylist(playlist.id);
    setSelectedRegion(null);
    resetTableState();

    try {
      const params = new URLSearchParams();
      const f = playlist.filter;
      if (f) {
        if (f.country) params.set('country', f.country);
        if (f.languages?.length) params.set('languages', f.languages.join(','));
        else if (f.language) params.set('language', f.language);
        if (f.categories?.length) params.set('category', f.categories.join(','));
        else if (f.category) params.set('category', f.category);
      } else {
        if (playlist.country) params.set('country', playlist.country);
        if (playlist.languages?.length) params.set('language', playlist.languages.join(','));
        if (playlist.categories?.length) params.set('category', playlist.categories.join(','));
      }

      if (groupedMode) {
        await fetchGroupedChannels(params, 1);
      } else {
        await fetchChannelsFromApi(params);
      }
    } catch {
      toast('Failed to fetch channels', 'error');
    } finally {
      setFetchingChannels(false);
    }
  }

  async function fetchChannelsFromApi(params: URLSearchParams) {
    const res = await api.get(`/iptv-org/fetch?${params.toString()}`);
    const data = (res.data.data || []).map((ch: Omit<EnrichedChannel, '_uid'>, i: number) => ({
      ...ch,
      _uid: String(i),
    }));
    setChannels(data);
    if (!isAdmin) {
      selectMany(data.map((c: EnrichedChannel) => c._uid));
    }
  }

  function buildGroupedParams(overrides?: { search?: string; status?: string }) {
    const params = new URLSearchParams();
    if (selectedRegion) params.set('country', selectedRegion);
    if (selectedPlaylist) {
      const pl = playlists.find((p) => p.id === selectedPlaylist);
      if (pl) {
        const f = pl.filter;
        if (f) {
          if (f.country) params.set('country', f.country);
          if (f.languages?.length) params.set('languages', f.languages.join(','));
          else if (f.language) params.set('language', f.language);
          if (f.categories?.length) params.set('category', f.categories.join(','));
          else if (f.category) params.set('category', f.category);
        } else {
          if (pl.country) params.set('country', pl.country);
          if (pl.languages?.length) params.set('language', pl.languages.join(','));
          if (pl.categories?.length) params.set('category', pl.categories.join(','));
        }
      }
    }
    const s = overrides?.search ?? groupedSearch;
    if (s) params.set('search', s);
    const st = overrides?.status ?? groupedStatus;
    if (st) params.set('status', st);
    return params;
  }

  async function fetchGroupedChannels(params: URLSearchParams, pg: number) {
    params.set('limit', String(PAGE_SIZE));
    params.set('skip', String((pg - 1) * PAGE_SIZE));
    const res = await api.get(`/iptv-org/api/grouped?${params.toString()}`);
    const body = res.data;
    const data: GroupedChannel[] = (body.data || []).map(
      (ch: Omit<GroupedChannel, '_uid'> & { channelId: string }) => ({
        ...ch,
        _uid: ch.channelId,
      }),
    );
    setGroupedChannels(data);
    setGroupedTotal(body.total || data.length);
    setGroupedPage(pg);
  }

  // Compute unique filter options from loaded data
  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    channels.forEach((c) => {
      const cat = c.groupTitle || c.channelCategories?.[0];
      if (cat) set.add(cat);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [channels]);

  const languageOptions = useMemo(() => {
    const set = new Set<string>();
    channels.forEach((c) => {
      c.languages?.forEach((l) => {
        if (l) set.add(l);
      });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [channels]);

  const countryOptions = useMemo(() => {
    const set = new Set<string>();
    channels.forEach((c) => {
      if (c.country) set.add(c.country);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [channels]);

  // Reset column filters when channels change
  useEffect(() => {
    setSelectedCategories([]);
    setSelectedLanguages([]);
    setSelectedCountries([]);
  }, [channels]);

  // Sort accessor
  const sortAccessor = useCallback(
    (ch: EnrichedChannel) => {
      switch (sortField) {
        case 'name':
          return ch.channelName || '';
        case 'category':
          return ch.groupTitle || ch.channelCategories?.[0] || '';
        case 'language':
          return ch.languages?.[0] || '';
      }
    },
    [sortField],
  );

  // Filters config
  const filters = useMemo(
    () => [
      {
        accessor: (c: EnrichedChannel) => c.groupTitle || c.channelCategories?.[0] || '',
        selected: selectedCategories,
        allOptions: categoryOptions,
      },
      {
        accessor: (c: EnrichedChannel) => c.languages || [],
        selected: selectedLanguages,
        allOptions: languageOptions,
      },
      {
        accessor: (c: EnrichedChannel) => c.country || '',
        selected: selectedCountries,
        allOptions: countryOptions,
      },
      {
        accessor: (c: EnrichedChannel) => c.liveness?.status || 'unknown',
        selected: selectedStatuses,
        allOptions: ['alive', 'dead', 'unknown'],
      },
    ],
    [
      selectedCategories,
      categoryOptions,
      selectedLanguages,
      languageOptions,
      selectedCountries,
      countryOptions,
      selectedStatuses,
    ],
  );

  const searchFields = useMemo(
    () => [
      (c: EnrichedChannel) => c.channelName,
      (c: EnrichedChannel) => c.channelId,
      (c: EnrichedChannel) => c.groupTitle,
      (c: EnrichedChannel) => c.channelCategories?.join(' '),
      (c: EnrichedChannel) => c.languages?.join(' '),
    ],
    [],
  );

  const { filtered, paginated } = useClientSideTable({
    data: channels,
    search,
    searchFields,
    filters,
    sortAccessor,
    sortDir,
    page,
    pageSize: PAGE_SIZE,
  });

  const pageAllSelected = paginated.length > 0 && paginated.every((ch) => isSelected(ch._uid));

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
    setPage(1);
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  }

  async function handleImport() {
    if (selectedCount === 0) return;
    setImporting(true);
    setImportResult(null);

    const toImport = channels
      .filter((c) => isSelected(c._uid))
      .map((c) => ({
        channelName: c.channelName,
        channelUrl: c.channelUrl,
        tvgLogo: c.tvgLogo || '',
        channelGroup: c.groupTitle || c.channelCategories?.[0] || 'Imported',
        channelId: c.channelId,
        country: c.country || '',
        language: c.languages?.join(', ') || '',
        ...(isAdmin
          ? {
              streamQuality: c.streamQuality || '',
              channelNetwork: c.channelNetwork || '',
              channelWebsite: c.channelWebsite || '',
            }
          : {}),
      }));

    try {
      const endpoint = isAdmin ? '/iptv-org/import' : '/iptv-org/import-user';
      const payload = isAdmin ? { channels: toImport, replaceExisting } : { channels: toImport };
      const res = await api.post(endpoint, payload);
      const body = res.data;
      setImportResult(
        body.message ||
          (isAdmin
            ? `Imported ${body.importedCount || toImport.length} channels to system`
            : `Added ${body.addedCount} channels`),
      );
    } catch {
      setImportResult('Failed to import channels');
    } finally {
      setImporting(false);
    }
  }

  async function handleTestChannel(ch: EnrichedChannel) {
    const uid = ch._uid;
    setTestingChannelId(uid);
    try {
      const res = await api.post(`/iptv-org/check-liveness/${ch.channelId}`, {
        streamUrl: ch.channelUrl,
      });
      const result = res.data.data;
      if (result) {
        setChannels((prev) =>
          prev.map((c) =>
            c._uid === uid
              ? {
                  ...c,
                  liveness: {
                    status: result.status,
                    lastCheckedAt: new Date().toISOString(),
                    responseTimeMs: result.responseTimeMs,
                    error: result.error,
                  },
                }
              : c,
          ),
        );
      }
    } catch {
      // ignore
    } finally {
      setTestingChannelId(null);
    }
  }

  async function handleGroupedPageChange(newPage: number) {
    setFetchingChannels(true);
    try {
      await fetchGroupedChannels(buildGroupedParams(), newPage);
    } catch {
      toast('Failed to fetch channels', 'error');
    } finally {
      setFetchingChannels(false);
    }
  }

  function handleGroupedSearchChange(value: string) {
    setGroupedSearch(value);
    if (groupedSearchTimer.current) clearTimeout(groupedSearchTimer.current);
    groupedSearchTimer.current = setTimeout(async () => {
      setFetchingChannels(true);
      try {
        await fetchGroupedChannels(buildGroupedParams({ search: value }), 1);
      } catch {
        toast('Failed to fetch channels', 'error');
      } finally {
        setFetchingChannels(false);
      }
    }, 300);
  }

  async function handleGroupedStatusChange(value: string) {
    setGroupedStatus(value);
    setFetchingChannels(true);
    try {
      await fetchGroupedChannels(buildGroupedParams({ status: value }), 1);
    } catch {
      toast('Failed to fetch channels', 'error');
    } finally {
      setFetchingChannels(false);
    }
  }

  async function handleGroupedImport() {
    if (selectedCount === 0) return;
    setImporting(true);
    setImportResult(null);
    const toImport = groupedChannels
      .filter((ch) => isSelected(ch._uid))
      .map((ch) => {
        const primaryUrl = ch.bestStream?.streamUrl || ch.streams[0]?.streamUrl;
        const alternateStreams = ch.streams
          .filter((s) => s.streamUrl !== primaryUrl)
          .map((s) => ({
            streamUrl: s.streamUrl,
            quality: s.quality || null,
            liveness: s.liveness || { status: 'unknown' as const },
            userAgent: s.userAgent || null,
            referrer: s.referrer || null,
          }));
        return {
          channelId: ch.channelId,
          channelName: ch.channelName,
          selectedStreamUrl: primaryUrl,
          tvgLogo: ch.tvgLogo || '',
          channelGroup: ch.channelGroup || ch.categories?.[0] || 'Imported',
          metadata: { country: ch.country || '', language: ch.languageNames?.join(', ') || '' },
          alternateStreams,
        };
      });
    try {
      const endpoint = isAdmin ? '/iptv-org/import-grouped' : '/iptv-org/import-grouped-user';
      const payload = isAdmin ? { channels: toImport, replaceExisting } : { channels: toImport };
      const res = await api.post(endpoint, payload);
      setImportResult(res.data.message || `Imported ${toImport.length} channels with alternates`);
    } catch {
      setImportResult('Failed to import channels');
    } finally {
      setImporting(false);
    }
  }

  async function handleTestGroupedStream(channelId: string, stream: GroupedStream) {
    setTestingStreamUrl(stream.streamUrl);
    try {
      const res = await api.post(`/iptv-org/check-liveness/${channelId}`, {
        streamUrl: stream.streamUrl,
      });
      const result = res.data.data;
      if (result) {
        setGroupedChannels((prev) =>
          prev.map((ch) => {
            if (ch.channelId !== channelId) return ch;
            return {
              ...ch,
              streams: ch.streams.map((s) =>
                s.streamUrl === stream.streamUrl
                  ? {
                      ...s,
                      liveness: {
                        status: result.status,
                        lastCheckedAt: new Date().toISOString(),
                        responseTimeMs: result.responseTimeMs,
                        error: result.error,
                      },
                    }
                  : s,
              ),
              bestStream:
                ch.bestStream.streamUrl === stream.streamUrl
                  ? {
                      ...ch.bestStream,
                      liveness: {
                        status: result.status,
                        lastCheckedAt: new Date().toISOString(),
                        responseTimeMs: result.responseTimeMs,
                        error: result.error,
                      },
                    }
                  : ch.bestStream,
            };
          }),
        );
      }
    } catch {
      /* ignore */
    } finally {
      setTestingStreamUrl(null);
    }
  }

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (groupedSearchTimer.current) clearTimeout(groupedSearchTimer.current);
    };
  }, []);

  async function handleBatchLivenessCheck() {
    setBatchTesting(true);
    try {
      await api.post('/iptv-org/check-liveness');
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const res = await api.get('/iptv-org/liveness-status');
          const data = res.data.data;
          setLivenessStats(data?.livenessStats || null);
          if (!data?.livenessCheckInProgress) {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            setBatchTesting(false);
          }
        } catch {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setBatchTesting(false);
        }
      }, 5000);
    } catch {
      setBatchTesting(false);
    }
  }

  async function handleClearCache() {
    try {
      await api.post('/iptv-org/clear-cache');
      if (isAdmin) setLivenessStats(null);
      toast('Cache cleared', 'success');
    } catch {
      toast('Failed to clear cache', 'error');
    }
  }

  // Client-side liveness stats (used for user mode)
  const channelLivenessStats = useMemo(() => {
    if (channels.length === 0) return null;
    const alive = channels.filter((c) => c.liveness?.status === 'alive').length;
    const dead = channels.filter((c) => c.liveness?.status === 'dead').length;
    const unknown = channels.length - alive - dead;
    return { alive, dead, unknown };
  }, [channels]);

  // Use server stats for admin (global), client-side stats for user (loaded channels)
  const displayStats = isAdmin ? livenessStats : channelLivenessStats;

  // Detail modal fields
  const detailFields: ChannelField[] = detailChannel
    ? [
        { label: 'Stream URL', value: detailChannel.channelUrl },
        ...(isAdmin
          ? [{ label: 'Logo URL', value: detailChannel.tvgLogo || detailChannel.channelImg }]
          : []),
        {
          label: 'Group / Category',
          value: detailChannel.groupTitle || detailChannel.channelCategories?.join(', '),
        },
        { label: 'Language', value: detailChannel.languages?.join(', ') },
        { label: 'Country', value: detailChannel.country },
        ...(isAdmin
          ? [
              { label: 'Quality', value: detailChannel.streamQuality },
              { label: 'Network', value: detailChannel.channelNetwork },
              { label: 'Website', value: detailChannel.channelWebsite },
              { label: 'User Agent', value: detailChannel.streamUserAgent },
              { label: 'Referrer', value: detailChannel.streamReferrer },
              { label: 'NSFW', value: detailChannel.channelIsNsfw ? 'Yes' : undefined },
              { label: 'Launched', value: detailChannel.channelLaunched },
            ]
          : []),
      ]
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const gridTemplate = '40px 44px 1fr 160px 100px 120px 80px 100px';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-display font-bold uppercase tracking-[0.1em]">
            Import from IPTV-org
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAdmin
              ? 'Import channels from iptv-org to the system database'
              : 'Auto-fetch channels from iptv-org.github.io'}
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setGroupedMode(!groupedMode);
                setChannels([]);
                setGroupedChannels([]);
                unselectAll();
                setSelectedPlaylist(null);
              }}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-2 transition-colors uppercase tracking-[0.1em] ${
                groupedMode
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card shadow-sm hover:border-primary/40'
              }`}
            >
              {groupedMode ? <Layers className="h-4 w-4" /> : <List className="h-4 w-4" />}
              {groupedMode ? 'Grouped' : 'Flat'}
            </button>
            <button
              onClick={handleClearCache}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-2 border-border bg-card shadow-sm transition-colors hover:border-primary/40 uppercase tracking-[0.1em]"
            >
              <RefreshCw className="h-4 w-4" /> Clear Cache
            </button>
          </div>
        )}
      </div>

      {displayStats && <LivenessStatsBar stats={displayStats} inProgress={batchTesting} />}

      {regions.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">
            Select Region
          </p>
          <div className="flex flex-wrap gap-2">
            {(showAllRegions ? regions : regions.slice(0, 5)).map((r) => (
              <button
                key={r.code}
                onClick={() => handleSelectRegion(r.code)}
                className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-2 transition-colors ${
                  selectedRegion === r.code
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card shadow-sm hover:border-primary/40'
                }`}
              >
                {regionDisplayNames[r.code]}
                <span className="text-muted-foreground text-xs">({r.channelCount})</span>
              </button>
            ))}
          </div>
          {!showAllRegions && regions.length > 5 && (
            <button
              onClick={() => setShowAllRegions(true)}
              className="mt-3 text-xs text-primary hover:text-primary/80 uppercase tracking-[0.1em] font-medium"
            >
              Show all regions ({regions.length - 5} more)
            </button>
          )}
          {showAllRegions && (
            <button
              onClick={() => setShowAllRegions(false)}
              className="mt-3 text-xs text-primary hover:text-primary/80 uppercase tracking-[0.1em] font-medium"
            >
              Show fewer regions
            </button>
          )}
        </div>
      )}

      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">
          Select a Playlist
        </p>
        <div className="flex flex-wrap gap-2">
          {playlists.map((pl) => (
            <button
              key={pl.id}
              onClick={() => handleSelectPlaylist(pl)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-2 transition-colors ${
                selectedPlaylist === pl.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card shadow-sm hover:border-primary/40'
              }`}
            >
              <Globe className="h-3.5 w-3.5" aria-hidden="true" />
              {pl.name}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {fetchingChannels && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Fetching channels...</span>
        </div>
      )}

      {/* Grouped Datatable */}
      {!fetchingChannels &&
        groupedMode &&
        (groupedChannels.length > 0 || groupedSearch || groupedStatus) && (
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <SearchInput
                  value={groupedSearch}
                  onChange={handleGroupedSearchChange}
                  placeholder="Search by name or ID..."
                  ariaLabel="Search grouped channels"
                  className="flex-1 max-w-full sm:max-w-md w-full"
                />
                <div className="flex items-center gap-2 flex-wrap">
                  {isAdmin && (
                    <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={replaceExisting}
                        onChange={(e) => setReplaceExisting(e.target.checked)}
                        className="accent-primary"
                      />
                      Replace existing
                    </label>
                  )}
                  <button
                    onClick={handleGroupedImport}
                    disabled={importing || selectedCount === 0}
                    className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium bg-primary text-primary-foreground uppercase tracking-[0.1em] transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <Download className="h-4 w-4 shrink-0" />
                    {importing
                      ? 'Importing...'
                      : `Import ${selectedCount} to ${isAdmin ? 'System' : 'My List'}`}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">{groupedTotal} channels</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-xs uppercase tracking-[0.1em] text-muted-foreground">
                  Status:
                </span>
                {['', 'alive', 'dead', 'unknown'].map((s) => (
                  <button
                    key={s}
                    onClick={() => handleGroupedStatusChange(s)}
                    className={`text-xs px-2 py-1 border transition-colors ${
                      groupedStatus === s
                        ? 'border-primary bg-primary/10 text-primary font-medium'
                        : 'border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {s === ''
                      ? `All`
                      : s === 'alive'
                        ? '● Alive'
                        : s === 'dead'
                          ? '● Dead'
                          : '● Unknown'}
                  </button>
                ))}
              </div>
            </div>

            {/* Selection bar */}
            <SelectionToolbar
              totalFiltered={groupedChannels.length}
              totalUnfiltered={groupedTotal}
              selectedCount={selectedCount}
              onSelectPage={() => selectMany(groupedChannels.map((ch) => ch._uid))}
              onUnselectPage={() => unselectMany(groupedChannels.map((ch) => ch._uid))}
              onSelectAll={() => selectMany(groupedChannels.map((ch) => ch._uid))}
              onUnselectAll={unselectAll}
              isFiltered={false}
            />

            {importResult && (
              <div
                role="alert"
                aria-live="polite"
                className="border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary"
              >
                {importResult}
              </div>
            )}

            {/* Grouped Table */}
            <div className="border border-border bg-card">
              {/* Header */}
              <div
                className="hidden lg:grid items-center px-3 py-2 border-b border-border bg-muted/30 text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium"
                style={{ gridTemplateColumns: '40px 44px 1fr 140px 100px 80px 100px' }}
              >
                <div className="flex items-center justify-center">
                  <button
                    onClick={() => {
                      const allIds = groupedChannels.map((ch) => ch._uid);
                      const allSelected = groupedChannels.every((ch) => isSelected(ch._uid));
                      if (allSelected) {
                        unselectMany(allIds);
                      } else {
                        selectMany(allIds);
                      }
                    }}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Toggle page selection"
                  >
                    {groupedChannels.every((ch) => isSelected(ch._uid)) ? (
                      <CheckSquare className="h-4 w-4 text-primary" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <span />
                <span>Name</span>
                <span>Category</span>
                <span>Country</span>
                <span>Streams</span>
                <span>Best Status</span>
              </div>

              {/* Rows */}
              {groupedChannels.map((ch) => (
                <div key={ch._uid} className={isSelected(ch._uid) ? 'bg-primary/5' : ''}>
                  <div
                    className="flex items-center gap-2 px-3 py-2 border-b border-border/50 lg:grid"
                    style={{ gridTemplateColumns: '40px 44px 1fr 140px 100px 80px 100px' }}
                  >
                    <div className="flex items-center justify-center shrink-0">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={isSelected(ch._uid)}
                        onClick={() => toggleOne(ch._uid)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {isSelected(ch._uid) ? (
                          <CheckSquare className="h-4 w-4 text-primary" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <ChannelLogo src={ch.tvgLogo} alt={`${ch.channelName} logo`} />
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium truncate block">{ch.channelName}</span>
                      <span className="text-xs text-muted-foreground font-mono truncate block">
                        {ch.channelId}
                      </span>
                    </div>
                    <span className="hidden lg:block text-xs text-muted-foreground truncate">
                      {ch.channelGroup || ch.categories?.[0] || '—'}
                    </span>
                    <span className="hidden lg:block text-xs text-muted-foreground truncate">
                      {ch.country || '—'}
                    </span>
                    <span className="hidden lg:block text-xs text-muted-foreground">
                      {ch.streamCount}
                    </span>
                    <div className="hidden lg:flex items-center gap-1.5">
                      <StatusDot status={ch.bestStream?.liveness?.status || 'unknown'} />
                    </div>
                  </div>
                  <GroupedStreamRow
                    streams={ch.streams}
                    onTestStream={
                      isAdmin
                        ? (stream) => handleTestGroupedStream(ch.channelId, stream)
                        : undefined
                    }
                    testingStreamUrl={testingStreamUrl}
                  />
                </div>
              ))}

              {groupedChannels.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No channels found
                </div>
              )}
            </div>

            <Pagination
              page={groupedPage}
              pageSize={PAGE_SIZE}
              totalCount={groupedTotal}
              onPageChange={handleGroupedPageChange}
            />
          </div>
        )}

      {/* Flat Datatable */}
      {!fetchingChannels && !groupedMode && channels.length > 0 && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <SearchInput
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
              placeholder="Search by name, category, language, or ID..."
              ariaLabel="Search channels"
              className="flex-1 max-w-md w-full"
            />
            <div className="flex items-center gap-2 flex-wrap">
              {isAdmin && (
                <>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={replaceExisting}
                      onChange={(e) => setReplaceExisting(e.target.checked)}
                      className="accent-primary"
                    />
                    Replace existing
                  </label>
                  <button
                    onClick={handleBatchLivenessCheck}
                    disabled={batchTesting}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border border-border bg-card text-foreground uppercase tracking-[0.1em] transition-colors hover:bg-muted disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {batchTesting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4" />
                    )}
                    {batchTesting ? 'Checking...' : 'Check Liveness'}
                  </button>
                </>
              )}
              <button
                onClick={handleImport}
                disabled={importing || selectedCount === 0}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-primary text-primary-foreground uppercase tracking-[0.1em] transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none"
              >
                <Download className="h-4 w-4" />
                {importing
                  ? 'Importing...'
                  : `Import ${selectedCount} to ${isAdmin ? 'System' : 'My List'}`}
              </button>
            </div>
          </div>

          {/* Selection bar */}
          <SelectionToolbar
            totalFiltered={filtered.length}
            totalUnfiltered={channels.length}
            selectedCount={selectedCount}
            onSelectPage={() => selectMany(paginated.map((ch) => ch._uid))}
            onUnselectPage={() => unselectMany(paginated.map((ch) => ch._uid))}
            onSelectAll={() => selectMany(filtered.map((ch) => ch._uid))}
            onUnselectAll={unselectAll}
            isFiltered={!!search}
          />

          {importResult && (
            <div
              role="alert"
              aria-live="polite"
              className="border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary"
            >
              {importResult}
            </div>
          )}

          {/* Table */}
          <DataTable<EnrichedChannel>
            data={paginated}
            gridTemplate={gridTemplate}
            ariaLabel="Import channels table"
            emptyMessage={search ? 'No channels match your search' : 'No channels found'}
            rowKey={(ch) => ch._uid}
            rowClassName={(ch) => (isSelected(ch._uid) ? 'bg-primary/5' : '')}
            columns={
              [
                {
                  key: 'select',
                  header: (
                    <div className="flex items-center justify-center">
                      <button
                        onClick={() =>
                          pageAllSelected
                            ? unselectMany(paginated.map((ch) => ch._uid))
                            : selectMany(paginated.map((ch) => ch._uid))
                        }
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Toggle page selection"
                      >
                        {pageAllSelected ? (
                          <CheckSquare className="h-4 w-4 text-primary" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  ),
                  cell: (ch) => (
                    <div className="flex items-center justify-center">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={isSelected(ch._uid)}
                        onClick={() => toggleOne(ch._uid)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {isSelected(ch._uid) ? (
                          <CheckSquare className="h-4 w-4 text-primary" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  ),
                },
                {
                  key: 'logo',
                  header: <span />,
                  cell: (ch) => <ChannelLogo src={ch.tvgLogo} alt={`${ch.channelName} logo`} />,
                },
                {
                  key: 'name',
                  ariaSort:
                    sortField === 'name'
                      ? sortDir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none',
                  header: (
                    <button
                      onClick={() => handleSort('name')}
                      aria-label="Sort by name"
                      className="relative inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium hover:text-foreground transition-colors text-left"
                    >
                      Name <SortIcon field="name" />
                    </button>
                  ),
                  cell: (ch) => (
                    <div className="min-w-0">
                      <span className="text-sm font-medium truncate block">{ch.channelName}</span>
                      <span className="text-xs text-muted-foreground font-mono truncate block lg:hidden">
                        {ch.channelId}
                      </span>
                    </div>
                  ),
                },
                {
                  key: 'category',
                  ariaSort:
                    sortField === 'category'
                      ? sortDir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none',
                  header: (
                    <div className="relative inline-flex items-center gap-1.5">
                      <button
                        onClick={() => handleSort('category')}
                        aria-label="Sort by category"
                        className="relative inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium hover:text-foreground transition-colors text-left"
                      >
                        Category <SortIcon field="category" />
                      </button>
                      <ColumnFilter
                        label=""
                        options={categoryOptions}
                        selected={selectedCategories}
                        onChange={(v) => {
                          setSelectedCategories(v);
                          setPage(1);
                        }}
                        searchable
                      />
                    </div>
                  ),
                  cell: (ch) => (
                    <span className="text-xs text-muted-foreground truncate">
                      {ch.groupTitle || ch.channelCategories?.join(', ') || '—'}
                    </span>
                  ),
                },
                {
                  key: 'country',
                  header: (
                    <ColumnFilter
                      label="Country"
                      options={countryOptions}
                      selected={selectedCountries}
                      onChange={(v) => {
                        setSelectedCountries(v);
                        setPage(1);
                      }}
                      searchable
                    />
                  ),
                  cell: (ch) => (
                    <span className="text-xs text-muted-foreground truncate">
                      {ch.country || '—'}
                    </span>
                  ),
                },
                {
                  key: 'language',
                  ariaSort:
                    sortField === 'language'
                      ? sortDir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none',
                  header: (
                    <div className="relative inline-flex items-center gap-1.5">
                      <button
                        onClick={() => handleSort('language')}
                        aria-label="Sort by language"
                        className="relative inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium hover:text-foreground transition-colors text-left"
                      >
                        Language <SortIcon field="language" />
                      </button>
                      <ColumnFilter
                        label=""
                        options={languageOptions}
                        selected={selectedLanguages}
                        onChange={(v) => {
                          setSelectedLanguages(v);
                          setPage(1);
                        }}
                        searchable
                      />
                    </div>
                  ),
                  cell: (ch) => (
                    <span className="text-xs text-muted-foreground truncate">
                      {ch.languages?.length
                        ? ch.languages.length <= 2
                          ? ch.languages.join(', ')
                          : `${ch.languages.slice(0, 2).join(', ')} +${ch.languages.length - 2}`
                        : '—'}
                    </span>
                  ),
                },
                {
                  key: 'status',
                  header: (
                    <ColumnFilter
                      label="Status"
                      options={['alive', 'dead', 'unknown']}
                      selected={selectedStatuses}
                      onChange={(v: string[]) => {
                        setSelectedStatuses(v);
                        setPage(1);
                      }}
                    />
                  ),
                  cell: (ch: EnrichedChannel) => (
                    <div className="relative inline-flex items-center gap-1.5">
                      {testingChannelId === ch._uid ? (
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                      ) : (
                        <StatusDot status={ch.liveness?.status || 'unknown'} />
                      )}
                      <button
                        onClick={() => handleTestChannel(ch)}
                        disabled={testingChannelId === ch._uid}
                        className="flex items-center justify-center h-6 w-6 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                        title="Test stream"
                      >
                        <Zap className="h-3 w-3" />
                      </button>
                    </div>
                  ),
                },
                {
                  key: 'actions',
                  headerClassName: 'text-right',
                  header: (
                    <span className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium">
                      Actions
                    </span>
                  ),
                  cell: (ch) => (
                    <ChannelRowActions
                      onDetail={() => setDetailChannel(ch)}
                      onPlay={ch.channelUrl ? () => handlePlay(ch) : undefined}
                    />
                  ),
                },
              ] satisfies DataTableColumn<EnrichedChannel>[]
            }
          />

          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            totalCount={filtered.length}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Detail Modal */}
      <ChannelDetailModal
        open={!!detailChannel}
        onClose={() => setDetailChannel(null)}
        channel={detailChannel}
        fields={detailFields}
        onPlay={
          detailChannel?.channelUrl
            ? () => {
                const ch = detailChannel!;
                setDetailChannel(null);
                handlePlay(ch);
              }
            : undefined
        }
        showRawData={isAdmin}
        rawData={
          isAdmin && detailChannel
            ? Object.fromEntries(Object.entries(detailChannel).filter(([k]) => k !== '_uid'))
            : undefined
        }
        actions={
          detailChannel && (
            <button
              onClick={() => toggleOne(detailChannel._uid)}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium border border-border uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground transition-colors"
            >
              {isSelected(detailChannel._uid) ? (
                <>
                  <CheckSquare className="h-4 w-4 text-primary" />
                  Selected
                </>
              ) : (
                <>
                  <Square className="h-4 w-4" />
                  Select for Import
                </>
              )}
            </button>
          )
        }
      />
    </div>
  );
}
