'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isSafeImageUrl } from '@/lib/safe-url';
import {
  Loader2,
  Search,
  Download,
  Eye,
  Play,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckSquare,
  Square,
  Tv,
  Monitor,
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

// ─── Types ─────────────────────────────────────────────────

interface ChannelLiveness {
  status: 'alive' | 'dead' | 'unknown';
  lastCheckedAt?: string | null;
  responseTimeMs?: number | null;
  error?: string | null;
}

interface SourceChannel {
  _uid: string;
  channelId: string;
  channelName: string;
  channelUrl: string;
  tvgLogo?: string;
  groupTitle?: string;
  country?: string;
  source?: string;
  summary?: string;
  codec?: string;
  bitrate?: number;
  language?: string;
  votes?: number;
  homepage?: string;
  liveness?: ChannelLiveness;
}

interface Region {
  code: string;
  name: string;
  channelCount?: number;
}

interface LivenessStats {
  alive: number;
  dead: number;
  unknown: number;
}

// Country code to display name (for Pluto/Samsung regions from i.mjh.nz)
const COUNTRY_NAMES: Record<string, string> = {
  us: 'United States',
  gb: 'United Kingdom',
  de: 'Germany',
  fr: 'France',
  es: 'Spain',
  it: 'Italy',
  br: 'Brazil',
  mx: 'Mexico',
  ca: 'Canada',
  at: 'Austria',
  ch: 'Switzerland',
  dk: 'Denmark',
  no: 'Norway',
  se: 'Sweden',
  ar: 'Argentina',
  cl: 'Chile',
  in: 'India',
  kr: 'South Korea',
  au: 'Australia',
};

function regionDisplayName(r: Region) {
  if (r.name && r.name !== r.code.toUpperCase()) return r.name;
  return COUNTRY_NAMES[r.code.toLowerCase()] || r.code.toUpperCase();
}

type Tab = 'pluto-tv' | 'samsung-tv-plus';
type SortField = 'name' | 'category' | 'country';
type SortDir = 'asc' | 'desc';
const PAGE_SIZE = 50;

const TABS: { id: Tab; label: string; icon: typeof Tv }[] = [
  { id: 'pluto-tv', label: 'Pluto TV', icon: Tv },
  { id: 'samsung-tv-plus', label: 'Samsung TV Plus', icon: Monitor },
];

// ─── Main Page ─────────────────────────────────────────────

export default function AdminSourcesPage() {
  const [activeTab, setActiveTab] = useState<Tab>('pluto-tv');
  const { playStream } = useStreamPlayer();
  const [detailChannel, setDetailChannel] = useState<SourceChannel | null>(null);

  const handlePlay = useCallback(
    (ch: SourceChannel) => {
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-fade-up">
        <h1 className="text-lg font-display font-bold uppercase tracking-[0.1em]">Other Sources</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Import channels from free, ad-supported streaming services
        </p>
      </div>

      {/* Tabs */}
      <div
        className="flex gap-1 border-b border-border animate-fade-up"
        style={{ animationDelay: '50ms' }}
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium uppercase tracking-[0.1em] transition-colors border-b-2 -mb-px ${
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="animate-fade-up" style={{ animationDelay: '100ms' }}>
        {activeTab === 'pluto-tv' && <PlutoTVTab onPlay={handlePlay} onDetail={setDetailChannel} />}
        {activeTab === 'samsung-tv-plus' && (
          <SamsungTVPlusTab onPlay={handlePlay} onDetail={setDetailChannel} />
        )}
      </div>

      {/* Detail Modal */}
      {detailChannel && (
        <DetailModal
          channel={detailChannel}
          onClose={() => setDetailChannel(null)}
          onPlay={(ch) => {
            setDetailChannel(null);
            handlePlay(ch);
          }}
        />
      )}
    </div>
  );
}

// ─── Pluto TV Tab ──────────────────────────────────────────

function PlutoTVTab({
  onPlay,
  onDetail,
}: {
  onPlay: (ch: SourceChannel) => void;
  onDetail: (ch: SourceChannel) => void;
}) {
  const { toast } = useToast();
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>('us');
  const [channels, setChannels] = useState<SourceChannel[]>([]);
  const [loading, setLoading] = useState(false);
  const [regionsLoading, setRegionsLoading] = useState(true);

  useEffect(() => {
    api
      .get('/external-sources/pluto-tv/regions')
      .then((res) => setRegions(res.data.data || []))
      .catch(() => {})
      .finally(() => setRegionsLoading(false));
  }, []);

  async function fetchChannels(region: string) {
    setSelectedRegion(region);
    setLoading(true);
    setChannels([]);
    try {
      const res = await api.get(`/external-sources/pluto-tv/channels?country=${region}`);
      setChannels(res.data.data || []);
    } catch {
      toast('Failed to fetch Pluto TV channels', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Select Region
        </p>
      </div>
      {regionsLoading ? (
        <Spinner />
      ) : (
        <div className="flex flex-wrap gap-2">
          {regions.map((r) => (
            <button
              key={r.code}
              onClick={() => fetchChannels(r.code)}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-2 transition-all ${
                selectedRegion === r.code && channels.length > 0
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card shadow-sm hover:border-primary/40'
              }`}
            >
              {regionDisplayName(r)}
              {r.channelCount != null && (
                <span className="text-muted-foreground text-xs">({r.channelCount})</span>
              )}
            </button>
          ))}
        </div>
      )}
      {loading && <SpinnerWithLabel label="Fetching Pluto TV channels..." />}
      {!loading && channels.length > 0 && (
        <ChannelDataTable
          channels={channels}
          onPlay={onPlay}
          onDetail={onDetail}
          source="pluto-tv"
          region={selectedRegion}
          onChannelUpdate={(uid, liveness) => {
            setChannels((prev) => prev.map((ch) => (ch._uid === uid ? { ...ch, liveness } : ch)));
          }}
        />
      )}
    </div>
  );
}

// ─── Samsung TV Plus Tab ───────────────────────────────────

function SamsungTVPlusTab({
  onPlay,
  onDetail,
}: {
  onPlay: (ch: SourceChannel) => void;
  onDetail: (ch: SourceChannel) => void;
}) {
  const { toast } = useToast();
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>('us');
  const [channels, setChannels] = useState<SourceChannel[]>([]);
  const [loading, setLoading] = useState(false);
  const [regionsLoading, setRegionsLoading] = useState(true);

  useEffect(() => {
    api
      .get('/external-sources/samsung-tv-plus/regions')
      .then((res) => setRegions(res.data.data || []))
      .catch(() => {})
      .finally(() => setRegionsLoading(false));
  }, []);

  async function fetchChannels(region: string) {
    setSelectedRegion(region);
    setLoading(true);
    setChannels([]);
    try {
      const res = await api.get(`/external-sources/samsung-tv-plus/channels?country=${region}`);
      setChannels(res.data.data || []);
    } catch {
      toast('Failed to fetch Samsung TV Plus channels', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Select Region
        </p>
      </div>
      {regionsLoading ? (
        <Spinner />
      ) : (
        <div className="flex flex-wrap gap-2">
          {regions.map((r) => (
            <button
              key={r.code}
              onClick={() => fetchChannels(r.code)}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-2 transition-all ${
                selectedRegion === r.code && channels.length > 0
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card shadow-sm hover:border-primary/40'
              }`}
            >
              {regionDisplayName(r)}
              {r.channelCount != null && (
                <span className="text-muted-foreground text-xs">({r.channelCount})</span>
              )}
            </button>
          ))}
        </div>
      )}
      {loading && <SpinnerWithLabel label="Fetching Samsung TV Plus channels..." />}
      {!loading && channels.length > 0 && (
        <ChannelDataTable
          channels={channels}
          onPlay={onPlay}
          onDetail={onDetail}
          source="samsung-tv-plus"
          region={selectedRegion}
          onChannelUpdate={(uid, liveness) => {
            setChannels((prev) => prev.map((ch) => (ch._uid === uid ? { ...ch, liveness } : ch)));
          }}
        />
      )}
    </div>
  );
}

// ─── Shared Channel Data Table ─────────────────────────────

function ChannelDataTable({
  channels,
  onPlay,
  onDetail,
  source,
  region,
  disableLiveness,
  onChannelUpdate,
}: {
  channels: SourceChannel[];
  onPlay: (ch: SourceChannel) => void;
  onDetail: (ch: SourceChannel) => void;
  source: Tab;
  region: string;
  disableLiveness?: boolean;
  onChannelUpdate?: (uid: string, liveness: ChannelLiveness) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(false);

  // Column filter state
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);

  // Liveness state
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [testingChannelId, setTestingChannelId] = useState<string | null>(null);
  const [batchTesting, setBatchTesting] = useState(false);
  const [livenessStats, setLivenessStats] = useState<LivenessStats | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch liveness stats when source/region changes
  const fetchLivenessStats = useCallback(async () => {
    if (disableLiveness || !source || !region) return;
    try {
      const res = await api.get(
        `/external-sources/liveness-status?source=${source}&region=${encodeURIComponent(region)}`,
      );
      const data = res.data.data;
      setLivenessStats(data.livenessStats);
      if (!data.livenessCheckInProgress && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        setBatchTesting(false);
      }
      if (data.livenessCheckInProgress) {
        setBatchTesting(true);
      }
    } catch {
      // ignore
    }
  }, [source, region, disableLiveness]);

  useEffect(() => {
    fetchLivenessStats();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchLivenessStats]);

  async function handleTestChannel(ch: SourceChannel) {
    if (!ch._uid) return;
    setTestingChannelId(ch._uid);
    try {
      const res = await api.post(`/external-sources/check-liveness/${ch._uid}`);
      const result = res.data.data;
      if (result && onChannelUpdate) {
        onChannelUpdate(ch._uid, {
          status: result.status,
          lastCheckedAt: new Date().toISOString(),
          responseTimeMs: result.responseTimeMs,
          error: result.error,
        });
      }
      fetchLivenessStats();
    } catch {
      // ignore
    } finally {
      setTestingChannelId(null);
    }
  }

  async function handleBatchLivenessCheck() {
    if (batchTesting || !source || !region) return;
    setBatchTesting(true);
    try {
      await api.post('/external-sources/check-liveness', { source, region });
      // Start polling
      pollRef.current = setInterval(fetchLivenessStats, 5000);
    } catch {
      setBatchTesting(false);
    }
  }

  // Compute unique filter options from loaded data
  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    channels.forEach((c) => {
      if (c.groupTitle) set.add(c.groupTitle);
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
    setSelectedCountries([]);
    setSelectedStatuses([]);
  }, [channels]);

  const { filtered, paginated } = useMemo(() => {
    let result = channels;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.channelName?.toLowerCase().includes(q) ||
          c.channelId?.toLowerCase().includes(q) ||
          c.groupTitle?.toLowerCase().includes(q) ||
          c.country?.toLowerCase().includes(q),
      );
    }

    // Apply column filters
    if (selectedCategories.length > 0 && selectedCategories.length < categoryOptions.length) {
      result = result.filter((c) => selectedCategories.includes(c.groupTitle || ''));
    }
    if (selectedCountries.length > 0 && selectedCountries.length < countryOptions.length) {
      result = result.filter((c) => selectedCountries.includes(c.country || ''));
    }

    // Apply status filter
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
          valA = a.groupTitle || '';
          valB = b.groupTitle || '';
          break;
        case 'country':
          valA = a.country || '';
          valB = b.country || '';
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
    selectedCountries,
    categoryOptions,
    countryOptions,
    selectedStatuses,
  ]);

  function getKey(ch: SourceChannel) {
    return ch._uid;
  }

  function toggleOne(ch: SourceChannel) {
    const key = getKey(ch);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectAllFiltered() {
    setSelectedIds(new Set(filtered.map(getKey)));
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

  async function handleImport() {
    if (selectedIds.size === 0) return;
    setImporting(true);
    setImportResult(null);

    const toImport = channels
      .filter((c) => selectedIds.has(getKey(c)))
      .map((c) => ({
        channelName: c.channelName,
        channelUrl: c.channelUrl,
        tvgLogo: c.tvgLogo || '',
        groupTitle: c.groupTitle || 'Imported',
        channelId: c.channelId || '',
      }));

    try {
      const res = await api.post('/external-sources/import', {
        channels: toImport,
        replaceExisting,
      });
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

  return (
    <div className="space-y-4">
      {/* Liveness stats bar */}
      {!disableLiveness &&
        livenessStats &&
        (livenessStats.alive > 0 || livenessStats.dead > 0 || livenessStats.unknown > 0) && (
          <div className="flex items-center gap-4 px-4 py-2.5 bg-muted/50 border border-border text-xs">
            <Activity className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-signal-green font-medium">{livenessStats.alive} alive</span>
            <span className="text-signal-red font-medium">{livenessStats.dead} dead</span>
            <span className="text-muted-foreground font-medium">
              {livenessStats.unknown} unknown
            </span>
          </div>
        )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, category, or country..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full h-10 pl-10 pr-4 border border-border bg-card text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Batch liveness check button */}
          {!disableLiveness && (
            <button
              onClick={handleBatchLivenessCheck}
              disabled={batchTesting}
              className="inline-flex items-center gap-2 px-4 py-2.5 h-10 text-sm font-medium border border-border bg-card text-foreground uppercase tracking-[0.1em] transition-colors hover:bg-muted disabled:opacity-50 disabled:pointer-events-none"
            >
              {batchTesting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Activity className="h-4 w-4" />
              )}
              {batchTesting ? 'Checking...' : 'Check Liveness'}
            </button>
          )}
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
            onClick={handleImport}
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
          {filtered.length !== channels.length &&
            ` (filtered from ${channels.length})`} &middot;{' '}
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
        {/* Header */}
        <div
          className={`hidden lg:grid gap-2 px-4 py-2 bg-muted/50 border-b border-border ${disableLiveness ? 'grid-cols-[40px,44px,1fr,180px,120px,100px]' : 'grid-cols-[40px,44px,1fr,180px,120px,100px,100px]'}`}
        >
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
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleSort('country')}
              className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium hover:text-foreground transition-colors text-left"
            >
              Country <SortIcon field="country" />
            </button>
            <ColumnFilter
              label=""
              options={countryOptions}
              selected={selectedCountries}
              onChange={(v) => {
                setSelectedCountries(v);
                setPage(1);
              }}
              searchable
            />
          </div>
          {!disableLiveness && (
            <ColumnFilter
              label="Status"
              options={['alive', 'dead', 'unknown']}
              selected={selectedStatuses}
              onChange={(v) => {
                setSelectedStatuses(v);
                setPage(1);
              }}
            />
          )}
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
              const status = ch.liveness?.status || 'unknown';
              return (
                <div
                  key={key}
                  className={`grid ${disableLiveness ? 'lg:grid-cols-[40px,44px,1fr,180px,120px,100px]' : 'lg:grid-cols-[40px,44px,1fr,180px,120px,100px,100px]'} gap-2 items-center px-4 py-2.5 transition-colors hover:bg-muted/50 ${
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
                          if (!img.dataset.fallback && ch.tvgLogo && isSafeImageUrl(ch.tvgLogo)) {
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
                    {ch.summary && (
                      <span className="text-[11px] text-muted-foreground truncate block">
                        {ch.summary}
                      </span>
                    )}
                  </div>

                  <span className="text-xs text-muted-foreground truncate">
                    {ch.groupTitle || '—'}
                  </span>

                  <span className="text-xs text-muted-foreground truncate">
                    {ch.country || '—'}
                  </span>

                  {/* Status badge + test button */}
                  {!disableLiveness && (
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 ${
                          status === 'alive'
                            ? 'text-signal-green bg-signal-green/10'
                            : status === 'dead'
                              ? 'text-signal-red bg-signal-red/10'
                              : 'text-muted-foreground bg-muted'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            status === 'alive'
                              ? 'bg-signal-green'
                              : status === 'dead'
                                ? 'bg-signal-red'
                                : 'bg-muted-foreground'
                          }`}
                        />
                        {status}
                      </span>
                      <button
                        onClick={() => handleTestChannel(ch)}
                        disabled={testingChannelId === ch._uid}
                        className="flex items-center justify-center h-6 w-6 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                        title="Test stream"
                      >
                        {testingChannelId === ch._uid ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Zap className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => onDetail(ch)}
                      className="flex items-center justify-center h-8 w-8 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="View details"
                      title="Channel info"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    {ch.channelUrl && (
                      <button
                        onClick={() => onPlay(ch)}
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
  );
}

// ─── Detail Modal ──────────────────────────────────────────

function DetailModal({
  channel,
  onClose,
  onPlay,
}: {
  channel: SourceChannel;
  onClose: () => void;
  onPlay: (ch: SourceChannel) => void;
}) {
  return (
    <Modal open onClose={onClose} title="Channel Details" size="lg">
      <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-start gap-4">
          {channel.tvgLogo ? (
            <img
              src={proxyImageUrl(channel.tvgLogo)}
              alt=""
              className="h-16 w-16 rounded object-contain bg-muted shrink-0"
              onError={(e) => {
                const img = e.currentTarget;
                if (!img.dataset.fallback && channel.tvgLogo && isSafeImageUrl(channel.tvgLogo)) {
                  img.dataset.fallback = '1';
                  img.src = channel.tvgLogo;
                }
              }}
            />
          ) : (
            <div className="h-16 w-16 rounded bg-muted shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-medium">{channel.channelName}</h3>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{channel.channelId}</p>
            {channel.summary && (
              <p className="text-sm text-muted-foreground mt-1">{channel.summary}</p>
            )}
          </div>
        </div>

        <div className="divide-y divide-border border border-border">
          {(
            [
              { label: 'Stream URL', value: channel.channelUrl },
              { label: 'Logo URL', value: channel.tvgLogo },
              { label: 'Category', value: channel.groupTitle },
              { label: 'Country', value: channel.country },
              { label: 'Source', value: channel.source },
              { label: 'Codec', value: channel.codec },
              {
                label: 'Bitrate',
                value: channel.bitrate ? `${channel.bitrate} kbps` : undefined,
              },
              { label: 'Language', value: channel.language },
              {
                label: 'Votes',
                value: channel.votes != null ? String(channel.votes) : undefined,
              },
              { label: 'Homepage', value: channel.homepage },
              {
                label: 'Liveness',
                value: channel.liveness
                  ? `${channel.liveness.status}${channel.liveness.responseTimeMs ? ` (${channel.liveness.responseTimeMs}ms)` : ''}${channel.liveness.error ? ` — ${channel.liveness.error}` : ''}`
                  : undefined,
              },
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

        <div className="flex items-center gap-3 pt-2">
          {channel.channelUrl && (
            <button
              onClick={() => onPlay(channel)}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-primary text-primary-foreground uppercase tracking-[0.1em] transition-colors hover:bg-primary/90"
            >
              <Play className="h-4 w-4" />
              Preview Stream
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ─── Utility Components ────────────────────────────────────

function Spinner() {
  return (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}

function SpinnerWithLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      <span className="ml-2 text-sm text-muted-foreground">{label}</span>
    </div>
  );
}
