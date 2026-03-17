'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Loader2,
  Users,
  Tv,
  Smartphone,
  Activity,
  TrendingUp,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
} from 'recharts';
import api from '@/lib/api';

interface DetailedStats {
  channels: {
    total: number;
    active: number;
    inactive: number;
    byGroup: Array<{ _id: string; count: number }> | Record<string, number>;
  };
  users: { total: number; active: number };
  sessions: {
    total: number;
    active: number;
    byLocation?: Array<{ _id: string; count: number }>;
  };
  pairings: { total: number; pending: number; completed: number; today: number };
  appVersions: { total: number; latest: string | null };
  activity?: Array<{
    type: string;
    title: string;
    description: string;
    timestamp: string;
  }>;
}

interface TrendPoint {
  date: string;
  count: number;
}

type TimeRange = '7d' | '30d' | '90d';

const CHART_COLORS = [
  'hsl(38, 75%, 38%)',
  'hsl(142, 60%, 34%)',
  'hsl(220, 60%, 50%)',
  'hsl(280, 50%, 50%)',
  'hsl(0, 55%, 48%)',
  'hsl(180, 50%, 40%)',
  'hsl(60, 55%, 42%)',
  'hsl(330, 50%, 45%)',
  'hsl(200, 60%, 45%)',
  'hsl(100, 45%, 40%)',
];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function timeAgo(timestamp: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(timestamp).getTime()) / 1000
  );
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function normalizeByGroup(
  byGroup: Array<{ _id: string; count: number }> | Record<string, number>
): Array<{ name: string; value: number }> {
  if (Array.isArray(byGroup)) {
    return byGroup.map((g) => ({
      name: g._id || 'Uncategorized',
      value: g.count,
    }));
  }
  return Object.entries(byGroup).map(([name, value]) => ({
    name: name || 'Uncategorized',
    value,
  }));
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
}) {
  return (
    <div className="border border-border p-4 flex items-center gap-3">
      <div className="h-10 w-10 flex items-center justify-center bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-display font-bold tabular-nums">{value}</p>
        <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
          {label}
        </p>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border">
      <div className="px-4 py-2 bg-muted/50 border-b border-border">
        <h2 className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium">
          {title}
        </h2>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="border border-border bg-background px-3 py-2 text-sm shadow-sm">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-display font-bold tabular-nums">{payload[0].value}</p>
    </div>
  );
}

