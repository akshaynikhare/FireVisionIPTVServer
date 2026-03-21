'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  Loader2,
  Trash2,
  Plus,
  Upload,
  X,
  Download,
  Check,
  Zap,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Heart,
} from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { useToast } from '@/hooks/use-toast';
import { useDebouncedSearch } from '@/hooks/use-debounced-search';
import { useClientSideTable } from '@/hooks/use-client-side-table';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import Pagination from '@/components/ui/pagination';
import Modal from '@/components/ui/modal';
import { useStreamPlayer } from '@/components/stream-player-context';
import ColumnFilter from '@/components/ui/column-filter';
import SearchInput from '@/components/ui/search-input';
import StatusDot from '@/components/ui/status-dot';
import ChannelLogo from '@/components/ui/channel-logo';
import ChannelDetailModal, { type ChannelField } from '@/components/channel-detail-modal';
import ChannelDataTable from '@/components/ui/channel-data-table';
import { type DataTableColumn } from '@/components/ui/data-table';

interface Channel {
  _id: string;
  channelId?: string;
  channelName?: string;
  name?: string;
  channelUrl?: string;
  url?: string;
  channelImg?: string;
  tvgLogo?: string;
  logo?: string;
  channelGroup?: string;
  channelDrmKey?: string;
  channelDrmType?: string;
  order?: number;
  isActive?: boolean;
  metadata?: {
    isWorking?: boolean;
    lastTested?: string;
    responseTime?: number;
    country?: string;
    language?: string;
    quality?: string;
    network?: string;
    website?: string;
  };
  metrics?: {
    deadCount?: number;
    aliveCount?: number;
    unresponsiveCount?: number;
    playCount?: number;
    proxyPlayCount?: number;
    lastDeadAt?: string;
    lastAliveAt?: string;
    lastPlayedAt?: string;
    lastUnresponsiveAt?: string;
  };
}

function getName(c: Channel) {
  return c.channelName || c.name || 'Unnamed';
}

function getLogo(c: Channel) {
  return c.tvgLogo || c.channelImg || c.logo;
}

function getUrl(c: Channel) {
  return c.channelUrl || c.url || '';
}

const PAGE_SIZE = 50;

interface ChannelsPageShellProps {
  mode: 'admin' | 'user';
}

type SortField = 'name' | 'group';
type SortDir = 'asc' | 'desc';

