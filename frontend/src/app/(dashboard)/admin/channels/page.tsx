'use client';

import { useEffect, useState, useRef } from 'react';
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
import ConfirmDialog from '@/components/ui/confirm-dialog';
import Pagination from '@/components/ui/pagination';
import Modal from '@/components/ui/modal';

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
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 50;

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

  // Player
  const [playerChannel, setPlayerChannel] = useState<Channel | null>(null);

  async function fetchChannels() {
    try {
      const res = await api.get('/admin/channels');
      const body = res.data;
      setChannels(Array.isArray(body) ? body : body.data || body.channels || []);
    } catch {
      setError('Failed to load channels');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchChannels();
  }, []);
  useEffect(() => {
    setPage(1);
  }, [search]);

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
    });
    setEditError('');
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this channel?')) return;
    try {
      await api.delete(`/admin/channels/${id}`);
      setChannels((prev) => prev.filter((c) => c._id !== id));
    } catch {
      alert('Failed to delete channel');
    }
  }

  async function handleBulkDelete() {
    setBulkDeleteLoading(true);
    try {
      await api.delete('/admin/channels');
      setChannels([]);
      setShowBulkDelete(false);
    } catch {
      alert('Failed to delete all channels');
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
        alert('Another test is already in progress. Please wait.');
    } finally {
      setTestingAll(false);
    }
  }

  const filtered = channels.filter(
    (c) =>
      getName(c).toLowerCase().includes(search.toLowerCase()) ||
      c.channelGroup?.toLowerCase().includes(search.toLowerCase()),
  );
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

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
      <div className="flex flex-wrap items-center justify-between gap-3 animate-fade-up">
        <div>
          <h1 className="text-lg font-display font-bold uppercase tracking-[0.1em]">Channels</h1>
          <p className="text-sm text-muted-foreground mt-1">{channels.length} total channels</p>
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
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-2 border-border bg-card shadow-sm transition-all hover:border-primary/40 uppercase tracking-[0.1em]"
          >
            <Upload className="h-4 w-4" /> Import M3U
          </button>
          <button
            onClick={handleTestAll}
            disabled={testingAll}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-2 border-border bg-card shadow-sm transition-all hover:border-primary/40 uppercase tracking-[0.1em] disabled:opacity-50"
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
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-2 border-destructive/30 bg-card shadow-sm transition-all hover:border-destructive/60 text-destructive uppercase tracking-[0.1em]"
            >
              <Trash2 className="h-4 w-4" /> Delete All
            </button>
          )}
        </div>
      </div>

      {/* Test results banner */}
      {testResults && (
        <div className="border border-border bg-muted/50 px-4 py-3 text-sm flex items-center justify-between animate-fade-up">
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
      <div className="relative animate-fade-up" style={{ animationDelay: '50ms' }}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search channels..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 pl-10 pr-4 border border-border bg-card text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Channel List */}
      <div
        className="border border-border divide-y divide-border animate-fade-up"
        style={{ animationDelay: '100ms' }}
      >
        <div className="hidden lg:grid grid-cols-[1fr,1fr,100px,140px] gap-4 px-4 py-2 bg-muted/50">
          <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
            Name
          </span>
          <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
            Group
          </span>
          <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
            Status
          </span>
          <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium text-right">
            Actions
          </span>
        </div>
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
              className="grid lg:grid-cols-[1fr,1fr,100px,140px] gap-2 lg:gap-4 items-center px-4 py-3"
            >
              <div
                className="flex items-center gap-3 min-w-0 cursor-pointer"
                onClick={() => setDetailChannel(channel)}
              >
                {getLogo(channel) ? (
                  <img
                    src={proxyImageUrl(getLogo(channel)!)}
                    alt=""
                    className="h-6 w-6 rounded-sm object-contain shrink-0 bg-muted"
                  />
                ) : (
                  <div className="h-6 w-6 rounded-sm bg-muted shrink-0" />
                )}
                <span className="text-sm font-medium truncate">{getName(channel)}</span>
              </div>
              <span className="text-sm text-muted-foreground truncate">
                {channel.channelGroup || '—'}
              </span>
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${channel.metadata?.isWorking !== false ? 'bg-signal-green' : 'bg-signal-red'}`}
                />
                <span className="text-[11px] text-muted-foreground">
                  {channel.metadata?.isWorking === false ? 'Down' : 'Active'}
                </span>
              </div>
              <div className="flex items-center justify-end gap-1">
                <button
                  onClick={() => setDetailChannel(channel)}
                  className="flex items-center justify-center h-8 w-8 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="View details"
                >
                  <Eye className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPlayerChannel(channel)}
                  className="flex items-center justify-center h-8 w-8 text-muted-foreground hover:text-primary transition-colors"
                  aria-label="Play stream"
                >
                  <Play className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleTestOne(channel)}
                  disabled={testing === channel._id}
                  className="flex items-center justify-center h-8 w-8 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
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
                  className="flex items-center justify-center h-8 w-8 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Edit channel"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(channel._id)}
                  className="flex items-center justify-center h-8 w-8 text-muted-foreground hover:text-destructive transition-colors"
                  aria-label={`Delete ${getName(channel)}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <Pagination
        page={page}
        pageSize={pageSize}
        totalCount={filtered.length}
        onPageChange={setPage}
      />

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
                  className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground"
                >
                  {f.label}
                </label>
                <input
                  id={f.id}
                  type={'type' in f ? f.type : 'text'}
                  required={'required' in f && f.required}
                  value={addForm[f.key] as string}
                  onChange={(e) => setAddForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  className="flex h-10 w-full border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder={f.placeholder}
                />
              </div>
            ))}
            <div className="space-y-1.5">
              <label
                htmlFor="add-order"
                className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground"
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
                className="flex h-10 w-full border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="0"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={addLoading}
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
              ] as const
            ).map((f) => (
              <div key={f.id} className="space-y-1.5">
                <label
                  htmlFor={f.id}
                  className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground"
                >
                  {f.label}
                </label>
                <input
                  id={f.id}
                  type={'type' in f ? f.type : 'text'}
                  required={'required' in f && f.required}
                  value={editForm[f.key] as string}
                  onChange={(e) => setEditForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  className="flex h-10 w-full border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            ))}
            <div className="space-y-1.5">
              <label
                htmlFor="edit-order"
                className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground"
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
                className="flex h-10 w-full border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={editLoading}
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
                  alt=""
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
                  setPlayerChannel(detailChannel);
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
        message={`This will permanently delete all ${channels.length} channels. This action cannot be undone.`}
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
            <label className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
              M3U Content
            </label>
            <textarea
              value={importContent}
              onChange={(e) => setImportContent(e.target.value)}
              rows={10}
              required
              className="w-full border border-border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-y"
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

      {/* Channel Player Modal */}
      <ChannelPlayerInline channel={playerChannel} onClose={() => setPlayerChannel(null)} />
    </div>
  );
}

/* ─── Inline HLS Player Component ─── */
function ChannelPlayerInline({
  channel,
  onClose,
}: {
  channel: Channel | null;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<{ destroy: () => void } | null>(null);
  const [status, setStatus] = useState('Loading...');
  const [playerError, setPlayerError] = useState('');

  useEffect(() => {
    if (!channel || !videoRef.current) return;
    const video = videoRef.current;
    const streamUrl = `/api/v1/stream-proxy?url=${encodeURIComponent(getUrl(channel))}`;
    const sessionId = typeof window !== 'undefined' ? localStorage.getItem('sessionId') : null;
    let destroyed = false;

    async function initPlayer() {
      const HlsModule = await import('hls.js');
      const Hls = HlsModule.default;
      if (destroyed) return;

      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 90,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          manifestLoadingTimeOut: 10000,
          manifestLoadingMaxRetry: 3,
          levelLoadingTimeOut: 10000,
          levelLoadingMaxRetry: 3,
          fragLoadingTimeOut: 20000,
          fragLoadingMaxRetry: 3,
          xhrSetup: (xhr: XMLHttpRequest, xhrUrl: string) => {
            if (xhrUrl.includes('/api/v1/stream-proxy') && sessionId) {
              xhr.setRequestHeader('X-Session-Id', sessionId);
            }
          },
        });
        hlsRef.current = hls;
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (!destroyed) {
            setStatus('Playing');
            video.play().catch(() => {});
          }
        });
        hls.on(
          Hls.Events.ERROR,
          (_event: string, data: { fatal: boolean; type: string; details: string }) => {
            if (destroyed) return;
            if (data.fatal) {
              if (data.type === 'networkError') {
                setStatus('Network error — retrying...');
                hls.startLoad();
              } else if (data.type === 'mediaError') {
                setStatus('Media error — recovering...');
                hls.recoverMediaError();
              } else {
                setPlayerError(`Fatal error: ${data.details}`);
                hls.destroy();
              }
            }
          },
        );
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl;
        video.addEventListener('loadedmetadata', () => {
          if (!destroyed) {
            setStatus('Playing');
            video.play().catch(() => {});
          }
        });
      } else {
        setPlayerError(
          'Your browser does not support HLS streaming. Please try Chrome, Firefox, or Safari.',
        );
      }
    }

    initPlayer();
    const onPlaying = () => !destroyed && setStatus('Playing');
    const onPause = () => !destroyed && setStatus('Paused');
    const onWaiting = () => !destroyed && setStatus('Buffering...');
    const onVidError = () => !destroyed && setPlayerError('Playback error');
    video.addEventListener('playing', onPlaying);
    video.addEventListener('pause', onPause);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('error', onVidError);

    return () => {
      destroyed = true;
      hlsRef.current?.destroy();
      hlsRef.current = null;
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('error', onVidError);
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [channel]);

  if (!channel) return null;

  return (
    <Modal open={!!channel} onClose={onClose} title={getName(channel)} size="xl">
      <div className="bg-black">
        <video ref={videoRef} controls className="w-full max-h-[80vh]" playsInline />
      </div>
      <div className="flex items-center justify-between px-5 py-2.5 border-t border-border">
        <span
          className="text-xs text-muted-foreground truncate max-w-[60%]"
          title={getUrl(channel)}
        >
          {getUrl(channel)}
        </span>
        <span
          className={`text-xs font-medium ${playerError ? 'text-signal-red' : status === 'Playing' ? 'text-signal-green' : 'text-muted-foreground'}`}
        >
          {playerError || status}
        </span>
      </div>
    </Modal>
  );
}