function TrendChart({
  title,
  data,
  color,
  range,
  onRangeChange,
}: {
  title: string;
  data: TrendPoint[];
  color: string;
  range: TimeRange;
  onRangeChange: (r: TimeRange) => void;
}) {
  const ranges: TimeRange[] = ['7d', '30d', '90d'];
  const formatted = data.map((d) => ({ ...d, label: formatDate(d.date) }));

  return (
    <div className="border border-border">
      <div className="px-4 py-2 bg-muted/50 border-b border-border flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium">
          {title}
        </h2>
        <div className="flex gap-1">
          {ranges.map((r) => (
            <button
              key={r}
              onClick={() => onRangeChange(r)}
              className={`px-2 py-0.5 text-xs uppercase tracking-[0.1em] transition-colors ${
                range === r
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4">
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No data for this period
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={formatted}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="count"
                stroke={color}
                fill={color}
                fillOpacity={0.15}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export default function StatsPage() {
  const [stats, setStats] = useState<DetailedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [userTrend, setUserTrend] = useState<TrendPoint[]>([]);
  const [sessionTrend, setSessionTrend] = useState<TrendPoint[]>([]);
  const [pairingTrend, setPairingTrend] = useState<TrendPoint[]>([]);

  const [userRange, setUserRange] = useState<TimeRange>('30d');
  const [sessionRange, setSessionRange] = useState<TimeRange>('30d');
  const [pairingRange, setPairingRange] = useState<TimeRange>('30d');

  useEffect(() => {
    const controller = new AbortController();
    async function fetchStats() {
      try {
        const res = await api.get('/admin/stats/detailed', {
          signal: controller.signal,
        });
        const d = res.data?.data || res.data;
        setStats({
          channels: {
            total: d.channels?.total ?? 0,
            active: d.channels?.active ?? 0,
            inactive: d.channels?.inactive ?? 0,
            byGroup: d.channels?.byGroup || [],
          },
          users: { total: d.users?.total ?? 0, active: d.users?.active ?? 0 },
          sessions: {
            total: d.sessions?.total ?? 0,
            active: d.sessions?.active ?? 0,
            byLocation: d.sessions?.byLocation || [],
          },
          pairings: {
            total: d.pairings?.total ?? 0,
            pending: d.pairings?.pending ?? 0,
            completed: d.pairings?.completed ?? 0,
            today: d.pairings?.todayCount ?? d.pairings?.today ?? 0,
          },
          appVersions: {
            total: d.app?.totalVersions ?? d.appVersions?.total ?? 0,
            latest: d.app?.latestVersion ?? d.appVersions?.latest ?? null,
          },
          activity: d.activity || [],
        });
      } catch {
        setError('Failed to load statistics');
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
    return () => controller.abort();
  }, []);

  const fetchTrend = useCallback(
    async (
      type: string,
      range: TimeRange,
      setter: (d: TrendPoint[]) => void
    ) => {
      try {
        const res = await api.get(
          `/admin/stats/trends/${type}?range=${range}`
        );
        setter(res.data?.data || []);
      } catch {
        setter([]);
      }
    },
    []
  );

  useEffect(() => {
    fetchTrend('users', userRange, setUserTrend);
  }, [userRange, fetchTrend]);

  useEffect(() => {
    fetchTrend('sessions', sessionRange, setSessionTrend);
  }, [sessionRange, fetchTrend]);

  useEffect(() => {
    fetchTrend('pairings', pairingRange, setPairingTrend);
  }, [pairingRange, fetchTrend]);

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

  const channelGroups = normalizeByGroup(stats?.channels.byGroup || []);
  const locationData = (stats?.sessions.byLocation || []).map((l) => ({
    name: l._id || 'Unknown',
    value: l.count,
  }));
  const activities = stats?.activity || [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-display font-bold uppercase tracking-[0.1em]">
          Statistics
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          System metrics and trends
        </p>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Channels"
          value={stats?.channels.total ?? 0}
          icon={Tv}
        />
        <StatCard
          label="Total Users"
          value={stats?.users.total ?? 0}
          icon={Users}
        />
        <StatCard
          label="Active Sessions"
          value={stats?.sessions.active ?? 0}
          icon={Activity}
        />
        <StatCard
          label="Pairings Today"
          value={stats?.pairings.today ?? 0}
          icon={Smartphone}
        />
      </div>

      {/* Charts row: Pie + Bar */}
      <div className="grid md:grid-cols-2 gap-6">
        <ChartCard title="Channels by Group">
          {channelGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No channel data
            </p>
          ) : (
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={channelGroups}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    dataKey="value"
                    nameKey="name"
                    stroke="hsl(var(--background))"
                    strokeWidth={2}
                  >
                    {channelGroups.map((_entry, index) => (
                      <Cell
                        key={index}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 justify-center">
                {channelGroups.slice(0, 8).map((g, i) => (
                  <div key={g.name} className="flex items-center gap-1.5 text-xs">
                    <span
                      className="inline-block h-2.5 w-2.5"
                      style={{
                        backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                      }}
                    />
                    <span className="text-muted-foreground truncate max-w-[120px]">
                      {g.name}
                    </span>
                    <span className="font-display font-bold tabular-nums">
                      {g.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Sessions by Location">
          {locationData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No location data
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={locationData}
                layout="vertical"
                margin={{ left: 10, right: 20 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={{
                    fontSize: 11,
                    fill: 'hsl(var(--muted-foreground))',
                  }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{
                    fontSize: 11,
                    fill: 'hsl(var(--muted-foreground))',
                  }}
                  tickLine={false}
                  axisLine={false}
                  width={100}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="value"
                  fill="hsl(220, 60%, 50%)"
                  radius={[0, 2, 2, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Trend charts */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium">
            Trends Over Time
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          <TrendChart
            title="User Signups"
            data={userTrend}
            color="hsl(38, 75%, 38%)"
            range={userRange}
            onRangeChange={setUserRange}
          />
          <TrendChart
            title="Sessions"
            data={sessionTrend}
            color="hsl(220, 60%, 50%)"
            range={sessionRange}
            onRangeChange={setSessionRange}
          />
          <TrendChart
            title="Device Pairings"
            data={pairingTrend}
            color="hsl(142, 60%, 34%)"
            range={pairingRange}
            onRangeChange={setPairingRange}
          />
        </div>
      </div>

      {/* Activity timeline */}
      {activities.length > 0 && (
        <ChartCard title="Recent Activity">
          <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
            {activities.map((a, i) => (
              <div key={i} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <div className="mt-0.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">{a.description}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {timeAgo(a.timestamp)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      )}

      {/* Summary table */}
      <div className="grid sm:grid-cols-2 gap-6">
        <div className="border border-border">
          <div className="px-4 py-2 bg-muted/50 border-b border-border">
            <h2 className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium">
              Channels
            </h2>
          </div>
          <dl className="divide-y divide-border">
            <div className="flex items-center justify-between px-4 py-3">
              <dt className="text-sm text-muted-foreground">Active</dt>
              <dd className="text-sm font-display font-bold tabular-nums">
                {stats?.channels.active}
              </dd>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <dt className="text-sm text-muted-foreground">Inactive</dt>
              <dd className="text-sm font-display font-bold tabular-nums">
                {stats?.channels.inactive}
              </dd>
            </div>
          </dl>
        </div>

        <div className="border border-border">
          <div className="px-4 py-2 bg-muted/50 border-b border-border">
            <h2 className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium">
              Device Pairings
            </h2>
          </div>
          <dl className="divide-y divide-border">
            <div className="flex items-center justify-between px-4 py-3">
              <dt className="text-sm text-muted-foreground">Total</dt>
              <dd className="text-sm font-display font-bold tabular-nums">
                {stats?.pairings.total}
              </dd>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <dt className="text-sm text-muted-foreground">Completed</dt>
              <dd className="text-sm font-display font-bold tabular-nums">
                {stats?.pairings.completed}
              </dd>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <dt className="text-sm text-muted-foreground">Pending</dt>
              <dd className="text-sm font-display font-bold tabular-nums">
                {stats?.pairings.pending}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
