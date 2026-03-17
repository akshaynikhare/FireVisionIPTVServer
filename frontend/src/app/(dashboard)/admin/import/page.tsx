'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Loader2,
  Globe,
  RefreshCw,
  Download,
  Eye,
  Play,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckSquare,
  Square,
  Activity,
  Zap,
} from 'lucide-react';
import api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useBulkSelection } from '@/hooks/use-bulk-selection';
import { useClientSideTable } from '@/hooks/use-client-side-table';
import Pagination from '@/components/ui/pagination';
import ColumnFilter from '@/components/ui/column-filter';
import SearchInput from '@/components/ui/search-input';
import SelectionToolbar from '@/components/ui/selection-toolbar';
import StatusDot from '@/components/ui/status-dot';
import ChannelLogo from '@/components/ui/channel-logo';
import ChannelDetailModal, { type ChannelField } from '@/components/channel-detail-modal';
import { useStreamPlayer } from '@/components/stream-player-context';

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

type SortField = 'name' | 'category' | 'language';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 50;

export default function AdminImportPage() {
  const { toast } = useToast();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null);
  const [channels, setChannels] = useState<EnrichedChannel[]>([]);
  const [fetchingChannels, setFetchingChannels] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(false);

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

  // Liveness testing
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

  useEffect(() => {
    async function fetchPlaylists() {
      try {
        const res = await api.get('/iptv-org/playlists');
        setPlaylists(res.data.data || []);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchPlaylists();
    fetchLivenessStats();
  }, []);

  async function fetchLivenessStats() {
    try {
      const res = await api.get('/iptv-org/liveness-status');
      setLivenessStats(res.data.data?.livenessStats || null);
      setBatchTesting(res.data.data?.livenessCheckInProgress || false);
    } catch {
      // ignore
    }
  }

  async function handleSelectPlaylist(playlist: Playlist) {
    setSelectedPlaylist(playlist.id);
    setFetchingChannels(true);
    setChannels([]);
    unselectAll();
    setImportResult(null);
    setSearch('');
    setPage(1);

    try {
      const params = new URLSearchParams();
      const f = playlist.filter;
      if (f?.country) params.set('country', f.country);
      if (f?.languages?.length) params.set('languages', f.languages.join(','));
      else if (f?.language) params.set('language', f.language);
      if (f?.categories?.length) params.set('category', f.categories.join(','));
      else if (f?.category) params.set('category', f.category);

      const res = await api.get(`/iptv-org/fetch?${params.toString()}`);
      const data = (res.data.data || []).map((ch: Omit<EnrichedChannel, '_uid'>, i: number) => ({
        ...ch,
        _uid: String(i),
      }));
      setChannels(data);
    } catch {
      toast('Failed to fetch channels', 'error');
    } finally {
      setFetchingChannels(false);
    }
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

  async function handleImportToSystem() {
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
        streamQuality: c.streamQuality || '',
        channelNetwork: c.channelNetwork || '',
        channelWebsite: c.channelWebsite || '',
      }));

    try {
      const res = await api.post('/iptv-org/import', { channels: toImport, replaceExisting });
      const body = res.data;
      setImportResult(
        body.message || `Imported ${body.importedCount || toImport.length} channels to system`,
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

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
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
      setLivenessStats(null);
      toast('Cache cleared', 'success');
    } catch {
      toast('Failed to clear cache', 'error');
    }
  }

  // Detail modal fields
  const detailFields: ChannelField[] = detailChannel
    ? [
        { label: 'Stream URL', value: detailChannel.channelUrl },
        { label: 'Logo URL', value: detailChannel.tvgLogo || detailChannel.channelImg },
        {
          label: 'Group / Category',
          value: detailChannel.groupTitle || detailChannel.channelCategories?.join(', '),
        },
        { label: 'Language', value: detailChannel.languages?.join(', ') },
        { label: 'Country', value: detailChannel.country },
        { label: 'Quality', value: detailChannel.streamQuality },
        { label: 'Network', value: detailChannel.channelNetwork },
        { label: 'Website', value: detailChannel.channelWebsite },
        { label: 'User Agent', value: detailChannel.streamUserAgent },
        { label: 'Referrer', value: detailChannel.streamReferrer },
        { label: 'NSFW', value: detailChannel.channelIsNsfw ? 'Yes' : undefined },
        { label: 'Launched', value: detailChannel.channelLaunched },
      ]
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-display font-bold uppercase tracking-[0.1em]">
            Import from IPTV-org
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Import channels from iptv-org to the system database
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleBatchLivenessCheck}
            disabled={batchTesting}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-2 border-border bg-card shadow-sm transition-colors hover:border-primary/40 uppercase tracking-[0.1em] disabled:opacity-50"
          >
            {batchTesting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Activity className="h-4 w-4" />
            )}
            {batchTesting ? 'Checking...' : 'Check Liveness'}
          </button>
          <button
            onClick={handleClearCache}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-2 border-border bg-card shadow-sm transition-colors hover:border-primary/40 uppercase tracking-[0.1em]"
          >
            <RefreshCw className="h-4 w-4" /> Clear Cache
          </button>
        </div>
      </div>

      {/* Liveness Stats */}
      {livenessStats && (
        <div className="flex items-center gap-4 px-4 py-2.5 border border-border bg-card">
          <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Stream Health
          </span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs">
              <StatusDot status="alive" showLabel={false} size="md" />
              <span className="font-medium">{livenessStats.alive}</span>
              <span className="text-muted-foreground">alive</span>
            </span>
            <span className="flex items-center gap-1.5 text-xs">
              <StatusDot status="dead" showLabel={false} size="md" />
              <span className="font-medium">{livenessStats.dead}</span>
              <span className="text-muted-foreground">dead</span>
            </span>
            <span className="flex items-center gap-1.5 text-xs">
              <StatusDot status="unknown" showLabel={false} size="md" />
              <span className="font-medium">{livenessStats.unknown}</span>
              <span className="text-muted-foreground">unknown</span>
            </span>
          </div>
          {batchTesting && (
            <span className="text-xs text-muted-foreground animate-pulse">
              Batch check in progress...
            </span>
          )}
        </div>
      )}

      {/* Playlist buttons */}
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

      {/* Datatable */}
      {!fetchingChannels && channels.length > 0 && (
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
                onClick={handleImportToSystem}
                disabled={importing || selectedCount === 0}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-primary text-primary-foreground uppercase tracking-[0.1em] transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none"
              >
                <Download className="h-4 w-4" />
                {importing ? 'Importing...' : `Import ${selectedCount} to System`}
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
            <div className="border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary">
              {importResult}
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <div role="table" aria-label="Import channels table" className="border border-border">
              {/* Table header */}
              <div
                role="rowgroup"
                className="hidden lg:grid grid-cols-[40px,44px,1fr,160px,100px,120px,80px,100px] gap-2 px-4 py-2 bg-muted/50 border-b border-border"
              >
                <div role="columnheader" className="flex items-center justify-center">
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
                <span role="columnheader" />
                <button
                  role="columnheader"
                  aria-sort={
                    sortField === 'name' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'
                  }
                  aria-label="Sort by name"
                  onClick={() => handleSort('name')}
                  className="flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium hover:text-foreground transition-colors text-left"
                >
                  Name <SortIcon field="name" />
                </button>
                <div
                  role="columnheader"
                  aria-sort={
                    sortField === 'category'
                      ? sortDir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                  className="flex items-center gap-1"
                >
                  <button
                    onClick={() => handleSort('category')}
                    aria-label="Sort by category"
                    className="flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium hover:text-foreground transition-colors text-left"
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
                <span role="columnheader">
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
                </span>
                <div
                  role="columnheader"
                  aria-sort={
                    sortField === 'language'
                      ? sortDir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                  className="flex items-center gap-1"
                >
                  <button
                    onClick={() => handleSort('language')}
                    aria-label="Sort by language"
                    className="flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium hover:text-foreground transition-colors text-left"
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
                <span role="columnheader">
                  <ColumnFilter
                    label="Status"
                    options={['alive', 'dead', 'unknown']}
                    selected={selectedStatuses}
                    onChange={(v) => {
                      setSelectedStatuses(v);
                      setPage(1);
                    }}
                  />
                </span>
                <span
                  role="columnheader"
                  className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium text-right"
                >
                  Actions
                </span>
              </div>

              {/* Rows */}
              <div role="rowgroup" className="divide-y divide-border">
                {paginated.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    {search ? 'No channels match your search' : 'No channels found'}
                  </div>
                ) : (
                  paginated.map((ch) => {
                    const key = ch._uid;
                    const selected = isSelected(key);
                    return (
                      <div
                        key={key}
                        role="row"
                        className={`grid lg:grid-cols-[40px,44px,1fr,160px,100px,120px,80px,100px] gap-2 items-center px-4 py-2.5 transition-colors hover:bg-muted/50 ${
                          selected ? 'bg-primary/5' : ''
                        }`}
                      >
                        <div role="cell" className="flex items-center justify-center">
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={selected}
                            onClick={() => toggleOne(key)}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {selected ? (
                              <CheckSquare className="h-4 w-4 text-primary" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                          </button>
                        </div>

                        <div role="cell">
                          <ChannelLogo src={ch.tvgLogo} alt={`${ch.channelName} logo`} />
                        </div>

                        <div role="cell" className="min-w-0">
                          <span className="text-sm font-medium truncate block">
                            {ch.channelName}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono truncate block lg:hidden">
                            {ch.channelId}
                          </span>
                        </div>

                        <span role="cell" className="text-xs text-muted-foreground truncate">
                          {ch.groupTitle || ch.channelCategories?.join(', ') || '—'}
                        </span>

                        <span role="cell" className="text-xs text-muted-foreground truncate">
                          {ch.country || '—'}
                        </span>

                        <span role="cell" className="text-xs text-muted-foreground truncate">
                          {ch.languages?.join(', ') || '—'}
                        </span>

                        {/* Status badge + test */}
                        <div role="cell" className="flex items-center gap-1.5">
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

                        <div role="cell" className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setDetailChannel(ch)}
                            className="flex items-center justify-center h-8 w-8 text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="View details"
                            title="Channel info"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {ch.channelUrl && (
                            <button
                              onClick={() =>
                                playStream(
                                  { name: ch.channelName || 'Stream Preview', url: ch.channelUrl },
                                  { mode: 'direct-fallback' },
                                )
                              }
                              className="flex items-center justify-center h-8 w-8 text-muted-foreground hover:text-primary transition-colors"
                              aria-label="Preview stream"
                              title="Preview stream"
                            >
                              <Play className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

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
                playStream(
                  { name: ch.channelName || 'Stream Preview', url: ch.channelUrl },
                  { mode: 'direct-fallback' },
                );
              }
            : undefined
        }
        showRawData
        rawData={
          detailChannel
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
