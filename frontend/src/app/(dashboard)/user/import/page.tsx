'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Globe, RefreshCw, Eye, Play } from 'lucide-react';
import api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useDebouncedSearch } from '@/hooks/use-debounced-search';
import { useBulkSelection } from '@/hooks/use-bulk-selection';
import { useStreamPlayer } from '@/components/stream-player-context';
import { proxyImageUrl } from '@/lib/image-proxy';
import SearchInput from '@/components/ui/search-input';
import ChannelLogo from '@/components/ui/channel-logo';
import Pagination from '@/components/ui/pagination';
import ColumnFilter from '@/components/ui/column-filter';
import ChannelDetailModal from '@/components/channel-detail-modal';

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

  const { search, debouncedSearch, handleSearchChange } = useDebouncedSearch();
  const {
    isSelected,
    toggleOne,
    selectMany,
    unselectAll,
    count: selectedCount,
  } = useBulkSelection();
  const [page, setPage] = useState(1);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const { playStream } = useStreamPlayer();
  const [detailChannel, setDetailChannel] = useState<EnrichedChannel | null>(null);

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
    handleSearchChange('');
    setPage(1);
    setSelectedCategories([]);

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
      // Auto-select all
      selectMany(data.map((c: EnrichedChannel) => c._uid));
    } catch {
      toast('Failed to fetch channels', 'error');
    } finally {
      setFetchingChannels(false);
    }
  }

  // Category options for filter
  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    channels.forEach((c) => {
      const cat = c.groupTitle || c.channelCategories?.[0];
      if (cat) set.add(cat);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [channels]);

  // Filtered + paginated channels
  const filtered = useMemo(() => {
    let result = channels;

    // Text search
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (c) =>
          c.channelName?.toLowerCase().includes(q) ||
          c.groupTitle?.toLowerCase().includes(q) ||
          c.channelCategories?.some((cat) => cat.toLowerCase().includes(q)),
      );
    }

    // Category filter
    if (selectedCategories.length > 0 && selectedCategories.length < categoryOptions.length) {
      result = result.filter((c) => {
        const cat = c.groupTitle || c.channelCategories?.[0] || '';
        return selectedCategories.includes(cat);
      });
    }

    return result;
  }, [channels, debouncedSearch, selectedCategories, categoryOptions]);

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, selectedCategories]);

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

  function toggleAll() {
    if (selectedCount === filtered.length) {
      unselectAll();
    } else {
      selectMany(filtered.map((c) => c._uid));
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

      <ChannelDetailModal
        open={!!detailChannel}
        onClose={() => setDetailChannel(null)}
        channel={detailChannel}
        fields={
          detailChannel
            ? [
                { label: 'Stream URL', value: detailChannel.channelUrl },
                {
                  label: 'Category',
                  value: detailChannel.groupTitle || detailChannel.channelCategories?.join(', '),
                },
                { label: 'Country', value: detailChannel.country },
                { label: 'Languages', value: detailChannel.languages?.join(', ') },
              ]
            : []
        }
        onPlay={
          detailChannel?.channelUrl
            ? () => {
                const ch = detailChannel!;
                setDetailChannel(null);
                handlePlay(ch);
              }
            : undefined
        }
      />

      {!fetchingChannels && channels.length > 0 && (
        <div className="space-y-4">
          {/* Search + Category filter */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <SearchInput
              value={search}
              onChange={handleSearchChange}
              placeholder="Search by name or category..."
              ariaLabel="Search channels"
              className="flex-1 max-w-md w-full"
            />
            <ColumnFilter
              label="Category"
              options={categoryOptions}
              selected={selectedCategories}
              onChange={(v) => setSelectedCategories(v)}
              searchable
            />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              {filtered.length} channels found
              {filtered.length !== channels.length && ` (filtered from ${channels.length})`}{' '}
              &middot; {selectedCount} selected
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={toggleAll}
                className="text-xs uppercase tracking-[0.1em] text-primary hover:text-primary/80 font-medium transition-colors"
              >
                {selectedCount === filtered.length ? 'Deselect All' : 'Select All'}
              </button>
              <button
                onClick={handleImportToMyList}
                disabled={importing || selectedCount === 0}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-primary text-primary-foreground uppercase tracking-[0.1em] transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none"
              >
                {importing ? 'Importing...' : `Import ${selectedCount} to My List`}
              </button>
            </div>
          </div>

          {importResult && (
            <div
              role="alert"
              aria-live="polite"
              className="border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary"
            >
              {importResult}
            </div>
          )}

          <div className="border border-border divide-y divide-border max-h-[500px] overflow-y-auto">
            {paginated.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No channels match your search
              </div>
            ) : (
              paginated.map((ch) => (
                <div
                  key={ch._uid}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={isSelected(ch._uid)}
                    onChange={() => toggleOne(ch._uid)}
                    className="accent-primary cursor-pointer"
                  />
                  <ChannelLogo src={ch.tvgLogo} alt={`${ch.channelName} logo`} size="sm" />
                  <span className="text-sm font-medium flex-1 truncate">{ch.channelName}</span>
                  <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                    {ch.groupTitle || ch.channelCategories?.join(', ') || ''}
                  </span>
                  <button
                    onClick={() => setDetailChannel(ch)}
                    className="flex items-center justify-center h-8 w-8 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    aria-label="View details"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  {ch.channelUrl && (
                    <button
                      onClick={() => handlePlay(ch)}
                      className="flex items-center justify-center h-8 w-8 text-muted-foreground hover:text-primary transition-colors shrink-0"
                      aria-label="Play stream"
                    >
                      <Play className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

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
