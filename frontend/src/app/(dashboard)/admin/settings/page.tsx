'use client';

import { useEffect, useState } from 'react';
import { Loader2, Copy, Check, Trash2 } from 'lucide-react';
import api from '@/lib/api';

interface ServerInfo {
  name: string;
  version: string;
  status: string;
  features: Record<string, boolean>;
}

interface CacheEntry {
  key: string;
  cached: boolean;
  age?: number;
  count?: number;
}

export default function SettingsPage() {
  const [info, setInfo] = useState<ServerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [cacheStatus, setCacheStatus] = useState<CacheEntry[]>([]);
  const [cacheLoading, setCacheLoading] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [infoRes, configRes] = await Promise.all([
          api.get('/config/info').catch(() => null),
          api.get('/config/defaults').catch(() => null),
        ]);
        if (infoRes) setInfo(infoRes.data.data || infoRes.data);
        const config = configRes?.data?.data || configRes?.data;
        if (config?.defaultTvCode) {
          setPlaylistUrl(
            `${window.location.origin}/api/v1/channels/playlist.m3u?code=${config.defaultTvCode}`,
          );
        }
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    }
    fetchData();
    fetchCacheStatus();
  }, []);

  async function fetchCacheStatus() {
    try {
      const res = await api.get('/iptv-org/cache-status');
      const data = res.data.data || res.data;
      if (Array.isArray(data)) {
        setCacheStatus(data);
      } else if (typeof data === 'object') {
        setCacheStatus(
          Object.entries(data).map(([key, val]) => ({
            key,
            ...(typeof val === 'object' && val !== null
              ? (val as { cached: boolean; age?: number; count?: number })
              : { cached: false }),
          })),
        );
      }
    } catch {
      /* ignore */
    }
  }

  async function handleClearCache() {
    setCacheLoading(true);
    try {
      await api.post('/iptv-org/clear-cache');
      await fetchCacheStatus();
    } catch {
      alert('Failed to clear cache');
    } finally {
      setCacheLoading(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(playlistUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function formatAge(ms?: number) {
    if (!ms) return '—';
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return '< 1 min';
    if (mins < 60) return `${mins} min`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="animate-fade-up">
        <h1 className="text-lg font-display font-bold uppercase tracking-[0.1em]">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Server configuration and info</p>
      </div>

      {info && (
        <div className="border border-border animate-fade-up" style={{ animationDelay: '50ms' }}>
          <div className="px-4 py-2 bg-muted/50 border-b border-border">
            <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
              Server Info
            </p>
          </div>
          <div className="divide-y divide-border">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-muted-foreground">Name</span>
              <span className="text-sm font-medium">{info.name}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-muted-foreground">Version</span>
              <span className="text-sm font-medium">{info.version}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-muted-foreground">Status</span>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-signal-green" />
                <span className="text-sm font-medium capitalize">{info.status}</span>
              </div>
            </div>
            {info.features && Object.keys(info.features).length > 0 && (
              <div className="px-4 py-3">
                <p className="text-sm text-muted-foreground mb-2">Features</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(info.features).map(([key, enabled]) => (
                    <span
                      key={key}
                      className={`text-[11px] uppercase tracking-[0.1em] px-2 py-1 border border-border ${enabled ? 'bg-muted/50' : 'bg-muted/20 line-through text-muted-foreground/50'}`}
                    >
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Global M3U Playlist */}
      {playlistUrl && (
        <div className="border border-border animate-fade-up" style={{ animationDelay: '75ms' }}>
          <div className="px-4 py-2 bg-muted/50 border-b border-border">
            <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
              Global Playlist
            </p>
          </div>
          <div className="px-4 py-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              M3U playlist URL containing all channels in the system.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono bg-muted px-3 py-2 truncate border border-border">
                {playlistUrl}
              </code>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-border text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-signal-green" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session Management */}
      <div className="border border-border animate-fade-up" style={{ animationDelay: '100ms' }}>
        <div className="px-4 py-2 bg-muted/50 border-b border-border">
          <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
            Session Management
          </p>
        </div>
        <div className="px-4 py-4">
          <p className="text-sm text-muted-foreground mb-3">
            Remove all expired sessions from the database.
          </p>
          <button
            onClick={async () => {
              try {
                const res = await api.post('/auth/cleanup-sessions');
                alert(res.data.message || 'Sessions cleaned up');
              } catch {
                alert('Failed to clean up sessions');
              }
            }}
            className="inline-flex items-center px-4 py-2 text-sm font-medium border-2 border-border bg-card shadow-sm transition-all hover:border-primary/40 hover:shadow-md active:shadow-none active:bg-muted"
          >
            Clean Up Expired Sessions
          </button>
        </div>
      </div>

      {/* IPTV-Org Cache Management */}
      <div className="border border-border animate-fade-up" style={{ animationDelay: '150ms' }}>
        <div className="px-4 py-2 bg-muted/50 border-b border-border flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
            IPTV-Org Cache
          </p>
          <button
            onClick={handleClearCache}
            disabled={cacheLoading}
            className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.1em] text-destructive hover:text-destructive/80 transition-colors font-medium disabled:opacity-50"
          >
            {cacheLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Trash2 className="h-3 w-3" />
            )}
            Clear Cache
          </button>
        </div>
        <div className="divide-y divide-border">
          {cacheStatus.length === 0 ? (
            <div className="px-4 py-4 text-sm text-muted-foreground">No cache data available</div>
          ) : (
            cacheStatus.map((entry) => (
              <div key={entry.key} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm capitalize">{entry.key}</span>
                <div className="flex items-center gap-3">
                  {entry.count !== undefined && (
                    <span className="text-xs text-muted-foreground">{entry.count} items</span>
                  )}
                  <span className="text-xs text-muted-foreground">{formatAge(entry.age)}</span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${entry.cached ? 'bg-signal-green' : 'bg-muted-foreground/30'}`}
                    />
                    <span className="text-[11px] text-muted-foreground">
                      {entry.cached ? 'Cached' : 'Empty'}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
