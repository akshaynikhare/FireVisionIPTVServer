'use client';

import { useEffect, useMemo, useState } from 'react';
import { isSafeImageUrl } from '@/lib/safe-url';
import {
  Loader2,
  Globe,
  RefreshCw,
  Download,
  Search,
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
import { proxyImageUrl } from '@/lib/image-proxy';
import { useToast } from '@/hooks/use-toast';
import Pagination from '@/components/ui/pagination';
import Modal from '@/components/ui/modal';
import ColumnFilter from '@/components/ui/column-filter';
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(false);

  // Datatable state
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);

  // Column filter state (client-side for import since data is from external API)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);

  // Status filter
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
    setSelectedIds(new Set());
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
      // Don't auto-select all — let user choose
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

  // Reset column filters when channels change (new playlist selected)
  useEffect(() => {
    setSelectedCategories([]);
    setSelectedLanguages([]);
    setSelectedCountries([]);
  }, [channels]);

  // Filtered + sorted + paginated — single useMemo to avoid stale chaining
  const { filtered, paginated } = useMemo(() => {
    let result = channels;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.channelName?.toLowerCase().includes(q) ||
          c.channelId?.toLowerCase().includes(q) ||
          c.groupTitle?.toLowerCase().includes(q) ||
          c.channelCategories?.some((cat) => cat.toLowerCase().includes(q)) ||
          c.languages?.some((lang) => lang.toLowerCase().includes(q)),
      );
    }

    // Apply column filters
    if (selectedCategories.length > 0 && selectedCategories.length < categoryOptions.length) {
      result = result.filter((c) => {
        const cat = c.groupTitle || c.channelCategories?.[0] || '';
        return selectedCategories.includes(cat);
      });
    }
    if (selectedLanguages.length > 0 && selectedLanguages.length < languageOptions.length) {
      result = result.filter((c) => c.languages?.some((l) => selectedLanguages.includes(l)));
    }
    if (selectedCountries.length > 0 && selectedCountries.length < countryOptions.length) {
      result = result.filter((c) => selectedCountries.includes(c.country || ''));
    }

    // Status filter
    const statusOptions = ['alive', 'dead', 'unknown'];
    if (selectedStatuses.length > 0 && selectedStatuses.length < statusOptions.length) {
      result = result.filter((c) => selectedStatuses.includes(c.liveness?.status || 'unknown'));
    }

    const sorted = [...result].sort((a, b) => {
      let valA = '';
      let valB = '';
      switch (sortField) {
        case 'name':
          valA = a.channelName || '';
          valB = b.channelName || '';
          break;
        case 'category':
          valA = a.groupTitle || a.channelCategories?.[0] || '';
          valB = b.groupTitle || b.channelCategories?.[0] || '';
          break;
        case 'language':
          valA = a.languages?.[0] || '';
          valB = b.languages?.[0] || '';
          break;
      }
      const cmp = valA.localeCompare(valB, undefined, { sensitivity: 'base' });
      return sortDir === 'asc' ? cmp : -cmp;
    });

    const sliced = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    return { filtered: sorted, paginated: sliced };
  }, [
    channels,
    search,
    sortField,
    sortDir,
    page,
    selectedCategories,
    selectedLanguages,
    selectedCountries,
    selectedStatuses,
    categoryOptions,
    languageOptions,
    countryOptions,
  ]);

  function getKey(ch: EnrichedChannel) {
    return ch._uid;
  }

  function toggleOne(ch: EnrichedChannel) {
    const key = getKey(ch);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectAllFiltered() {
    const keys = filtered.map(getKey);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => next.add(k));
      return next;
    });
  }

  function unselectAll() {
    setSelectedIds(new Set());
  }

  function selectPage() {
    const keys = paginated.map(getKey);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => next.add(k));
      return next;
    });
  }

  function unselectPage() {
    const keys = new Set(paginated.map(getKey));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => next.delete(k));
      return next;
    });
  }

  const pageAllSelected =
    paginated.length > 0 && paginated.every((ch) => selectedIds.has(getKey(ch)));

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
    if (selectedIds.size === 0) return;
    setImporting(true);
    setImportResult(null);

    const toImport = channels
      .filter((c) => selectedIds.has(getKey(c)))
      .map((c) => ({
        channelName: c.channelName,
        channelUrl: c.channelUrl,
        tvgLogo: c.tvgLogo || '',
        channelGroup: c.groupTitle || c.channelCategories?.[0] || 'Imported',
        channelId: c.channelId,
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
        // Update the channel in local state with the new liveness result
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

  async function handleBatchLivenessCheck() {
    setBatchTesting(true);
    try {
      await api.post('/iptv-org/check-liveness');
      // Poll for status updates
      const poll = setInterval(async () => {
        try {
          const res = await api.get('/iptv-org/liveness-status');
          const data = res.data.data;
          setLivenessStats(data?.livenessStats || null);
          if (!data?.livenessCheckInProgress) {
            clearInterval(poll);
            setBatchTesting(false);
          }
        } catch {
          clearInterval(poll);
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
      <div className="flex items-center justify-between animate-fade-up">
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
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-2 border-border bg-card shadow-sm transition-all hover:border-primary/40 uppercase tracking-[0.1em] disabled:opacity-50"
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
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-2 border-border bg-card shadow-sm transition-all hover:border-primary/40 uppercase tracking-[0.1em]"
          >
            <RefreshCw className="h-4 w-4" /> Clear Cache
          </button>
        </div>
      </div>

      {/* Liveness Stats */}
      {livenessStats && (
        <div className="flex items-center gap-4 px-4 py-2.5 border border-border bg-card animate-fade-up">
          <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Stream Health
          </span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="font-medium">{livenessStats.alive}</span>
              <span className="text-muted-foreground">alive</span>
            </span>
            <span className="flex items-center gap-1.5 text-xs">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              <span className="font-medium">{livenessStats.dead}</span>
              <span className="text-muted-foreground">dead</span>
            </span>
            <span className="flex items-center gap-1.5 text-xs">
              <span className="h-2 w-2 rounded-full bg-zinc-400" />
              <span className="font-medium">{livenessStats.unknown}</span>
              <span className="text-muted-foreground">unknown</span>
            </span>
          </div>
          {batchTesting && (
            <span className="text-[11px] text-muted-foreground animate-pulse">
              Batch check in progress...
            </span>
          )}
        </div>
      )}

      {/* Playlist buttons */}
      <div className="animate-fade-up" style={{ animationDelay: '50ms' }}>
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-3">
          Select a Playlist
        </p>
        <div className="flex flex-wrap gap-2">
          {playlists.map((pl) => (
            <button
              key={pl.id}
              onClick={() => handleSelectPlaylist(pl)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-2 transition-all ${
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
        <div className="space-y-4 animate-fade-up" style={{ animationDelay: '100ms' }}>
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by name, category, language, or ID..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full h-10 pl-10 pr-4 border border-border bg-card text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
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
                disabled={importing || selectedIds.size === 0}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-primary text-primary-foreground uppercase tracking-[0.1em] transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none"
              >
                <Download className="h-4 w-4" />
                {importing ? 'Importing...' : `Import ${selectedIds.size} to System`}
              </button>
            </div>
          </div>

          {/* Selection bar */}
          <div className="flex items-center justify-between px-1 flex-wrap gap-2">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              {filtered.length} channels
              {search && ` (filtered from ${channels.length})`} &middot;{' '}
              <span className="text-foreground font-medium">{selectedIds.size} selected</span>
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={selectPage}
                className="text-[11px] uppercase tracking-[0.1em] text-primary hover:text-primary/80 font-medium transition-colors"
              >
                Select Page
              </button>
              <button
                onClick={unselectPage}
                className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground font-medium transition-colors"
              >
                Unselect Page
              </button>
              <span className="w-px h-4 bg-border" />
              <button
                onClick={selectAllFiltered}
                className="text-[11px] uppercase tracking-[0.1em] text-primary hover:text-primary/80 font-medium transition-colors"
              >
                Select All ({filtered.length})
              </button>
              <button
                onClick={unselectAll}
                className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground font-medium transition-colors"
              >
                Unselect All
              </button>
            </div>
          </div>

          {importResult && (
            <div className="border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary">
              {importResult}
            </div>
          )}

          {/* Table */}
          <div className="border border-border">
            {/* Table header */}
            <div className="hidden lg:grid grid-cols-[40px,44px,1fr,160px,100px,120px,80px,100px] gap-2 px-4 py-2 bg-muted/50 border-b border-border">
              <div className="flex items-center justify-center">
                <button
                  onClick={() => (pageAllSelected ? unselectPage() : selectPage())}
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
              <span />
              <button
                onClick={() => handleSort('name')}
                className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium hover:text-foreground transition-colors text-left"
              >
                Name <SortIcon field="name" />
              </button>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleSort('category')}
                  className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium hover:text-foreground transition-colors text-left"
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
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleSort('language')}
                  className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium hover:text-foreground transition-colors text-left"
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
              <ColumnFilter
                label="Status"
                options={['alive', 'dead', 'unknown']}
                selected={selectedStatuses}
                onChange={(v) => {
                  setSelectedStatuses(v);
                  setPage(1);
                }}
              />
              <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium text-right">
                Actions
              </span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-border">
              {paginated.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {search ? 'No channels match your search' : 'No channels found'}
                </div>
              ) : (
                paginated.map((ch) => {
                  const key = getKey(ch);
                  const isSelected = selectedIds.has(key);
                  return (
                    <div
                      key={key}
                      className={`grid lg:grid-cols-[40px,44px,1fr,160px,100px,120px,80px,100px] gap-2 items-center px-4 py-2.5 transition-colors hover:bg-muted/50 ${
                        isSelected ? 'bg-primary/5' : ''
                      }`}
                    >
                      <div className="flex items-center justify-center">
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={isSelected}
                          onClick={() => toggleOne(ch)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4 text-primary" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </button>
                      </div>

                      <div>
                        {ch.tvgLogo ? (
                          <img
                            src={proxyImageUrl(ch.tvgLogo)}
                            alt=""
                            className="h-7 w-7 rounded-sm object-contain bg-muted"
                            onError={(e) => {
                              const img = e.currentTarget;
                              if (
                                !img.dataset.fallback &&
                                ch.tvgLogo &&
                                isSafeImageUrl(ch.tvgLogo)
                              ) {
                                img.dataset.fallback = '1';
                                img.src = ch.tvgLogo;
                              }
                            }}
                          />
                        ) : (
                          <div className="h-7 w-7 rounded-sm bg-muted" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <span className="text-sm font-medium truncate block">{ch.channelName}</span>
                        <span className="text-[11px] text-muted-foreground font-mono truncate block lg:hidden">
                          {ch.channelId}
                        </span>
                      </div>

                      <span className="text-xs text-muted-foreground truncate">
                        {ch.groupTitle || ch.channelCategories?.join(', ') || '—'}
                      </span>

                      <span className="text-xs text-muted-foreground truncate">
                        {ch.country || '—'}
                      </span>

                      <span className="text-xs text-muted-foreground truncate">
                        {ch.languages?.join(', ') || '—'}
                      </span>

                      {/* Status badge + test */}
                      <div className="flex items-center gap-1.5">
                        {testingChannelId === ch._uid ? (
                          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                        ) : (
                          <>
                            <span
                              className={`h-2 w-2 rounded-full shrink-0 ${
                                ch.liveness?.status === 'alive'
                                  ? 'bg-emerald-500'
                                  : ch.liveness?.status === 'dead'
                                    ? 'bg-red-500'
                                    : 'bg-zinc-400'
                              }`}
                            />
                            <span className="text-[11px] text-muted-foreground capitalize">
                              {ch.liveness?.status || 'unknown'}
                            </span>
                          </>
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

                      <div className="flex items-center justify-end gap-1">
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

          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            totalCount={filtered.length}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Detail Modal */}
      <Modal
        open={!!detailChannel}
        onClose={() => setDetailChannel(null)}
        title="Channel Details"
        size="lg"
      >
        {detailChannel && (
          <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-start gap-4">
              {detailChannel.tvgLogo ? (
                <img
                  src={proxyImageUrl(detailChannel.tvgLogo)}
                  alt=""
                  className="h-16 w-16 rounded object-contain bg-muted shrink-0"
                  onError={(e) => {
                    const img = e.currentTarget;
                    if (
                      !img.dataset.fallback &&
                      detailChannel.tvgLogo &&
                      isSafeImageUrl(detailChannel.tvgLogo)
                    ) {
                      img.dataset.fallback = '1';
                      img.src = detailChannel.tvgLogo;
                    }
                  }}
                />
              ) : (
                <div className="h-16 w-16 rounded bg-muted shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-medium">{detailChannel.channelName}</h3>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  {detailChannel.channelId}
                </p>
              </div>
            </div>

            <div className="divide-y divide-border border border-border">
              {(
                [
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
                ] as { label: string; value?: string | null }[]
              )
                .filter((r) => r.value)
                .map((r) => (
                  <div key={r.label} className="flex items-start justify-between gap-4 px-4 py-2.5">
                    <span className="text-sm text-muted-foreground shrink-0">{r.label}</span>
                    <span className="text-sm font-medium text-right break-all max-w-[65%]">
                      {r.value}
                    </span>
                  </div>
                ))}
            </div>

            {/* Raw Data */}
            <details className="group">
              <summary className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors">
                Raw Data
              </summary>
              <pre className="mt-2 text-xs font-mono bg-muted border border-border p-3 overflow-x-auto max-h-[300px] overflow-y-auto whitespace-pre-wrap break-all">
                {JSON.stringify(
                  Object.fromEntries(Object.entries(detailChannel).filter(([k]) => k !== '_uid')),
                  null,
                  2,
                )}
              </pre>
            </details>
            <div className="flex items-center gap-3 pt-2">
              {detailChannel.channelUrl && (
                <button
                  onClick={() => {
                    setDetailChannel(null);
                    playStream(
                      {
                        name: detailChannel.channelName || 'Stream Preview',
                        url: detailChannel.channelUrl,
                      },
                      { mode: 'direct-fallback' },
                    );
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-primary text-primary-foreground uppercase tracking-[0.1em] transition-colors hover:bg-primary/90"
                >
                  <Play className="h-4 w-4" />
                  Preview Stream
                </button>
              )}
              <button
                onClick={() => {
                  toggleOne(detailChannel);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium border border-border uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground transition-colors"
              >
                {selectedIds.has(getKey(detailChannel)) ? (
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
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
