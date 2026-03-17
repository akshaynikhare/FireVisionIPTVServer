'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  Trash2,
  Plus,
  Download,
  Check,
  Zap,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { useToast } from '@/hooks/use-toast';
import { useStreamPlayer } from '@/components/stream-player-context';
import { useClientSideTable } from '@/hooks/use-client-side-table';
import { useDebouncedSearch } from '@/hooks/use-debounced-search';
import SearchInput from '@/components/ui/search-input';
import ChannelLogo from '@/components/ui/channel-logo';
import StatusDot from '@/components/ui/status-dot';
import ChannelDetailModal, { type ChannelField } from '@/components/channel-detail-modal';
import ChannelRowActions from '@/components/ui/channel-row-actions';
import Pagination from '@/components/ui/pagination';
import ColumnFilter from '@/components/ui/column-filter';

interface Channel {
  _id: string;
  channelName?: string;
  name?: string;
  channelUrl?: string;
  url?: string;
  tvgLogo?: string;
  logo?: string;
  channelGroup?: string;
  metadata?: { isWorking?: boolean; lastTested?: string; responseTime?: number };
}

function getName(c: Channel) {
  return c.channelName || c.name || 'Unnamed';
}

function getLogo(c: Channel) {
  return c.tvgLogo || c.logo;
}

function getUrl(c: Channel) {
  return c.channelUrl || c.url || '';
}

type SortField = 'name' | 'group';
type SortDir = 'asc' | 'desc';
const PAGE_SIZE = 50;

