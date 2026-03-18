'use client';

import { useEffect, useState, useCallback } from 'react';
import { Calendar, RefreshCw, Loader2, Clock, Tv, Globe } from 'lucide-react';
import api from '@/lib/api';

interface EpgStats {
  totalPrograms: number;
  channelsWithEpg: number;
  totalSystemChannels: number;
  lastRefreshedAt: string | null;
  nextRefreshAt: string | null;
  sourcesDiscovered: number;
  refreshInProgress: boolean;
}

interface EpgSource {
  url: string;
  source: string;
  coveredChannels: number;
}

function formatRelativeTime(dateStr: string | null) {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatFutureTime(dateStr: string | null) {
  if (!dateStr) return 'Not scheduled';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);

  if (diffMin < 1) return 'Imminent';
  if (diffMin < 60) return `In ${diffMin}m`;
  if (diffHr < 24) return `In ${diffHr}h ${diffMin % 60}m`;
  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function EpgPage() {
  const [stats, setStats] = useState<EpgStats | null>(null);
  const [sources, setSources] = useState<EpgSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/epg/status');
      if (res.data?.success) {
        setStats(res.data.data);
      }
    } catch {
      setError('Failed to load EPG stats');
    }
  }, []);

  const fetchSources = useCallback(async () => {
    setSourcesLoading(true);
    try {
      const res = await api.get('/epg/sources');
      if (res.data?.success) {
        setSources(res.data.data || []);
      }
    } catch {
      // Sources endpoint might fail if no channels exist yet
    } finally {
      setSourcesLoading(false);
    }
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      await Promise.all([fetchStats(), fetchSources()]);
      setLoading(false);
    }
    load();
  }, [fetchStats, fetchSources]);

  // Poll stats while refresh is in progress
  useEffect(() => {
    if (!stats?.refreshInProgress && !refreshing) return;
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, [stats?.refreshInProgress, refreshing, fetchStats]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await api.post('/epg/refresh');
      // Poll for completion
      setTimeout(async () => {
        await fetchStats();
        await fetchSources();
        setRefreshing(false);
      }, 2000);
    } catch {
      setError('Failed to trigger EPG refresh');
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {error}
      </div>
    );
  }

  const coveragePercent =
    stats && stats.totalSystemChannels > 0
      ? Math.round((stats.channelsWithEpg / stats.totalSystemChannels) * 100)
      : 0;

  const isRefreshing = refreshing || stats?.refreshInProgress;

  const metrics = [
    {
      label: 'Total Programs',
      value: stats?.totalPrograms.toLocaleString() ?? '0',
      sub: 'In database',
      color: 'bg-signal-blue',
      icon: Calendar,
    },
    {
      label: 'EPG Coverage',
      value: `${coveragePercent}%`,
      sub: `${stats?.channelsWithEpg ?? 0} of ${stats?.totalSystemChannels ?? 0} channels`,
      color:
        coveragePercent > 50
          ? 'bg-signal-green'
          : coveragePercent > 0
            ? 'bg-signal-amber'
            : 'bg-signal-red',
      icon: Tv,
    },
    {
      label: 'Sources',
      value: stats?.sourcesDiscovered ?? 0,
      sub: 'Auto-discovered',
      color: 'bg-primary',
      icon: Globe,
    },
    {
      label: 'Last Refresh',
      value: formatRelativeTime(stats?.lastRefreshedAt ?? null),
      sub: `Next: ${formatFutureTime(stats?.nextRefreshAt ?? null)}`,
      color: stats?.lastRefreshedAt ? 'bg-signal-green' : 'bg-signal-red',
      icon: Clock,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between ">
        <div>
          <h1 className="text-lg font-display font-bold uppercase tracking-[0.1em]">EPG Guide</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Automatic Electronic Program Guide management
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={!!isRefreshing}
          aria-label="Refresh EPG data"
          className="flex items-center gap-2 px-3 py-1.5 text-xs uppercase tracking-[0.1em] font-medium border border-border hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh Now'}
        </button>
      </div>

      {/* Status Banner */}
      {isRefreshing && (
        <div className="border border-signal-blue/30 bg-signal-blue/5 px-4 py-3 flex items-center gap-3 ">
          <Loader2 className="h-4 w-4 animate-spin text-signal-blue" />
          <p className="text-sm">
            EPG refresh in progress. Fetching program data from discovered sources...
          </p>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="border border-border ">
        <div className="grid grid-cols-2 md:grid-cols-4">
          {metrics.map((metric, i) => {
            const Icon = metric.icon;
            return (
              <div
                key={metric.label}
                className={`p-4 ${i % 2 !== 0 ? 'border-l border-border' : ''} ${
                  i >= 2 ? 'border-t border-border md:border-t-0' : ''
                } ${i === 2 ? 'md:border-l' : ''}`}
              >
                <div className="relative inline-flex items-center gap-1.5">
                  <Icon className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                  <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                    {metric.label}
                  </p>
                </div>
                <p className="text-2xl font-display font-bold mt-1.5 tabular-nums">
                  {metric.value}
                </p>
                <div className="flex items-center gap-1.5 mt-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${metric.color}`} aria-hidden="true" />
                  <span className="text-xs text-muted-foreground">{metric.sub}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* How it works */}
      <div className="border border-border ">
        <div className="border-b border-border px-4 py-2.5">
          <h2 className="text-xs font-bold uppercase tracking-[0.15em]">How EPG Works</h2>
        </div>
        <div className="p-4 space-y-2 text-sm text-muted-foreground">
          <p>
            EPG data is{' '}
            <strong className="text-foreground">automatically discovered and fetched</strong> based
            on the channels in your system:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>
              Channels from <strong className="text-foreground">iptv-org</strong> are matched
              against their guides database
            </li>
            <li>
              <strong className="text-foreground">Pluto TV</strong> and{' '}
              <strong className="text-foreground">Samsung TV Plus</strong> EPG is fetched from
              i.mjh.nz
            </li>
            <li>
              Data refreshes automatically every{' '}
              <strong className="text-foreground">6 hours</strong>
            </li>
            <li>Old programs are automatically cleaned up after 48 hours</li>
          </ul>
          <p className="pt-1">
            IPTV players access EPG via the{' '}
            <code className="text-xs bg-muted px-1.5 py-0.5 font-mono">/api/v1/tv/epg/:code</code>{' '}
            endpoint using the channel list code. The M3U playlist header includes the EPG URL
            automatically.
          </p>
        </div>
      </div>

      {/* Discovered Sources */}
      <div className="border border-border ">
        <div className="border-b border-border px-4 py-2.5 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-[0.15em]">Discovered EPG Sources</h2>
          <button
            onClick={fetchSources}
            disabled={sourcesLoading}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {sourcesLoading ? 'Loading...' : 'Reload'}
          </button>
        </div>

        {sources.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>No EPG sources discovered yet.</p>
            <p className="text-xs mt-1">
              Import channels first, then EPG sources will be auto-detected.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {sources.map((source, i) => (
              <div key={i} className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`text-xs uppercase tracking-wider font-bold px-1.5 py-0.5 border ${
                      source.source === 'iptv-org'
                        ? 'border-signal-blue/40 text-signal-blue bg-signal-blue/5'
                        : source.source === 'pluto-tv'
                          ? 'border-signal-green/40 text-signal-green bg-signal-green/5'
                          : 'border-signal-amber/40 text-signal-amber bg-signal-amber/5'
                    }`}
                  >
                    {source.source}
                    <span className="sr-only"> source</span>
                  </span>
                  <span className="text-xs font-mono text-muted-foreground truncate">
                    {source.url}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-4">
                  <Tv className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs tabular-nums">{source.coveredChannels}</span>
                  <span className="text-xs text-muted-foreground">channels</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
