'use client';

import { useEffect, useState, useRef, useCallback, useDeferredValue } from 'react';
import {
  Loader2,
  Trash2,
  Search,
  Plus,
  Pencil,
  Play,
  TestTube,
  Upload,
  Eye,
  X,
} from 'lucide-react';
import api from '@/lib/api';
import { proxyImageUrl } from '@/lib/image-proxy';
import { useToast } from '@/hooks/use-toast';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import Pagination from '@/components/ui/pagination';
import Modal from '@/components/ui/modal';
import { useStreamPlayer } from '@/components/stream-player-context';
import ColumnFilter from '@/components/ui/column-filter';

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

export default function ChannelsPage() {
  const { toast } = useToast();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 50;

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

  // Add channel form
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

  // Edit channel
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

  // M3U Import
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

  const { playStream } = useStreamPlayer();

  const fetchChannels = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (deferredSearch) params.set('search', deferredSearch);
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
      if (selectedCountries.length > 0 && selectedCountries.length < filterOptions.country.length) {
        params.set('country', selectedCountries.join(','));
      }
      const res = await api.get(`/admin/channels?${params.toString()}`);
      const body = res.data;
      setChannels(Array.isArray(body) ? body : body.data || body.channels || []);
      setTotalCount(body.totalCount ?? (Array.isArray(body) ? body.length : body.count || 0));
    } catch {
      setError('Failed to load channels');
    } finally {
      setLoading(false);
    }
  }, [
    page,
    deferredSearch,
    selectedGroups,
    selectedStatuses,
    selectedLanguages,
    selectedCountries,
    filterOptions,
  ]);

  async function refreshFilterOptions() {
    try {
      const res = await api.get('/admin/channels/filter-options');
      setFilterOptions(res.data.data || { group: [], status: [], language: [], country: [] });
    } catch {
      /* ignore */
    }
  }

  // Fetch filter options once on mount
  useEffect(() => {
    refreshFilterOptions();
  }, []);

  // Track previous filter values to detect changes and reset page
  const prevFiltersRef = useRef({
    deferredSearch,
    selectedGroups,
    selectedStatuses,
    selectedLanguages,
    selectedCountries,
  });

  // Fetch channels whenever filters/page/search change, resetting page on filter change
  useEffect(() => {
    const prev = prevFiltersRef.current;
    const filtersChanged =
      prev.deferredSearch !== deferredSearch ||
      prev.selectedGroups !== selectedGroups ||
      prev.selectedStatuses !== selectedStatuses ||
      prev.selectedLanguages !== selectedLanguages ||
      prev.selectedCountries !== selectedCountries;
    prevFiltersRef.current = {
      deferredSearch,
      selectedGroups,
      selectedStatuses,
      selectedLanguages,
      selectedCountries,
    };

    if (filtersChanged && page !== 1) {
      setPage(1); // will trigger this effect again with page=1
      return;
    }
    fetchChannels();
  }, [
    fetchChannels,
    page,
    deferredSearch,
    selectedGroups,
    selectedStatuses,
    selectedLanguages,
    selectedCountries,
  ]);

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
    if (!confirm('Delete this channel?')) return;
    try {
      await api.delete(`/admin/channels/${id}`);
      setChannels((prev) => prev.filter((c) => c._id !== id));
    } catch {
      toast('Failed to delete channel', 'error');
    }
  }

  async function handleBulkDelete() {
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
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (!importContent.trim()) return;
    setImportLoading(true);
    setImportResult('');
    try {
      const res = await api.post('/admin/channels/import-m3u', {
        m3uContent: importContent,
        clearExisting: importClear,
      });
      const data = res.data;
      setImportResult(`Imported ${data.imported || data.count || 0} channels`);
      setImportContent('');
      setImportClear(false);
      fetchChannels();
      refreshFilterOptions();
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

  // Data is already filtered & paginated server-side
  const paginated = channels;

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
          <h1 className="text-lg font-display font-bold uppercase tracking-[0.1em]">Channels</h1>
          <p className="text-sm text-muted-foreground mt-1">{totalCount} total channels</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setShowAdd(true);
              setAddError('');
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-primary text-primary-foreground uppercase tracking-[0.1em] transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-2 border-border bg-card shadow-sm transition-colors hover:border-primary/40 uppercase tracking-[0.1em]"
          >
            <Upload className="h-4 w-4" /> Import M3U
          </button>
          <button
            onClick={handleTestAll}
            disabled={testingAll}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-2 border-border bg-card shadow-sm transition-colors hover:border-primary/40 uppercase tracking-[0.1em] disabled:opacity-50"
          >
            {testingAll ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <TestTube className="h-4 w-4" />
            )}{' '}
            Test All
          </button>
          {channels.length > 0 && (
            <button
              onClick={() => setShowBulkDelete(true)}
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

      {error && (
        <div className="border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search channels..."
          aria-label="Search channels"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 pl-10 pr-4 border border-border bg-card text-sm placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary"
        />
      </div>

      {/* Channel List */}
      <div className="overflow-x-auto">
        <div
          role="table"
          aria-label="Channels table"
          className="border border-border divide-y divide-border"
        >
          <div
            role="rowgroup"
            className="hidden lg:grid grid-cols-[1fr,1fr,100px,100px,80px,140px] gap-4 px-4 py-2 bg-muted/50"
          >
            <span
              role="columnheader"
              className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium"
            >
              Name
            </span>
            <span role="columnheader">
              <ColumnFilter
                label="Group"
                options={filterOptions.group}
                selected={selectedGroups}
                onChange={setSelectedGroups}
                searchable
              />
            </span>
            <span role="columnheader">
              <ColumnFilter
                label="Country"
                options={filterOptions.country}
                selected={selectedCountries}
                onChange={setSelectedCountries}
                searchable
              />
            </span>
            <span role="columnheader">
              <ColumnFilter
                label="Language"
                options={filterOptions.language}
                selected={selectedLanguages}
                onChange={setSelectedLanguages}
                searchable
              />
            </span>
            <span role="columnheader">
              <ColumnFilter
                label="Status"
                options={filterOptions.status}
                selected={selectedStatuses}
                onChange={setSelectedStatuses}
              />
            </span>
            <span
              role="columnheader"
              className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium text-right"
            >
              Actions
            </span>
          </div>
          <div role="rowgroup">
            {paginated.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                {search
                  ? 'No channels match your search'
                  : 'No channels yet. Click "Add" to get started.'}
              </div>
            ) : (
              paginated.map((channel) => (
                <div
                  key={channel._id}
                  role="row"
                  className="grid lg:grid-cols-[1fr,1fr,100px,100px,80px,140px] gap-2 lg:gap-4 items-center px-4 py-3"
                >
                  <div
                    role="cell"
                    tabIndex={0}
                    className="flex items-center gap-3 min-w-0 cursor-pointer"
                    onClick={() => setDetailChannel(channel)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setDetailChannel(channel);
                      }
                    }}
                  >
                    {getLogo(channel) ? (
                      <img
                        src={proxyImageUrl(getLogo(channel)!)}
                        alt={getName(channel) + ' logo'}
                        loading="lazy"
                        className="h-6 w-6 rounded-sm object-contain shrink-0 bg-muted"
                      />
                    ) : (
                      <div className="h-6 w-6 rounded-sm bg-muted shrink-0" />
                    )}
                    <span className="text-sm font-medium truncate">{getName(channel)}</span>
                  </div>
                  <span role="cell" className="text-sm text-muted-foreground truncate">
                    {channel.channelGroup || '—'}
                  </span>
                  <span role="cell" className="text-xs text-muted-foreground truncate">
                    {channel.metadata?.country || '—'}
                  </span>
                  <span role="cell" className="text-xs text-muted-foreground truncate">
                    {channel.metadata?.language || '—'}
                  </span>
                  <div role="cell" className="flex items-center gap-1.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${channel.metadata?.isWorking === true ? 'bg-signal-green' : channel.metadata?.isWorking === false ? 'bg-signal-red' : 'bg-muted-foreground/40'}`}
                      aria-hidden="true"
                    />
                    <span className="text-xs text-muted-foreground">
                      {channel.metadata?.isWorking === true
                        ? 'Live'
                        : channel.metadata?.isWorking === false
                          ? 'Dead'
                          : 'Untested'}
                    </span>
                  </div>
                  <div role="cell" className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => setDetailChannel(channel)}
                      className="flex items-center justify-center h-10 w-10 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="View details"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => playStream({ name: getName(channel), url: getUrl(channel) })}
                      className="flex items-center justify-center h-10 w-10 text-muted-foreground hover:text-primary transition-colors"
                      aria-label="Play stream"
                    >
                      <Play className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleTestOne(channel)}
                      disabled={testing === channel._id}
                      className="flex items-center justify-center h-10 w-10 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                      aria-label="Test stream"
                    >
                      {testing === channel._id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <TestTube className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={() => openEdit(channel)}
                      className="flex items-center justify-center h-10 w-10 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Edit channel"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(channel._id)}
                      className="flex items-center justify-center h-10 w-10 text-muted-foreground hover:text-destructive transition-colors"
                      aria-label={`Delete ${getName(channel)}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <Pagination page={page} pageSize={pageSize} totalCount={totalCount} onPageChange={setPage} />

      {/* Add Channel Modal */}
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
            <div className="border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
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
                  placeholder: 'optional',
                },
                {
                  id: 'add-drm-type',
                  label: 'DRM Type',
                  key: 'channelDrmType' as const,
                  placeholder: 'e.g. widevine',
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

      {/* Edit Channel Modal */}
      <Modal
        open={!!editChannel}
        onClose={() => setEditChannel(null)}
        title="Edit Channel"
        size="lg"
      >
        <form onSubmit={handleEditSave} className="p-5 space-y-4">
          {editError && (
            <div className="border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
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

      {/* Channel Details Preview Modal */}
      <Modal
        open={!!detailChannel}
        onClose={() => setDetailChannel(null)}
        title="Channel Details"
        size="lg"
      >
        {detailChannel && (
          <div className="p-5 space-y-5">
            <div className="flex items-start gap-4">
              {getLogo(detailChannel) ? (
                <img
                  src={proxyImageUrl(getLogo(detailChannel)!)}
                  alt={getName(detailChannel) + ' logo'}
                  loading="lazy"
                  className="h-16 w-16 rounded object-contain bg-muted shrink-0"
                />
              ) : (
                <div className="h-16 w-16 rounded bg-muted shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-medium">{getName(detailChannel)}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {detailChannel.channelGroup || 'Uncategorized'}
                </p>
              </div>
            </div>
            <div className="divide-y divide-border border border-border">
              {[
                { label: 'Stream URL', value: getUrl(detailChannel) },
                { label: 'Channel ID', value: detailChannel.channelId },
                { label: 'Country', value: detailChannel.metadata?.country },
                { label: 'Language', value: detailChannel.metadata?.language },
                { label: 'Quality', value: detailChannel.metadata?.quality },
                { label: 'Network', value: detailChannel.metadata?.network },
                { label: 'Website', value: detailChannel.metadata?.website },
                { label: 'DRM Type', value: detailChannel.channelDrmType },
                { label: 'Sort Order', value: detailChannel.order?.toString() },
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
              ]
                .filter((r) => r.value)
                .map((r) => (
                  <div key={r.label} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm text-muted-foreground">{r.label}</span>
                    <span className="text-sm font-medium truncate max-w-[60%] text-right">
                      {r.value}
                    </span>
                  </div>
                ))}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  playStream({ name: getName(detailChannel), url: getUrl(detailChannel) });
                  setDetailChannel(null);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-primary text-primary-foreground uppercase tracking-[0.1em] transition-colors hover:bg-primary/90"
              >
                <Play className="h-4 w-4" /> Preview Stream
              </button>
              <button
                onClick={() => {
                  openEdit(detailChannel);
                  setDetailChannel(null);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium border border-border uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
              >
                <Pencil className="h-4 w-4" /> Edit
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Bulk Delete Confirmation */}
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
              className={`border px-3 py-2 text-sm ${importResult.startsWith('Imported') ? 'border-signal-green/40 bg-signal-green/10 text-signal-green' : 'border-destructive/40 bg-destructive/10 text-destructive'}`}
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
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={importClear}
                onChange={(e) => setImportClear(e.target.checked)}
                className="accent-primary"
              />
              Clear existing channels before import
            </label>
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