export default function UserChannelsPage() {
  const { toast } = useToast();
  const { user } = useAuthStore();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [allChannels, setAllChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const { search, debouncedSearch, handleSearchChange } = useDebouncedSearch('', 300);

  // Add from system
  const [showAdd, setShowAdd] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Testing
  const [testing, setTesting] = useState<string | null>(null);

  // M3U copy
  const [origin, setOrigin] = useState('');
  const [copied, setCopied] = useState(false);

  // Detail modal
  const [detailChannel, setDetailChannel] = useState<Channel | null>(null);

  // Sort + filter + pagination
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

  const { playStream } = useStreamPlayer();

  useEffect(() => {
    setOrigin(window.location.origin);
    fetchMyChannels();
  }, []);

  async function fetchMyChannels() {
    try {
      const res = await api.get('/user-playlist/me/channels');
      const body = res.data;
      setChannels(Array.isArray(body) ? body : body.data || body.channels || []);
    } catch {
      // empty
    } finally {
      setLoading(false);
    }
  }

  async function fetchAllChannels() {
    try {
      const res = await api.get('/channels');
      const body = res.data;
      setAllChannels(Array.isArray(body) ? body : body.data || body.channels || []);
    } catch {
      // empty
    }
  }

  async function handleAddChannels() {
    if (selectedIds.size === 0) return;
    try {
      await api.post('/user-playlist/me/channels/add', {
        channelIds: Array.from(selectedIds),
      });
      setSelectedIds(new Set());
      setShowAdd(false);
      fetchMyChannels();
    } catch {
      toast('Failed to add channels', 'error');
    }
  }

  async function handleRemove(id: string) {
    try {
      await api.post('/user-playlist/me/channels/remove', { channelIds: [id] });
      setChannels((prev) => prev.filter((c) => c._id !== id));
    } catch {
      toast('Failed to remove channel', 'error');
    }
  }

  async function handleRemoveAll() {
    if (!confirm('Remove all channels from your list?')) return;
    try {
      await api.put('/user-playlist/me/channels', { channelIds: [] });
      setChannels([]);
    } catch {
      toast('Failed to clear channels', 'error');
    }
  }

  async function handleTest(id: string) {
    setTesting(id);
    try {
      const res = await api.post(`/channels/${id}/test`);
      const result = res.data.data || res.data;
      setChannels((prev) =>
        prev.map((c) =>
          c._id === id
            ? {
                ...c,
                metadata: {
                  ...c.metadata,
                  isWorking: result.isWorking,
                  lastTested: result.testedAt,
                  responseTime: result.responseTime,
                },
              }
            : c,
        ),
      );
    } catch {
      // ignore
    } finally {
      setTesting(null);
    }
  }

  function handleCopyM3U() {
    if (!user?.channelListCode || !origin) return;
    navigator.clipboard.writeText(`${origin}/api/v1/tv/playlist/${user.channelListCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // Filter options derived from data
  const groupOptions = useMemo(() => {
    const set = new Set<string>();
    channels.forEach((c) => {
      if (c.channelGroup) set.add(c.channelGroup);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [channels]);

  const statusOptions = useMemo(() => ['Working', 'Not Working', 'Untested'], []);

  const searchFields = useMemo(
    () => [(c: Channel) => getName(c), (c: Channel) => c.channelGroup],
    [],
  );

  const sortAccessor = useCallback(
    (ch: Channel) => {
      switch (sortField) {
        case 'name':
          return getName(ch);
        case 'group':
          return ch.channelGroup || '';
      }
    },
    [sortField],
  );

  const filters = useMemo(
    () => [
      {
        accessor: (c: Channel) => c.channelGroup || '',
        selected: selectedGroups,
        allOptions: groupOptions,
      },
      {
        accessor: (c: Channel) =>
          c.metadata?.isWorking === true
            ? 'Working'
            : c.metadata?.isWorking === false
              ? 'Not Working'
              : 'Untested',
        selected: selectedStatuses,
        allOptions: statusOptions,
      },
    ],
    [selectedGroups, groupOptions, selectedStatuses, statusOptions],
  );

  const { filtered, paginated } = useClientSideTable({
    data: channels,
    search: debouncedSearch,
    searchFields,
    filters,
    sortAccessor,
    sortDir,
    page,
    pageSize: PAGE_SIZE,
  });

  // Reset page on filter/search change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, selectedGroups, selectedStatuses]);

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

  // Add-from-system panel filtering
  const myIds = new Set(channels.map((c) => c._id));
  const availableChannels = allChannels.filter(
    (c) =>
      !myIds.has(c._id) &&
      (getName(c).toLowerCase().includes(addSearch.toLowerCase()) ||
        c.channelGroup?.toLowerCase().includes(addSearch.toLowerCase())),
  );

  // Detail modal fields
  const detailFields: ChannelField[] = detailChannel
    ? [
        { label: 'Stream URL', value: getUrl(detailChannel) },
        { label: 'Group', value: detailChannel.channelGroup },
        {
          label: 'Status',
          value:
            detailChannel.metadata?.isWorking === true
              ? 'Working'
              : detailChannel.metadata?.isWorking === false
                ? 'Not Working'
                : 'Untested',
        },
        {
          label: 'Response Time',
          value: detailChannel.metadata?.responseTime
            ? `${detailChannel.metadata.responseTime}ms`
            : undefined,
        },
        {
          label: 'Last Tested',
          value: detailChannel.metadata?.lastTested
            ? new Date(detailChannel.metadata.lastTested).toLocaleString()
            : undefined,
        },
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-display font-bold uppercase tracking-[0.1em]">My Channels</h1>
          <p className="text-sm text-muted-foreground mt-1">{channels.length} channels</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/user/quick-pick"
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-2 border-primary bg-primary/10 text-primary uppercase tracking-[0.1em] transition-colors hover:bg-primary/20"
          >
            <Zap className="h-4 w-4" /> Quick Pick
          </Link>
          <button
            onClick={() => {
              setShowAdd(!showAdd);
              if (!showAdd && allChannels.length === 0) fetchAllChannels();
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-primary text-primary-foreground uppercase tracking-[0.1em] transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
          {channels.length > 0 && (
            <>
              <button
                onClick={handleCopyM3U}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-2 border-border bg-card shadow-sm transition-colors hover:border-primary/40 uppercase tracking-[0.1em]"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-signal-green" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                M3U
              </button>
              <button
                onClick={handleRemoveAll}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-2 border-destructive/30 bg-card shadow-sm transition-colors hover:border-destructive/60 text-destructive uppercase tracking-[0.1em]"
              >
                <Trash2 className="h-4 w-4" /> Clear All
              </button>
            </>
          )}
        </div>
      </div>

      {/* Add from system panel */}
      {showAdd && (
        <div className="border-2 border-primary/30 bg-card p-5 space-y-4">
          <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-medium">
            Add Channels to Your List
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search available channels..."
              value={addSearch}
              onChange={(e) => setAddSearch(e.target.value)}
              className="w-full h-10 pl-10 pr-4 border border-border bg-background text-sm placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary"
              aria-label="Search available channels"
            />
          </div>
          <div className="max-h-64 overflow-y-auto border border-border divide-y divide-border">
            {availableChannels.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                {allChannels.length === 0 ? 'Loading channels...' : 'No channels available to add'}
              </div>
            ) : (
              availableChannels.slice(0, 50).map((ch) => (
                <label
                  key={ch._id}
                  className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(ch._id)}
                    onChange={(e) => {
                      const next = new Set(selectedIds);
                      if (e.target.checked) next.add(ch._id);
                      else next.delete(ch._id);
                      setSelectedIds(next);
                    }}
                    className="accent-primary"
                  />
                  <ChannelLogo src={getLogo(ch)} alt={getName(ch)} size="sm" />
                  <span className="text-sm font-medium flex-1 truncate">{getName(ch)}</span>
                  <span className="text-xs text-muted-foreground">{ch.channelGroup || ''}</span>
                </label>
              ))
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleAddChannels}
              disabled={selectedIds.size === 0}
              className="px-6 py-2.5 text-sm font-medium bg-primary text-primary-foreground uppercase tracking-[0.1em] transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none"
            >
              Add {selectedIds.size} Channel{selectedIds.size !== 1 ? 's' : ''}
            </button>
            <button
              onClick={() => {
                setShowAdd(false);
                setSelectedIds(new Set());
              }}
              className="px-6 py-2.5 text-sm font-medium border border-border uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <SearchInput
        value={search}
        onChange={handleSearchChange}
        placeholder="Search my channels..."
        ariaLabel="Search channels"
      />

      {/* Info bar */}
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        {filtered.length} channels
        {filtered.length !== channels.length && ` (filtered from ${channels.length})`}
      </p>

      {/* Datatable */}
      <div className="overflow-x-auto">
        <div
          role="table"
          aria-label="My channels table"
          className="border border-border divide-y divide-border"
        >
          {/* Header row */}
          <div
            role="rowgroup"
            className="hidden lg:grid grid-cols-[1fr,180px,100px,140px] gap-4 px-4 py-2 bg-muted/50"
          >
            <button
              role="columnheader"
              aria-sort={
                sortField === 'name' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'
              }
              onClick={() => handleSort('name')}
              className="flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium hover:text-foreground transition-colors text-left"
            >
              Name <SortIcon field="name" />
            </button>
            <div
              role="columnheader"
              aria-sort={
                sortField === 'group' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'
              }
              className="flex items-center gap-1"
            >
              <button
                onClick={() => handleSort('group')}
                className="flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium hover:text-foreground transition-colors text-left"
              >
                Group <SortIcon field="group" />
              </button>
              <ColumnFilter
                label=""
                options={groupOptions}
                selected={selectedGroups}
                onChange={(v) => setSelectedGroups(v)}
                searchable
              />
            </div>
            <span role="columnheader">
              <ColumnFilter
                label="Status"
                options={statusOptions}
                selected={selectedStatuses}
                onChange={(v) => setSelectedStatuses(v)}
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
          <div role="rowgroup">
            {paginated.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                {debouncedSearch
                  ? 'No channels match your search'
                  : 'No channels in your list yet. Click "Add" or use Quick Pick to get started.'}
              </div>
            ) : (
              paginated.map((channel) => (
                <div
                  key={channel._id}
                  role="row"
                  className="grid lg:grid-cols-[1fr,180px,100px,140px] gap-2 lg:gap-4 items-center px-4 py-3"
                >
                  <div
                    role="cell"
                    tabIndex={0}
                    aria-label={getName(channel)}
                    className="flex items-center gap-3 min-w-0 cursor-pointer"
                    onClick={() => setDetailChannel(channel)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setDetailChannel(channel);
                      }
                    }}
                  >
                    <ChannelLogo
                      src={getLogo(channel)}
                      alt={getName(channel) + ' logo'}
                      size="sm"
                    />
                    <span className="text-sm font-medium truncate">{getName(channel)}</span>
                  </div>
                  <span role="cell" className="text-sm text-muted-foreground truncate">
                    {channel.channelGroup || '—'}
                  </span>
                  <div role="cell">
                    <StatusDot
                      status={
                        channel.metadata?.isWorking === true
                          ? 'working'
                          : channel.metadata?.isWorking === false
                            ? 'not-working'
                            : 'untested'
                      }
                      size="sm"
                    />
                  </div>
                  <div role="cell">
                    <ChannelRowActions
                      onDetail={() => setDetailChannel(channel)}
                      onPlay={() => playStream({ name: getName(channel), url: getUrl(channel) })}
                      onTest={() => handleTest(channel._id)}
                      testing={testing === channel._id}
                      onDelete={() => handleRemove(channel._id)}
                    />
                  </div>
                </div>
              ))
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

      {/* Detail Modal */}
      <ChannelDetailModal
        open={!!detailChannel}
        onClose={() => setDetailChannel(null)}
        channel={
          detailChannel
            ? {
                channelName: getName(detailChannel),
                tvgLogo: getLogo(detailChannel),
                channelUrl: getUrl(detailChannel),
                summary: detailChannel.channelGroup || 'Uncategorized',
              }
            : null
        }
        fields={detailFields}
        onPlay={
          detailChannel
            ? () => {
                playStream({
                  name: getName(detailChannel),
                  url: getUrl(detailChannel),
                });
                setDetailChannel(null);
              }
            : undefined
        }
      />
    </div>
  );
}
