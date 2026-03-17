'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  Globe,
  RefreshCw,
  CheckSquare,
  Square,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useBulkSelection } from '@/hooks/use-bulk-selection';
import { useClientSideTable } from '@/hooks/use-client-side-table';
import { useStreamPlayer } from '@/components/stream-player-context';
import { proxyImageUrl } from '@/lib/image-proxy';
import SearchInput from '@/components/ui/search-input';
import ChannelLogo from '@/components/ui/channel-logo';
import Pagination from '@/components/ui/pagination';
import ColumnFilter from '@/components/ui/column-filter';
import SelectionToolbar from '@/components/ui/selection-toolbar';
import ChannelDetailModal, { type ChannelField } from '@/components/channel-detail-modal';
import ChannelRowActions from '@/components/ui/channel-row-actions';
import DataTable, { type DataTableColumn } from '@/components/ui/data-table';

interface Playlist {
  id: string;
  name: string;
  country?: string;
  languages?: string[];
  categories?: string[];
}

interface EnrichedChannel {
  _uid: string;
  channelId: string;
  channelName: string;
  channelUrl: string;
  channelCategories?: string[];
  languages?: string[];
  tvgLogo?: string;
  groupTitle?: string;
  country?: string;
}

type SortField = 'name' | 'category' | 'language';
type SortDir = 'asc' | 'desc';
const PAGE_SIZE = 50;

export default function ImportPage() {
  const { toast } = useToast();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null);
  const [channels, setChannels] = useState<EnrichedChannel[]>([]);
  const [fetchingChannels, setFetchingChannels] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  // Search + sort + filter state
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);

  const { playStream } = useStreamPlayer();
  const [detailChannel, setDetailChannel] = useState<EnrichedChannel | null>(null);
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
    async function fetchPlaylists() {
      try {
        const res = await api.get('/iptv-org/playlists');
        const body = res.data;
        setPlaylists(body.data || []);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchPlaylists();
  }, []);

  async function handleSelectPlaylist(playlist: Playlist) {
    setSelectedPlaylist(playlist.id);
    setFetchingChannels(true);
    setChannels([]);
    unselectAll();
    setImportResult(null);
    setSearch('');
    setPage(1);
    setSelectedCategories([]);
    setSelectedLanguages([]);
    setSelectedCountries([]);

    try {
      const params = new URLSearchParams();
      if (playlist.country) params.set('country', playlist.country);
      if (playlist.languages?.length) params.set('language', playlist.languages.join(','));
      if (playlist.categories?.length) params.set('category', playlist.categories.join(','));

      const res = await api.get(`/iptv-org/fetch?${params.toString()}`);
      const body = res.data;
      const data = (body.data || []).map((ch: Omit<EnrichedChannel, '_uid'>, i: number) => ({
        ...ch,
        _uid: String(i),
      }));
      setChannels(data);
      selectMany(data.map((c: EnrichedChannel) => c._uid));
    } catch {
      toast('Failed to fetch channels', 'error');
    } finally {
      setFetchingChannels(false);
    }
  }

  // Filter options from data
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

  // Reset filters when channels change
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
    ],
    [
      selectedCategories,
      categoryOptions,
      selectedLanguages,
      languageOptions,
      selectedCountries,
      countryOptions,
    ],
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

  async function handleImportToMyList() {
    if (channels.length === 0) return;
    setImporting(true);
    setImportResult(null);

    const toImport = channels
      .filter((c) => isSelected(c._uid))
      .map((c) => ({
        channelName: c.channelName,
        channelUrl: c.channelUrl,
        tvgLogo: c.tvgLogo || '',
        channelGroup: c.groupTitle || c.channelCategories?.[0] || 'Imported',
      }));

    try {
      const res = await api.post('/iptv-org/import-user', { channels: toImport });
      const body = res.data;
      setImportResult(body.message || `Added ${body.addedCount} channels`);
    } catch {
      setImportResult('Failed to import channels');
    } finally {
      setImporting(false);
    }
  }

  async function handleClearCache() {
    try {
      await api.post('/iptv-org/clear-cache');
      toast('Cache cleared', 'success');
    } catch {
      toast('Failed to clear cache', 'error');
    }
  }

  // Detail modal fields
  const detailFields: ChannelField[] = detailChannel
    ? [
        { label: 'Stream URL', value: detailChannel.channelUrl },
        {
          label: 'Category',
          value: detailChannel.groupTitle || detailChannel.channelCategories?.join(', '),
        },
        { label: 'Country', value: detailChannel.country },
        { label: 'Languages', value: detailChannel.languages?.join(', ') },
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
            Auto-fetch channels from iptv-org.github.io
          </p>
        </div>
        <button
          onClick={handleClearCache}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-2 border-border bg-card shadow-sm transition-colors hover:border-primary/40 uppercase tracking-[0.1em]"
        >
          <RefreshCw className="h-4 w-4" /> Clear Cache
        </button>
      </div>

      {/* Playlist buttons */}
      <div>
        <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">
          Select a Playlist
        </h2>
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

      {fetchingChannels && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Fetching channels...</span>
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
              placeholder="Search by name, category, language..."
              ariaLabel="Search channels"
              className="flex-1 max-w-md w-full"
            />
            <button
              onClick={handleImportToMyList}
              disabled={importing || selectedCount === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-primary text-primary-foreground uppercase tracking-[0.1em] transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none"
            >
              {importing ? 'Importing...' : `Import ${selectedCount} to My List`}
            </button>
          </div>

          {/* Selection toolbar */}
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
            gridTemplate="40px 44px 1fr 160px 100px 120px 100px"
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
                      className="flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium hover:text-foreground transition-colors text-left"
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
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleSort('category')}
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
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleSort('language')}
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
                  ),
                  cell: (ch) => (
                    <span className="text-xs text-muted-foreground truncate">
                      {ch.languages?.join(', ') || '—'}
                    </span>
                  ),
                },
                {
                  key: 'actions',
                  headerClassName:
                    'text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium text-right',
                  header: 'Actions',
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
    </div>
  );
}
