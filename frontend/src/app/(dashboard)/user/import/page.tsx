'use client';

import { useEffect, useState } from 'react';
import { Loader2, Globe, RefreshCw } from 'lucide-react';
import api from '@/lib/api';
import { proxyImageUrl } from '@/lib/image-proxy';
import { useToast } from '@/hooks/use-toast';

interface Playlist {
  id: string;
  name: string;
  country?: string;
  languages?: string[];
  categories?: string[];
}

interface EnrichedChannel {
  channelId: string;
  channelName: string;
  channelUrl: string;
  channelCategories?: string[];
  languages?: string[];
  tvgLogo?: string;
  groupTitle?: string;
  country?: string;
}

export default function ImportPage() {
  const { toast } = useToast();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null);
  const [channels, setChannels] = useState<EnrichedChannel[]>([]);
  const [fetchingChannels, setFetchingChannels] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

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
    setSelectedIds(new Set());
    setImportResult(null);

    try {
      const params = new URLSearchParams();
      if (playlist.country) params.set('country', playlist.country);
      if (playlist.languages?.length) params.set('language', playlist.languages.join(','));
      if (playlist.categories?.length) params.set('category', playlist.categories.join(','));

      const res = await api.get(`/iptv-org/fetch?${params.toString()}`);
      const body = res.data;
      const data = body.data || [];
      setChannels(data);
      setSelectedIds(new Set(data.map((c: EnrichedChannel) => c.channelId || c.channelName)));
    } catch {
      toast('Failed to fetch channels', 'error');
    } finally {
      setFetchingChannels(false);
    }
  }

  async function handleImportToMyList() {
    if (channels.length === 0) return;
    setImporting(true);
    setImportResult(null);

    const toImport = channels
      .filter((c) => selectedIds.has(c.channelId || c.channelName))
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
    if (selectedIds.size === channels.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(channels.map((c) => c.channelId || c.channelName)));
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

      {!fetchingChannels && channels.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              {channels.length} channels found &middot; {selectedIds.size} selected
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={toggleAll}
                className="text-xs uppercase tracking-[0.1em] text-primary hover:text-primary/80 font-medium transition-colors"
              >
                {selectedIds.size === channels.length ? 'Deselect All' : 'Select All'}
              </button>
              <button
                onClick={handleImportToMyList}
                disabled={importing || selectedIds.size === 0}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-primary text-primary-foreground uppercase tracking-[0.1em] transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none"
              >
                {importing ? 'Importing...' : `Import ${selectedIds.size} to My List`}
              </button>
            </div>
          </div>

          {importResult && (
            <div
              role="alert"
              aria-live="polite"
              className="border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary mb-4"
            >
              {importResult}
            </div>
          )}

          <div className="border border-border divide-y divide-border max-h-[500px] overflow-y-auto">
            {channels.map((ch) => {
              const key = ch.channelId || ch.channelName;
              return (
                <label
                  key={key}
                  className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(key)}
                    onChange={(e) => {
                      const next = new Set(selectedIds);
                      if (e.target.checked) {
                        next.add(key);
                      } else {
                        next.delete(key);
                      }
                      setSelectedIds(next);
                    }}
                    className="accent-primary"
                  />
                  {ch.tvgLogo ? (
                    <img
                      src={proxyImageUrl(ch.tvgLogo)}
                      alt={`${ch.channelName} logo`}
                      loading="lazy"
                      className="h-6 w-6 rounded-sm object-contain shrink-0 bg-muted"
                    />
                  ) : (
                    <div className="h-6 w-6 rounded-sm bg-muted shrink-0" />
                  )}
                  <span className="text-sm font-medium flex-1 truncate">{ch.channelName}</span>
                  <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                    {ch.groupTitle || ch.channelCategories?.join(', ') || ''}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
