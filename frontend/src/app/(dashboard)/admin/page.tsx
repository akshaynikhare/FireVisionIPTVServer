'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Tv, Users, Smartphone, ChevronRight, Loader2 } from 'lucide-react';
import api from '@/lib/api';

interface DashboardStats {
  channels: { total: number; active: number; inactive: number };
  users: { total: number; active: number };
  sessions: { total: number; active: number };
  pairings: { total: number; pending: number; completed: number; today: number };
  activityFeed: Array<{ type: string; message: string; timestamp: string }>;
}

const quickActions = [
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await api.get('/admin/stats/detailed');
        const data = res.data;

        const activityFeed: DashboardStats['activityFeed'] = [];

        if (data.activityFeed) {
          for (const item of data.activityFeed) {
            activityFeed.push({
              type: item.type || 'event',
              message: item.message || item.event || String(item),
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
            today: data.pairings?.today ?? 0,
          },
          activityFeed,
        });
      } catch {
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
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
      <div className="border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
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
    },
    {
      label: 'Users',
      value: stats?.users.total ?? 0,
      sub: `${stats?.users.active ?? 0} active`,
      color: 'bg-signal-green',
    },
    {
      label: 'Sessions',
      value: stats?.sessions.active ?? 0,
      sub: `${stats?.sessions.total ?? 0} total`,
      color: 'bg-signal-blue',
    },
    {
      label: 'Pairings',
      value: stats?.pairings.today ?? 0,
      sub: `${stats?.pairings.pending ?? 0} pending`,
      color: 'bg-primary',
    },
  ];

  return (
    <div className="space-y-8">
      <div className="animate-fade-up">
        <h1 className="text-lg font-display font-bold uppercase tracking-[0.1em]">Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">System status and recent activity</p>
      </div>

      <div className="border border-border animate-fade-up" style={{ animationDelay: '50ms' }}>
        <div className="grid grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric, i) => (
            <div
              key={metric.label}
              className={`p-4 ${i % 2 !== 0 ? 'border-l border-border' : ''} ${
                i >= 2 ? 'border-t border-border lg:border-t-0' : ''
              } ${i === 2 ? 'lg:border-l' : ''}`}
            >
              <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                {metric.label}
              </p>
              <p className="text-2xl font-display font-bold mt-1.5 tabular-nums">{metric.value}</p>
              <div className="flex items-center gap-1.5 mt-2">
                <span className={`w-1.5 h-1.5 rounded-full ${metric.color}`} />
                <span className="text-[11px] text-muted-foreground">{metric.sub}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr,300px] gap-6">
        <div className="animate-fade-up" style={{ animationDelay: '100ms' }}>
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-3">
            Recent Activity
          </p>
          <div className="border border-border divide-y divide-border">
            {stats?.activityFeed && stats.activityFeed.length > 0 ? (
              stats.activityFeed.slice(0, 8).map((item, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3">
                  <div className="shrink-0 text-right w-20">
                    <span className="text-[11px] tabular-nums text-muted-foreground font-medium">
                      {formatTime(item.timestamp)}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60 ml-1.5">
                      {formatDate(item.timestamp)}
                    </span>
                  </div>
                  <span className="text-sm truncate">{item.message}</span>
                </div>
              ))
            ) : (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No recent activity
              </div>
            )}
          </div>
        </div>

        <div className="animate-fade-up" style={{ animationDelay: '150ms' }}>
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-3">
            Quick Actions
          </p>
          <div className="space-y-2">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.label}
                  href={action.href}
                  className="flex items-center gap-3 w-full text-left px-4 py-3 text-sm font-medium border-2 border-border bg-card shadow-sm transition-all hover:border-primary/40 hover:shadow-md active:shadow-none active:bg-muted"
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