export default function ChannelsPageShell({ mode }: ChannelsPageShellProps) {
  const isAdmin = mode === 'admin';
  const { toast } = useToast();
  const { user } = useAuthStore();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const { search, debouncedSearch, handleSearchChange } = useDebouncedSearch('', 300);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Column filter state
  const [filterOptions, setFilterOptions] = useState<{
    group: string[];
    status: string[];
    language: string[];
    country: string[];
  }>({ group: [], status: [], language: [], country: [] });
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);

  // Admin: Add channel form
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    channelName: '',
    channelUrl: '',
    channelGroup: '',
    tvgLogo: '',
    channelDrmKey: '',
    channelDrmType: '',
    order: 0,
  });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

  // Admin: Edit channel
  const [editChannel, setEditChannel] = useState<Channel | null>(null);
  const [editForm, setEditForm] = useState({
    channelName: '',
    channelUrl: '',
    channelGroup: '',
    tvgLogo: '',
    channelDrmKey: '',
    channelDrmType: '',
    order: 0,
    country: '',
    language: '',
    quality: '',
    network: '',
    website: '',
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  // Details preview
  const [detailChannel, setDetailChannel] = useState<Channel | null>(null);

  // Bulk delete
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);

  // Admin: M3U Import
  const [showImport, setShowImport] = useState(false);
  const [importContent, setImportContent] = useState('');
  const [importClear, setImportClear] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Stream testing
  const [testing, setTesting] = useState<string | null>(null);
  const [testingAll, setTestingAll] = useState(false);
  const [testResults, setTestResults] = useState<{ working: number; failed: number } | null>(null);

  // User: Add from system
  const [allChannels, setAllChannels] = useState<Channel[]>([]);
  const [addSearch, setAddSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // User: M3U copy
  const [origin, setOrigin] = useState('');
  const [copied, setCopied] = useState(false);

  // User: Sort
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const { playStream } = useStreamPlayer();

  // Favorites
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const favoriteIdsRef = useRef<Set<string>>(new Set());
  const [favSyncing, setFavSyncing] = useState<Set<string>>(new Set());

  function updateFavoriteIds(next: Set<string>) {
    favoriteIdsRef.current = next;
    setFavoriteIds(next);
  }

  async function fetchFavorites() {
    try {
      const res = await api.get('/favorites');
      const ids: string[] = res.data.channel_ids || [];
      updateFavoriteIds(new Set(ids));
    } catch {
      // silent — favorites are non-critical
    }
  }

  async function toggleFavorite(channelId: string) {
    setFavSyncing((prev) => new Set(prev).add(channelId));
    const wasFav = favoriteIdsRef.current.has(channelId);
    const next = new Set(favoriteIdsRef.current);
    if (wasFav) next.delete(channelId);
    else next.add(channelId);
    updateFavoriteIds(next);
    try {
      await api.post('/favorites', { channel_ids: Array.from(favoriteIdsRef.current) });
    } catch {
      // revert just this channel
      const reverted = new Set(favoriteIdsRef.current);
      if (wasFav) reverted.add(channelId);
      else reverted.delete(channelId);
      updateFavoriteIds(reverted);
      toast('Failed to update favorites', 'error');
    } finally {
      setFavSyncing((prev) => {
        const s = new Set(prev);
        s.delete(channelId);
        return s;
      });
    }
  }

  // --- Admin: Server-side data fetching ---
  const fetchChannels = useCallback(
    async (signal?: AbortSignal) => {
      if (!isAdmin) return;
      try {
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('pageSize', String(PAGE_SIZE));
        if (debouncedSearch) params.set('search', debouncedSearch);
        if (selectedGroups.length > 0 && selectedGroups.length < filterOptions.group.length) {
          params.set('group', selectedGroups.join(','));
        }
        if (selectedStatuses.length > 0 && selectedStatuses.length < filterOptions.status.length) {
          params.set('status', selectedStatuses.join(','));
        }
        if (
          selectedLanguages.length > 0 &&
          selectedLanguages.length < filterOptions.language.length
        ) {
          params.set('language', selectedLanguages.join(','));
        }
        if (
          selectedCountries.length > 0 &&
          selectedCountries.length < filterOptions.country.length
        ) {
          params.set('country', selectedCountries.join(','));
        }
        const res = await api.get(`/admin/channels?${params.toString()}`, { signal });
        const body = res.data;
        setChannels(Array.isArray(body) ? body : body.data || body.channels || []);
        setTotalCount(body.totalCount ?? (Array.isArray(body) ? body.length : body.count || 0));
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        if (
          typeof err === 'object' &&
          err !== null &&
          'code' in err &&
          (err as { code: string }).code === 'ERR_CANCELED'
        )
          return;
        setError('Failed to load channels');
      } finally {
        setLoading(false);
      }
    },
    [
      isAdmin,
      page,
      debouncedSearch,
      selectedGroups,
      selectedStatuses,
      selectedLanguages,
      selectedCountries,
      filterOptions,
    ],
  );

  async function refreshFilterOptions() {
    if (!isAdmin) return;
    try {
      const res = await api.get('/admin/channels/filter-options');
      setFilterOptions(res.data.data || { group: [], status: [], language: [], country: [] });
    } catch {
      /* ignore */
    }
  }

  // --- User: Client-side data fetching ---
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

  // Init
  useEffect(() => {
    setOrigin(window.location.origin);
    fetchFavorites();
    if (isAdmin) {
      refreshFilterOptions();
    } else {
      fetchMyChannels();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  // Admin: track prev filters and reset page
  const prevFiltersRef = useRef({
    debouncedSearch,
    selectedGroups,
    selectedStatuses,
    selectedLanguages,
    selectedCountries,
  });

  useEffect(() => {
    if (!isAdmin) return;
    const prev = prevFiltersRef.current;
    const filtersChanged =
      prev.debouncedSearch !== debouncedSearch ||
      prev.selectedGroups !== selectedGroups ||
      prev.selectedStatuses !== selectedStatuses ||
      prev.selectedLanguages !== selectedLanguages ||
      prev.selectedCountries !== selectedCountries;
    prevFiltersRef.current = {
      debouncedSearch,
      selectedGroups,
      selectedStatuses,
      selectedLanguages,
      selectedCountries,
    };

    if (filtersChanged && page !== 1) {
      setPage(1);
      return;
    }
    const controller = new AbortController();
    fetchChannels(controller.signal);
    return () => controller.abort();
  }, [
    fetchChannels,
    isAdmin,
    page,
    debouncedSearch,
    selectedGroups,
    selectedStatuses,
    selectedLanguages,
    selectedCountries,
  ]);

  // User: Client-side filtering/sorting
  const groupOptions = useMemo(() => {
    if (isAdmin) return [];
    const set = new Set<string>();
    channels.forEach((c) => {
      if (c.channelGroup) set.add(c.channelGroup);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [channels, isAdmin]);

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

  const userFilters = useMemo(
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

  const { filtered, paginated: userPaginated } = useClientSideTable({
    data: isAdmin ? [] : channels,
    search: isAdmin ? '' : debouncedSearch,
    searchFields,
    filters: userFilters,
    sortAccessor,
    sortDir,
    page,
    pageSize: PAGE_SIZE,
  });

  // Reset page on filter/search change (user mode)
  useEffect(() => {
    if (isAdmin) return;
    setPage(1);
  }, [debouncedSearch, selectedGroups, selectedStatuses, isAdmin]);

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

  const displayData = isAdmin ? channels : userPaginated;
  const displayTotalCount = isAdmin ? totalCount : filtered.length;

  // --- Admin actions ---
  async function handleAddChannel(e: React.FormEvent) {
    e.preventDefault();
    setAddError('');
    setAddLoading(true);
    try {
      const channelId = addForm.channelName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      await api.post('/admin/channels', {
        channelId,
        channelName: addForm.channelName,
        channelUrl: addForm.channelUrl,
        channelGroup: addForm.channelGroup || 'Uncategorized',
        tvgLogo: addForm.tvgLogo || '',
        channelDrmKey: addForm.channelDrmKey || '',
        channelDrmType: addForm.channelDrmType || '',
        order: addForm.order || 0,
      });
      setShowAdd(false);
      setAddForm({
        channelName: '',
        channelUrl: '',
        channelGroup: '',
        tvgLogo: '',
        channelDrmKey: '',
        channelDrmType: '',
        order: 0,
      });
      fetchChannels();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setAddError(axiosErr.response?.data?.error || 'Failed to create channel');
    } finally {
      setAddLoading(false);
    }
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editChannel) return;
    setEditError('');
    setEditLoading(true);
    try {
      await api.put(`/admin/channels/${editChannel._id}`, {
        channelName: editForm.channelName,
        channelUrl: editForm.channelUrl,
        channelGroup: editForm.channelGroup || 'Uncategorized',
        tvgLogo: editForm.tvgLogo || '',
        channelDrmKey: editForm.channelDrmKey || '',
        channelDrmType: editForm.channelDrmType || '',
        order: editForm.order || 0,
        metadata: {
          country: editForm.country || '',
          language: editForm.language || '',
          quality: editForm.quality || '',
          network: editForm.network || '',
          website: editForm.website || '',
        },
      });
      setEditChannel(null);
      fetchChannels();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setEditError(axiosErr.response?.data?.error || 'Failed to update channel');
    } finally {
      setEditLoading(false);
    }
  }

  function openEdit(ch: Channel) {
    setEditChannel(ch);
    setEditForm({
      channelName: getName(ch),
      channelUrl: getUrl(ch),
      channelGroup: ch.channelGroup || '',
      tvgLogo: getLogo(ch) || '',
      channelDrmKey: ch.channelDrmKey || '',
      channelDrmType: ch.channelDrmType || '',
      order: ch.order || 0,
      country: ch.metadata?.country || '',
      language: ch.metadata?.language || '',
      quality: ch.metadata?.quality || '',
      network: ch.metadata?.network || '',
      website: ch.metadata?.website || '',
    });
    setEditError('');
  }

  async function handleDelete(id: string) {
    if (isAdmin) {
      if (!confirm('Delete this channel?')) return;
      try {
        await api.delete(`/admin/channels/${id}`);
        setChannels((prev) => prev.filter((c) => c._id !== id));
      } catch {
        toast('Failed to delete channel', 'error');
      }
    } else {
      try {
        await api.post('/user-playlist/me/channels/remove', { channelIds: [id] });
        setChannels((prev) => prev.filter((c) => c._id !== id));
      } catch {
        toast('Failed to remove channel', 'error');
      }
    }
  }

  async function handleBulkDelete() {
    if (isAdmin) {
      setBulkDeleteLoading(true);
      try {
        await api.delete('/admin/channels');
        setChannels([]);
        setTotalCount(0);
        setShowBulkDelete(false);
        refreshFilterOptions();
      } catch {
        toast('Failed to delete all channels', 'error');
      } finally {
        setBulkDeleteLoading(false);
      }
    } else {
      if (!confirm('Remove all channels from your list?')) return;
      try {
        await api.put('/user-playlist/me/channels', { channelIds: [] });
        setChannels([]);
      } catch {
        toast('Failed to clear channels', 'error');
      }
    }
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (!importContent.trim()) return;
    setImportLoading(true);
    setImportResult('');
    try {
      const endpoint = isAdmin ? '/admin/channels/import-m3u' : '/user-playlist/me/import-m3u';
      const payload = isAdmin
        ? { m3uContent: importContent, clearExisting: importClear }
        : { m3uContent: importContent };
      const res = await api.post(endpoint, payload);
      const data = res.data;
      setImportResult(
        isAdmin
          ? `Imported ${data.imported || data.count || 0} channels`
          : `Added ${data.added || data.count || 0} channels to your list`,
      );
      setImportContent('');
      setImportClear(false);
      if (isAdmin) {
        fetchChannels();
        refreshFilterOptions();
      } else {
        fetchMyChannels();
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setImportResult(axiosErr.response?.data?.error || 'Import failed');
    } finally {
      setImportLoading(false);
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setImportContent((ev.target?.result as string) || '');
    reader.readAsText(file);
  }

  async function handleTestOne(ch: Channel) {
    setTesting(ch._id);
    try {
      const res = await api.post(`/channels/${ch._id}/test`);
      const result = res.data.data || res.data;
      setChannels((prev) =>
        prev.map((c) =>
          c._id === ch._id
            ? {
                ...c,
                metadata: {
                  ...c.metadata,
                  isWorking: result.isWorking ?? result.working,
                  lastTested: new Date().toISOString(),
                  responseTime: result.responseTime,
                },
              }
            : c,
        ),
      );
    } catch {
      /* ignore */
    } finally {
      setTesting(null);
    }
  }

  async function handleTestAll() {
    setTestingAll(true);
    setTestResults(null);
    try {
      const res = await api.post('/test/test-all', { limit: 500, skip: 0 });
      const data = res.data;
      setTestResults({ working: data.working || 0, failed: data.notWorking || 0 });
      fetchChannels();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number } };
      if (axiosErr.response?.status === 409)
        toast('Another test is already in progress. Please wait.', 'error');
    } finally {
      setTestingAll(false);
    }
  }

  async function handleTestAllUser() {
    const toTest = userPaginated.length > 0 ? userPaginated : channels.slice(0, PAGE_SIZE);
    if (toTest.length === 0) return;
    setTestingAll(true);
    setTestResults(null);
    let working = 0;
    let failed = 0;
    const BATCH_SIZE = 5;

    for (let i = 0; i < toTest.length; i += BATCH_SIZE) {
      const batch = toTest.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (ch) => {
          const res = await api.post(`/channels/${ch._id}/test`);
          return { ch, result: res.data.data || res.data };
        }),
      );

      for (const r of results) {
        if (r.status === 'fulfilled') {
          const { ch, result } = r.value;
          const isWorking = result.isWorking ?? result.working;
          if (isWorking) working++;
          else failed++;
          setChannels((prev) =>
            prev.map((c) =>
              c._id === ch._id
                ? {
                    ...c,
                    metadata: {
                      ...c.metadata,
                      isWorking,
                      lastTested: new Date().toISOString(),
                      responseTime: result.responseTime,
                    },
                  }
                : c,
            ),
          );
        } else {
          failed++;
        }
      }
    }

    setTestResults({ working, failed });
    setTestingAll(false);
  }

  // User: Add from system
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

  function handleCopyM3U() {
    if (!user?.channelListCode || !origin) return;
    navigator.clipboard.writeText(`${origin}/api/v1/tv/playlist/${user.channelListCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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
        ...(isAdmin
          ? [
              { label: 'Channel ID', value: detailChannel.channelId },
              { label: 'Country', value: detailChannel.metadata?.country },
              { label: 'Language', value: detailChannel.metadata?.language },
              { label: 'Quality', value: detailChannel.metadata?.quality },
              { label: 'Network', value: detailChannel.metadata?.network },
              { label: 'Website', value: detailChannel.metadata?.website },
              { label: 'DRM Type', value: detailChannel.channelDrmType },
              { label: 'Sort Order', value: detailChannel.order?.toString() },
            ]
          : [{ label: 'Group', value: detailChannel.channelGroup }]),
        {
          label: 'Status',
          value:
            detailChannel.metadata?.isWorking === false
              ? 'Not Working'
              : detailChannel.metadata?.isWorking === true
                ? 'Working'
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
        ...(isAdmin && detailChannel.metrics
          ? [
              { label: 'Play Count', value: String(detailChannel.metrics.playCount ?? 0) },
              { label: 'Proxy Plays', value: String(detailChannel.metrics.proxyPlayCount ?? 0) },
              { label: 'Alive Count', value: String(detailChannel.metrics.aliveCount ?? 0) },
              { label: 'Dead Count', value: String(detailChannel.metrics.deadCount ?? 0) },
              {
                label: 'Unresponsive Count',
                value: String(detailChannel.metrics.unresponsiveCount ?? 0),
              },
              {
                label: 'Last Played',
                value: detailChannel.metrics.lastPlayedAt
                  ? new Date(detailChannel.metrics.lastPlayedAt).toLocaleString()
                  : undefined,
              },
              {
                label: 'Last Dead',
                value: detailChannel.metrics.lastDeadAt
                  ? new Date(detailChannel.metrics.lastDeadAt).toLocaleString()
                  : undefined,
              },
            ]
          : []),
        ...(!isAdmin && detailChannel.metrics
          ? [
              { label: 'Play Count', value: String(detailChannel.metrics.playCount ?? 0) },
              { label: 'Proxy Plays', value: String(detailChannel.metrics.proxyPlayCount ?? 0) },
              { label: 'Alive Count', value: String(detailChannel.metrics.aliveCount ?? 0) },
              { label: 'Dead Count', value: String(detailChannel.metrics.deadCount ?? 0) },
              {
                label: 'Unresponsive Count',
                value: String(detailChannel.metrics.unresponsiveCount ?? 0),
              },
              {
                label: 'Last Played',
                value: detailChannel.metrics.lastPlayedAt
                  ? new Date(detailChannel.metrics.lastPlayedAt).toLocaleString()
                  : undefined,
              },
              {
                label: 'Last Dead',
                value: detailChannel.metrics.lastDeadAt
                  ? new Date(detailChannel.metrics.lastDeadAt).toLocaleString()
                  : undefined,
              },
            ]
          : []),
      ]
    : [];

  // Table columns based on mode
  const favColumn: DataTableColumn<Channel> = {
    key: 'fav',
    header: (
      <span className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium">
        <Heart className="h-3.5 w-3.5 inline" />
      </span>
    ),
    cell: (c) => {
      const isFav = favoriteIds.has(c._id);
      return (
        <button
          onClick={() => toggleFavorite(c._id)}
          disabled={favSyncing.has(c._id)}
          className="flex items-center justify-center h-7 w-7 transition-colors disabled:opacity-50"
          title={isFav ? 'Remove from favorites' : 'Add to favorites'}
          aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Heart
            className={`h-4 w-4 transition-colors ${isFav ? 'fill-red-500 text-red-500' : 'text-muted-foreground hover:text-red-400'}`}
          />
        </button>
      );
    },
  };

  const tableColumns: DataTableColumn<Channel>[] = isAdmin
    ? [
        favColumn,
        {
          key: 'group',
          header: (
            <ColumnFilter
              label="Group"
              options={filterOptions.group}
              selected={selectedGroups}
              onChange={setSelectedGroups}
              searchable
            />
          ),
          cell: (c) => (
            <span className="text-sm text-muted-foreground truncate">{c.channelGroup || '—'}</span>
          ),
        },
        {
          key: 'country',
          header: (
            <ColumnFilter
              label="Country"
              options={filterOptions.country}
              selected={selectedCountries}
              onChange={setSelectedCountries}
              searchable
            />
          ),
          cell: (c) => (
            <span className="text-xs text-muted-foreground truncate">
              {c.metadata?.country || '—'}
            </span>
          ),
        },
        {
          key: 'language',
          header: (
            <ColumnFilter
              label="Language"
              options={filterOptions.language}
              selected={selectedLanguages}
              onChange={setSelectedLanguages}
              searchable
            />
          ),
          cell: (c) => (
            <span className="text-xs text-muted-foreground truncate">
              {c.metadata?.language || '—'}
            </span>
          ),
        },
        {
          key: 'status',
          header: (
            <ColumnFilter
              label="Status"
              options={filterOptions.status}
              selected={selectedStatuses}
              onChange={setSelectedStatuses}
            />
          ),
          cell: (c) => (
            <div className="inline-flex items-center gap-1.5">
              {testing === c._id ? (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              ) : (
                <StatusDot
                  status={
                    c.metadata?.isWorking === true
                      ? 'alive'
                      : c.metadata?.isWorking === false
                        ? 'dead'
                        : 'untested'
                  }
                  size="sm"
                />
              )}
              <button
                onClick={() => handleTestOne(c)}
                disabled={testing === c._id}
                className="flex items-center justify-center h-6 w-6 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                title="Test stream"
              >
                <Zap className="h-3 w-3" />
              </button>
            </div>
          ),
        },
        {
          key: 'plays',
          header: (
            <span className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium">
              Plays
            </span>
          ),
          cell: (c: Channel) => (
            <span className="text-xs tabular-nums font-display">{c.metrics?.playCount || 0}</span>
          ),
        },
      ]
    : [
        favColumn,
        {
          key: 'group',
          ariaSort:
            sortField === 'group' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none',
          header: (
            <div className="relative inline-flex items-center gap-1.5">
              <button
                onClick={() => handleSort('group')}
                className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium hover:text-foreground transition-colors text-left"
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
          ),
          cell: (c) => (
            <span className="text-sm text-muted-foreground truncate">{c.channelGroup || '—'}</span>
          ),
        },
        {
          key: 'status',
          header: (
            <ColumnFilter
              label="Status"
              options={statusOptions}
              selected={selectedStatuses}
              onChange={(v) => setSelectedStatuses(v)}
            />
          ),
          cell: (c) => (
            <div className="inline-flex items-center gap-1.5">
              {testing === c._id ? (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              ) : (
                <StatusDot
                  status={
                    c.metadata?.isWorking === true
                      ? 'working'
                      : c.metadata?.isWorking === false
                        ? 'not-working'
                        : 'untested'
                  }
                  size="sm"
                />
              )}
              <button
                onClick={() => handleTestOne(c)}
                disabled={testing === c._id}
                className="flex items-center justify-center h-6 w-6 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                title="Test stream"
              >
                <Zap className="h-3 w-3" />
              </button>
            </div>
          ),
        },
        {
          key: 'plays',
          header: (
            <span className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium">
              Plays
            </span>
          ),
          cell: (c: Channel) => (
            <span className="text-xs tabular-nums font-display">{c.metrics?.playCount || 0}</span>
          ),
        },
      ];

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
          <p className="text-sm text-muted-foreground mt-1">
            {isAdmin ? `${totalCount} total channels` : `${channels.length} channels`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={isAdmin ? '/admin/quick-pick' : '/user/quick-pick'}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-2 border-primary bg-primary/10 text-primary uppercase tracking-[0.1em] transition-colors hover:bg-primary/20"
          >
            <Zap className="h-4 w-4" /> Quick Pick
          </Link>
          <button
            onClick={() => {
              if (isAdmin) {
                setShowAdd(true);
                setAddError('');
              } else {
                setShowAdd(!showAdd);
                if (!showAdd && allChannels.length === 0) fetchAllChannels();
              }
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-primary text-primary-foreground uppercase tracking-[0.1em] transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Add Stream
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-2 border-border bg-card shadow-sm transition-colors hover:border-primary/40 uppercase tracking-[0.1em]"
          >
            <Upload className="h-4 w-4" /> Import M3U
          </button>
          {channels.length > 0 && (
            <button
              onClick={handleCopyM3U}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-2 border-border bg-card shadow-sm transition-colors hover:border-primary/40 uppercase tracking-[0.1em]"
            >
              {copied ? (
                <Check className="h-4 w-4 text-signal-green" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Export M3U
            </button>
          )}
          <button
            onClick={isAdmin ? handleTestAll : handleTestAllUser}
            disabled={testingAll}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-2 border-border bg-card shadow-sm transition-colors hover:border-primary/40 uppercase tracking-[0.1em] disabled:opacity-50"
          >
            {testingAll ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            Test All
          </button>
          {channels.length > 0 && (
            <button
              onClick={() => (isAdmin ? setShowBulkDelete(true) : handleBulkDelete())}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-2 border-destructive/30 bg-card shadow-sm transition-colors hover:border-destructive/60 text-destructive uppercase tracking-[0.1em]"
            >
              <Trash2 className="h-4 w-4" /> Delete All
            </button>
          )}
        </div>
      </div>

      {/* Test results banner */}
      {testResults && (
        <div className="border border-border bg-muted/50 px-4 py-3 text-sm flex items-center justify-between">
          <span>
            Test complete:{' '}
            <strong className="text-signal-green">{testResults.working} working</strong>,{' '}
            <strong className="text-signal-red">{testResults.failed} failed</strong>
          </span>
          <button
            onClick={() => setTestResults(null)}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* User: Add from system panel */}
      {!isAdmin && showAdd && (
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

      {error && (
        <div
          role="alert"
          className="border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      <SearchInput
        value={search}
        onChange={handleSearchChange}
        placeholder={isAdmin ? 'Search channels...' : 'Search my channels...'}
        ariaLabel="Search channels"
      />

      {/* Stream health stats */}
      {(() => {
        const list = isAdmin ? channels : channels;
        const working = list.filter((c) => c.metadata?.isWorking === true).length;
        const notWorking = list.filter((c) => c.metadata?.isWorking === false).length;
        const untested = list.length - working - notWorking;
        return (
          <div className="flex items-center gap-4 px-4 py-2.5 bg-muted/50 border border-border text-xs">
            <Zap className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-signal-green font-medium">{working} working</span>
            <span className="text-signal-red font-medium">{notWorking} not working</span>
            <span className="text-muted-foreground font-medium">{untested} untested</span>
            {!isAdmin && filtered.length !== channels.length && (
              <span className="text-muted-foreground">
                (showing {filtered.length} of {channels.length})
              </span>
            )}
          </div>
        );
      })()}

      {/* Channel List */}
      <ChannelDataTable<Channel>
        data={displayData}
        gridTemplate={
          isAdmin ? '1fr 40px 1fr 100px 100px 120px 70px 110px' : '1fr 40px 180px 130px 60px 110px'
        }
        ariaLabel={isAdmin ? 'Channels table' : 'My channels table'}
        emptyMessage={
          debouncedSearch
            ? 'No channels match your search'
            : isAdmin
              ? 'No channels yet. Click "Add Channel" to create one or use "Import M3U" to bulk upload.'
              : 'No channels in your list yet. Click "Add" or use Quick Pick to get started.'
        }
        rowKey={(c) => c._id}
        getName={getName}
        getLogo={getLogo}
        onDetail={(c) => setDetailChannel(c)}
        nameHeader={
          !isAdmin ? (
            <button
              onClick={() => handleSort('name')}
              className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium hover:text-foreground transition-colors text-left"
            >
              Name <SortIcon field="name" />
            </button>
          ) : undefined
        }
        nameAriaSort={
          !isAdmin
            ? sortField === 'name'
              ? sortDir === 'asc'
                ? 'ascending'
                : 'descending'
              : 'none'
            : undefined
        }
        columns={tableColumns}
        getActions={(c) => ({
          onDetail: () => setDetailChannel(c),
          onPlay: () =>
            playStream(
              { name: getName(c), url: getUrl(c), channelId: c._id },
              { mode: 'direct-fallback' },
            ),
          onEdit: isAdmin ? () => openEdit(c) : undefined,
          onDelete: () => handleDelete(c._id),
        })}
      />

      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        totalCount={displayTotalCount}
        onPageChange={setPage}
      />

      {/* Admin: Add Channel Modal */}
      {isAdmin && (
        <Modal
          open={showAdd}
          onClose={() => {
            setShowAdd(false);
            setAddError('');
          }}
          title="Add New Channel"
          size="lg"
        >
          <form onSubmit={handleAddChannel} className="p-5 space-y-4">
            {addError && (
              <div
                role="alert"
                className="border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {addError}
              </div>
            )}
            <div className="grid sm:grid-cols-2 gap-4">
              {(
                [
                  {
                    id: 'add-name',
                    label: 'Channel Name',
                    key: 'channelName' as const,
                    required: true,
                    placeholder: 'e.g. BBC World News',
                  },
                  {
                    id: 'add-url',
                    label: 'Stream URL',
                    key: 'channelUrl' as const,
                    required: true,
                    placeholder: 'https://...',
                    type: 'url',
                  },
                  {
                    id: 'add-group',
                    label: 'Group',
                    key: 'channelGroup' as const,
                    placeholder: 'e.g. News',
                  },
                  {
                    id: 'add-logo',
                    label: 'Logo URL',
                    key: 'tvgLogo' as const,
                    placeholder: 'https://... (optional)',
                  },
                  {
                    id: 'add-drm-key',
                    label: 'DRM Key',
                    key: 'channelDrmKey' as const,
                    placeholder: 'Optional — for protected streams',
                  },
                  {
                    id: 'add-drm-type',
                    label: 'DRM Type',
                    key: 'channelDrmType' as const,
                    placeholder: 'e.g. Widevine, PlayReady, FairPlay',
                  },
                ] as const
              ).map((f) => (
                <div key={f.id} className="space-y-1.5">
                  <label
                    htmlFor={f.id}
                    className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground"
                  >
                    {f.label}
                  </label>
                  <input
                    id={f.id}
                    type={'type' in f ? f.type : 'text'}
                    required={'required' in f && f.required}
                    value={addForm[f.key] as string}
                    onChange={(e) => setAddForm((p) => ({ ...p, [f.key]: e.target.value }))}
                    className="flex h-10 w-full border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary"
                    placeholder={f.placeholder}
                  />
                </div>
              ))}
              <div className="space-y-1.5">
                <label
                  htmlFor="add-order"
                  className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground"
                >
                  Sort Order
                </label>
                <input
                  id="add-order"
                  type="number"
                  value={addForm.order}
                  onChange={(e) =>
                    setAddForm((p) => ({ ...p, order: parseInt(e.target.value) || 0 }))
                  }
                  className="flex h-10 w-full border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary"
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Lower numbers appear first. Leave as 0 for automatic ordering.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={addLoading}
                aria-busy={addLoading}
                className="inline-flex items-center px-6 py-2.5 text-sm font-medium bg-primary text-primary-foreground uppercase tracking-[0.1em] transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none"
              >
                {addLoading ? 'Creating...' : 'Create Channel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAdd(false);
                  setAddError('');
                }}
                className="px-6 py-2.5 text-sm font-medium border border-border uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Admin: Edit Channel Modal */}
      {isAdmin && (
        <Modal
          open={!!editChannel}
          onClose={() => setEditChannel(null)}
          title="Edit Channel"
          size="lg"
        >
          <form onSubmit={handleEditSave} className="p-5 space-y-4">
            {editError && (
              <div
                role="alert"
                className="border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {editError}
              </div>
            )}
            <div className="grid sm:grid-cols-2 gap-4">
              {(
                [
                  {
                    id: 'edit-name',
                    label: 'Channel Name',
                    key: 'channelName' as const,
                    required: true,
                  },
                  {
                    id: 'edit-url',
                    label: 'Stream URL',
                    key: 'channelUrl' as const,
                    required: true,
                    type: 'url',
                  },
                  { id: 'edit-group', label: 'Group', key: 'channelGroup' as const },
                  { id: 'edit-logo', label: 'Logo URL', key: 'tvgLogo' as const },
                  { id: 'edit-drm-key', label: 'DRM Key', key: 'channelDrmKey' as const },
                  { id: 'edit-drm-type', label: 'DRM Type', key: 'channelDrmType' as const },
                  { id: 'edit-country', label: 'Country', key: 'country' as const },
                  { id: 'edit-language', label: 'Language', key: 'language' as const },
                  { id: 'edit-quality', label: 'Quality', key: 'quality' as const },
                  { id: 'edit-network', label: 'Network', key: 'network' as const },
                  { id: 'edit-website', label: 'Website', key: 'website' as const },
                ] as const
              ).map((f) => (
                <div key={f.id} className="space-y-1.5">
                  <label
                    htmlFor={f.id}
                    className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground"
                  >
                    {f.label}
                  </label>
                  <input
                    id={f.id}
                    type={'type' in f ? f.type : 'text'}
                    required={'required' in f && f.required}
                    value={editForm[f.key] as string}
                    onChange={(e) => setEditForm((p) => ({ ...p, [f.key]: e.target.value }))}
                    className="flex h-10 w-full border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary"
                  />
                </div>
              ))}
              <div className="space-y-1.5">
                <label
                  htmlFor="edit-order"
                  className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground"
                >
                  Sort Order
                </label>
                <input
                  id="edit-order"
                  type="number"
                  value={editForm.order}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, order: parseInt(e.target.value) || 0 }))
                  }
                  className="flex h-10 w-full border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Lower numbers appear first. Leave as 0 for automatic ordering.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={editLoading}
                aria-busy={editLoading}
                className="inline-flex items-center px-6 py-2.5 text-sm font-medium bg-primary text-primary-foreground uppercase tracking-[0.1em] transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {editLoading ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={() => setEditChannel(null)}
                className="px-6 py-2.5 text-sm font-medium border border-border uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      <ChannelDetailModal
        open={!!detailChannel}
        onClose={() => setDetailChannel(null)}
        channel={
          detailChannel
            ? {
                channelName: getName(detailChannel),
                channelId: detailChannel.channelId,
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
                playStream(
                  {
                    name: getName(detailChannel),
                    url: getUrl(detailChannel),
                    channelId: detailChannel._id,
                  },
                  { mode: 'direct-fallback' },
                );
                setDetailChannel(null);
              }
            : undefined
        }
        actions={
          isAdmin && detailChannel ? (
            <button
              onClick={() => {
                openEdit(detailChannel);
                setDetailChannel(null);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium border border-border uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
            >
              Edit
            </button>
          ) : undefined
        }
      />

      {/* Admin: Bulk Delete Confirmation */}
      {isAdmin && (
        <ConfirmDialog
          open={showBulkDelete}
          title="Delete All Channels"
          message={`This will permanently delete all ${totalCount} channels. This action cannot be undone.`}
          confirmLabel="Delete All"
          variant="destructive"
          loading={bulkDeleteLoading}
          onConfirm={handleBulkDelete}
          onCancel={() => setShowBulkDelete(false)}
        />
      )}

      {/* M3U Import Modal */}
      <Modal
        open={showImport}
        onClose={() => setShowImport(false)}
        title="Import M3U Playlist"
        size="lg"
      >
        <form onSubmit={handleImport} className="p-5 space-y-4">
          {importResult && (
            <div
              className={`border px-3 py-2 text-sm ${importResult.startsWith('Imported') || importResult.startsWith('Added') ? 'border-signal-green/40 bg-signal-green/10 text-signal-green' : 'border-destructive/40 bg-destructive/10 text-destructive'}`}
            >
              {importResult}
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
              M3U Content
            </label>
            <textarea
              value={importContent}
              onChange={(e) => setImportContent(e.target.value)}
              rows={10}
              required
              className="w-full border border-border bg-background px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary resize-y"
              placeholder={
                '#EXTM3U\n#EXTINF:-1 tvg-name="Channel" group-title="Group",Channel Name\nhttp://stream.url/live'
              }
            />
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-border text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
            >
              <Upload className="h-4 w-4" /> Upload File
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".m3u,.m3u8"
              onChange={handleFileUpload}
              className="hidden"
            />
            {isAdmin && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={importClear}
                  onChange={(e) => setImportClear(e.target.checked)}
                  className="accent-primary"
                />
                Clear existing channels before import
              </label>
            )}
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={importLoading || !importContent.trim()}
              className="inline-flex items-center px-6 py-2.5 text-sm font-medium bg-primary text-primary-foreground uppercase tracking-[0.1em] transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {importLoading ? 'Importing...' : 'Import'}
            </button>
            <button
              type="button"
              onClick={() => setShowImport(false)}
              className="px-6 py-2.5 text-sm font-medium border border-border uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
