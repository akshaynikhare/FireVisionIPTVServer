'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Tv,
  Users,
  Smartphone,
  ChevronRight,
  Loader2,
  Copy,
  Check,
  Zap,
  ExternalLink,
  Radio,
} from 'lucide-react';
import api from '@/lib/api';

interface DashboardStats {
  channels: { total: number; active: number; inactive: number };
  users: { total: number; active: number };
  sessions: { total: number; active: number };
  pairings: { total: number; pending: number; completed: number; today: number };
  activityFeed: Array<{ type: string; message: string; timestamp: string }>;
}

interface ConfigDefaults {
  defaultTvCode: string;
  defaultServerUrl: string;
}

interface StreamHealthData {
  channels: {
    total: number;
    working: number;
    failing: number;
    untested: number;
    totalDeadCount: number;
    totalAliveCount: number;
    totalUnresponsiveCount: number;
    totalPlayCount: number;
    totalProxyPlayCount: number;
  };
}

const quickActions = [
  { label: 'Quick Pick', href: '/admin/quick-pick', icon: Zap },
  { label: 'Manage Channels', href: '/admin/channels', icon: Tv },
  { label: 'Manage Users', href: '/admin/users', icon: Users },
  { label: 'Manage Devices', href: '/admin/devices', icon: Smartphone },
];

