'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import api from '@/lib/api';

interface DetailedStats {
  channels: { total: number; active: number; inactive: number; byGroup: Record<string, number> };
  users: { total: number; active: number };
  sessions: { total: number; active: number };
  pairings: { total: number; pending: number; completed: number; today: number };
  appVersions: { total: number; latest: string | null };
}

export default function StatsPage() {
  const [stats, setStats] = useState<DetailedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await api.get('/admin/stats/detailed');
        const d = res.data;
        setStats({
          channels: {
            total: d.channels?.total ?? 0,
            active: d.channels?.active ?? 0,
            inactive: d.channels?.inactive ?? 0,
            byGroup: d.channels?.byGroup || {},
          },
          users: { total: d.users?.total ?? 0, active: d.users?.active ?? 0 },
          sessions: { total: d.sessions?.total ?? 0, active: d.sessions?.active ?? 0 },
          pairings: {
            total: d.pairings?.total ?? 0,
            pending: d.pairings?.pending ?? 0,
            completed: d.pairings?.completed ?? 0,
            today: d.pairings?.today ?? 0,
          },
          appVersions: {
            total: d.appVersions?.total ?? 0,
            latest: d.appVersions?.latest ?? null,
          },
        });
      } catch {
        setError('Failed to load statistics');
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

  const sections = [
    {
      title: 'Channels',
      items: [
        { label: 'Total', value: stats?.channels.total },
        { label: 'Active', value: stats?.channels.active },
        { label: 'Inactive', value: stats?.channels.inactive },
      ],
    },
    {
      title: 'Users',
      items: [
        { label: 'Total', value: stats?.users.total },
        { label: 'Active', value: stats?.users.active },
      ],
    },
    {
      title: 'Sessions',
      items: [
        { label: 'Total', value: stats?.sessions.total },
        { label: 'Active', value: stats?.sessions.active },
      ],
    },
    {
      title: 'Device Pairings',
      items: [
        { label: 'Total', value: stats?.pairings.total },
        { label: 'Completed', value: stats?.pairings.completed },
        { label: 'Pending', value: stats?.pairings.pending },
        { label: 'Today', value: stats?.pairings.today },
      ],
    },
  ];

  const channelGroups = Object.entries(stats?.channels.byGroup || {}).sort(([, a], [, b]) => b - a);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-display font-bold uppercase tracking-[0.1em]">Statistics</h1>
        <p className="text-sm text-muted-foreground mt-1">Detailed system metrics</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        {sections.map((section) => (
          <div key={section.title} className="border border-border">
            <div className="px-4 py-2 bg-muted/50 border-b border-border">
              <h2 className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
                {section.title}
              </h2>
            </div>
            <dl className="divide-y divide-border">
              {section.items.map((item) => (
                <div key={item.label} className="flex items-center justify-between px-4 py-3">
                  <dt className="text-sm text-muted-foreground">{item.label}</dt>
                  <dd className="text-sm font-display font-bold tabular-nums">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      {channelGroups.length > 0 && (
        <div>
          <h2 className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-3">
            Channels by Group
          </h2>
          <dl className="border border-border divide-y divide-border">
            {channelGroups.map(([group, count]) => (
              <div key={group} className="flex items-center justify-between px-4 py-3">
                <dt className="text-sm">{group || 'Uncategorized'}</dt>
                <dd className="text-sm font-display font-bold tabular-nums">{count}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
