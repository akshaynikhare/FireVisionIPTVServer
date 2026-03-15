'use client';

import { useEffect, useState } from 'react';
import { Loader2, Trash2, Search, Plus } from 'lucide-react';
import api from '@/lib/api';

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
  isActive?: boolean;
  metadata?: { isWorking?: boolean };
}

function getName(c: Channel) {
  return c.channelName || c.name || 'Unnamed';
}

function getLogo(c: Channel) {
  return c.tvgLogo || c.channelImg || c.logo;
}

export default function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  // Add channel form
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState('');
  const [addUrl, setAddUrl] = useState('');
  const [addGroup, setAddGroup] = useState('');
  const [addLogo, setAddLogo] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

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

  async function handleAddChannel(e: React.FormEvent) {
    e.preventDefault();
    setAddError('');
    setAddLoading(true);
    try {
      const channelId = addName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      await api.post('/admin/channels', {
        channelId,
        channelName: addName,
        channelUrl: addUrl,
        channelGroup: addGroup || 'Uncategorized',
        tvgLogo: addLogo || '',
      });
      setShowAdd(false);
      setAddName('');
      setAddUrl('');
      setAddGroup('');
      setAddLogo('');
      fetchChannels();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setAddError(axiosErr.response?.data?.error || 'Failed to create channel');
    } finally {
      setAddLoading(false);
    }
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

  const filtered = channels.filter(
    (c) =>
      getName(c).toLowerCase().includes(search.toLowerCase()) ||
      c.channelGroup?.toLowerCase().includes(search.toLowerCase()),
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="text-lg font-display font-bold uppercase tracking-[0.1em]">Channels</h1>
          <p className="text-sm text-muted-foreground mt-1">{channels.length} total channels</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-primary text-primary-foreground uppercase tracking-[0.1em] transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Channel
        </button>
      </div>

      {showAdd && (
        <form
          onSubmit={handleAddChannel}
          className="border-2 border-primary/30 bg-card p-5 space-y-4 animate-fade-up"
        >
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
            Add New Channel
          </p>
          {addError && (
            <div className="border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {addError}
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="add-name"
                className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground"
              >
                Channel Name
              </label>
              <input
                id="add-name"
                type="text"
                required
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                className="flex h-10 w-full border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="e.g. BBC World News"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="add-url"
                className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground"
              >
                Stream URL
              </label>
              <input
                id="add-url"
                type="url"
                required
                value={addUrl}
                onChange={(e) => setAddUrl(e.target.value)}
                className="flex h-10 w-full border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="https://..."
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="add-group"
                className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground"
              >
                Group
              </label>
              <input
                id="add-group"
                type="text"
                value={addGroup}
                onChange={(e) => setAddGroup(e.target.value)}
                className="flex h-10 w-full border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="e.g. News"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="add-logo"
                className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground"
              >
                Logo URL
              </label>
              <input
                id="add-logo"
                type="text"
                value={addLogo}
                onChange={(e) => setAddLogo(e.target.value)}
                className="flex h-10 w-full border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="https://... (optional)"
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
              className="px-6 py-2.5 text-sm font-medium border border-border uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:text-foreground hover:border-foreground/20"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && (
        <div className="border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

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

      <div
        className="border border-border divide-y divide-border animate-fade-up"
        style={{ animationDelay: '100ms' }}
      >
        <div className="hidden sm:grid grid-cols-[1fr,1fr,100px,48px] gap-4 px-4 py-2 bg-muted/50">
          <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
            Name
          </span>
          <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
            Group
          </span>
          <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
            Status
          </span>
          <span />
        </div>
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            {search
              ? 'No channels match your search'
              : 'No channels yet. Click "Add Channel" to get started.'}
          </div>
        ) : (
          filtered.slice(0, 100).map((channel) => (
            <div
              key={channel._id}
              className="grid sm:grid-cols-[1fr,1fr,100px,48px] gap-2 sm:gap-4 items-center px-4 py-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                {getLogo(channel) ? (
                  <img
                    src={getLogo(channel)!}
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
              <button
                onClick={() => handleDelete(channel._id)}
                className="flex items-center justify-center h-8 w-8 text-muted-foreground hover:text-destructive transition-colors"
                aria-label={`Delete ${getName(channel)}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>
      {filtered.length > 100 && (
        <p className="text-xs text-muted-foreground text-center">
          Showing first 100 of {filtered.length} channels
        </p>
      )}
    </div>
  );
}