function formatTime(timestamp: string) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(timestamp: string) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [config, setConfig] = useState<ConfigDefaults | null>(null);
  const [streamHealth, setStreamHealth] = useState<StreamHealthData | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function copyCode(text: string) {
    navigator.clipboard.writeText(text);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }

  useEffect(() => {
    const controller = new AbortController();

    async function fetchStats() {
      try {
        const [statsRes, configRes, healthRes] = await Promise.all([
          api.get('/admin/stats/detailed', { signal: controller.signal }),
          api.get('/config/defaults', { signal: controller.signal }),
          api.get('/admin/stats/stream-health', { signal: controller.signal }).catch(() => null),
        ]);
        if (controller.signal.aborted) return;
        const res = statsRes;
        if (configRes.data?.data) {
          setConfig(configRes.data.data);
        }
        if (healthRes?.data?.data) {
          setStreamHealth(healthRes.data.data);
        }
        const data = res.data?.data || res.data;

        const activityFeed: DashboardStats['activityFeed'] = [];

        if (data.activity) {
          for (const item of data.activity) {
            activityFeed.push({
              type: item.type || 'event',
              message: item.message || item.description || item.event || String(item),
              timestamp: item.timestamp || item.createdAt || new Date().toISOString(),
            });
          }
        }

        setStats({
          channels: {
            total: data.channels?.total ?? 0,
            active: data.channels?.active ?? 0,
            inactive: data.channels?.inactive ?? 0,
          },
          users: {
            total: data.users?.total ?? 0,
            active: data.users?.active ?? 0,
          },
          sessions: {
            total: data.sessions?.total ?? 0,
            active: data.sessions?.active ?? 0,
          },
          pairings: {
            total: data.pairings?.total ?? 0,
            pending: data.pairings?.pending ?? 0,
            completed: data.pairings?.completed ?? 0,
            today: data.pairings?.todayCount ?? 0,
          },
          activityFeed,
        });
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'CanceledError') return;
        setError('Failed to load dashboard data');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    fetchStats();
    return () => controller.abort();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
      >
        {error}
      </div>
    );
  }

  const metrics = [
    {
      label: 'Channels',
      value: stats?.channels.total ?? 0,
      sub: `${stats?.channels.active ?? 0} active`,
      color: 'bg-signal-green',
      href: '/admin/channels',
    },
    {
      label: 'Users',
      value: stats?.users.total ?? 0,
      sub: `${stats?.users.active ?? 0} active`,
      color: 'bg-signal-green',
      href: '/admin/users',
    },
    {
      label: 'Sessions',
      value: stats?.sessions.active ?? 0,
      sub: `${stats?.sessions.total ?? 0} total`,
      color: 'bg-signal-blue',
      href: '/admin/devices',
    },
    {
      label: 'Pairings',
      value: stats?.pairings.today ?? 0,
      sub: `${stats?.pairings.pending ?? 0} pending`,
      color: 'bg-primary',
      href: '/admin/devices',
    },
  ];

  return (
    <div className="space-y-8">
      <div className="">
        <h1 className="text-lg font-display font-bold uppercase tracking-[0.1em]">Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">System status and recent activity</p>
      </div>

      <div className="border border-border ">
        <div className="grid grid-cols-2 md:grid-cols-4">
          {metrics.map((metric, i) => (
            <Link
              key={metric.label}
              href={metric.href}
              className={`p-4 transition-colors hover:bg-muted/50 ${i % 2 !== 0 ? 'border-l border-border' : ''} ${
                i >= 2 ? 'border-t border-border md:border-t-0' : ''
              } ${i === 2 ? 'md:border-l' : ''}`}
            >
              <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                {metric.label}
              </p>
              <p className="text-2xl font-display font-bold mt-1.5 tabular-nums">{metric.value}</p>
              <div className="flex items-center gap-1.5 mt-2">
                <span className={`w-1.5 h-1.5 rounded-full ${metric.color}`} />
                <span className="text-xs text-muted-foreground">{metric.sub}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {streamHealth && (
        <Link
          href="/admin/stats"
          className="block border border-border hover:border-primary/30 transition-colors"
        >
          <div className="px-4 py-2 bg-muted/50 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium">
                Stream Health
              </h2>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Alive</p>
                <p className="text-xl font-display font-bold tabular-nums text-[hsl(var(--signal-green))]">
                  {streamHealth.channels.totalAliveCount ?? 0}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Dead</p>
                <p className="text-xl font-display font-bold tabular-nums text-[hsl(var(--signal-red))]">
                  {streamHealth.channels.totalDeadCount ?? 0}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                  Unresponsive
                </p>
                <p className="text-xl font-display font-bold tabular-nums text-muted-foreground">
                  {streamHealth.channels.totalUnresponsiveCount ?? 0}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                  Total Plays
                </p>
                <p className="text-xl font-display font-bold tabular-nums text-primary">
                  {streamHealth.channels.totalPlayCount ?? 0}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                  Proxy Plays
                </p>
                <p className="text-xl font-display font-bold tabular-nums text-muted-foreground">
                  {streamHealth.channels.totalProxyPlayCount ?? 0}
                </p>
              </div>
            </div>
            {streamHealth.channels.total > 0 && (
              <div className="h-2 flex mt-4 overflow-hidden">
                <div
                  className="bg-[hsl(var(--signal-green))]"
                  style={{
                    width: `${(streamHealth.channels.working / streamHealth.channels.total) * 100}%`,
                  }}
                />
                <div
                  className="bg-[hsl(var(--signal-red))]"
                  style={{
                    width: `${(streamHealth.channels.failing / streamHealth.channels.total) * 100}%`,
                  }}
                />
                <div
                  className="bg-muted"
                  style={{
                    width: `${(streamHealth.channels.untested / streamHealth.channels.total) * 100}%`,
                  }}
                />
              </div>
            )}
          </div>
        </Link>
      )}

      {config?.defaultTvCode && (
        <div className="border border-primary/30 bg-primary/5 p-4 flex items-center justify-between ">
          <div>
            <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
              Default Channel List Code
            </p>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-xl font-display font-bold tracking-[0.15em] font-mono">
                {config.defaultTvCode}
              </span>
              <span className="text-xs text-muted-foreground">
                New TVs use this code before user pairing
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/api/v1/tv/playlist/${config.defaultTvCode}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border bg-card hover:bg-muted transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              Open M3U
            </a>
            <button
              onClick={() => copyCode(config.defaultTvCode)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border bg-card hover:bg-muted transition-colors"
            >
              {codeCopied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-signal-green" aria-hidden="true" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  Copy
                </>
              )}
            </button>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr,300px] gap-6">
        <div className="">
          <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">
            Recent Activity
          </h2>
          <div className="border border-border divide-y divide-border">
            {stats?.activityFeed && stats.activityFeed.length > 0 ? (
              <ul className="divide-y divide-border">
                {stats.activityFeed.slice(0, 8).map((item, i) => (
                  <li
                    key={`${item.type || 'activity'}-${item.timestamp}-${i}`}
                    className="flex items-center gap-4 px-4 py-3"
                  >
                    <div className="shrink-0 text-right w-20">
                      <time
                        dateTime={item.timestamp}
                        className="text-xs tabular-nums text-muted-foreground font-medium"
                      >
                        {formatTime(item.timestamp)}
                      </time>
                      <time
                        dateTime={item.timestamp}
                        className="text-xs text-muted-foreground/60 ml-1.5"
                      >
                        {formatDate(item.timestamp)}
                      </time>
                    </div>
                    <span className="text-sm truncate">{item.message}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No recent activity. Activity appears here when users log in, add channels, or pair
                devices.
              </div>
            )}
          </div>
        </div>

        <div className="">
          <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">
            Quick Actions
          </h2>
          <div className="space-y-2">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.label}
                  href={action.href}
                  className="flex items-center gap-3 w-full text-left px-4 py-3 text-sm font-medium border border-border bg-card transition-colors hover:border-primary/40 active:bg-muted"
                >
                  <Icon className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
                  <span className="flex-1">{action.label}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
