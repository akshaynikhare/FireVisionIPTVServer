import Link from 'next/link';

const metrics = [
  { label: 'Channels', value: '128', status: 'active', color: 'bg-signal-green' },
  { label: 'Users', value: '24', status: 'active', color: 'bg-signal-green' },
  { label: 'Devices', value: '18', status: 'online', color: 'bg-signal-blue' },
  { label: 'Requests', value: '3', status: 'pending', color: 'bg-primary' },
];

const activity = [
  { time: '12:04', event: 'User john.doe authenticated' },
  { time: '11:58', event: 'Channel #45 stream URL updated' },
  { time: '11:52', event: 'Device FV-0042 paired successfully' },
  { time: '11:30', event: 'Bulk import: 12 channels added' },
  { time: '10:15', event: 'System backup completed' },
];

const quickActions = [
  { label: 'Add Channel', href: '/admin/channels' },
  { label: 'Manage Users', href: '/admin/users' },
  { label: 'Pair Device', href: '/admin/devices' },
  { label: 'View Statistics', href: '/admin/stats' },
];

export default function AdminDashboard() {
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
                <span className="text-[11px] text-muted-foreground capitalize">
                  {metric.status}
                </span>
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
            {activity.map((item, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <span className="text-[11px] tabular-nums text-muted-foreground font-medium w-10 shrink-0">
                  {item.time}
                </span>
                <span className="text-sm truncate">{item.event}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="animate-fade-up" style={{ animationDelay: '150ms' }}>
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-3">
            Quick Actions
          </p>
          <div className="space-y-2">
            {quickActions.map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className="block w-full text-left px-4 py-2.5 text-sm border border-border transition-colors hover:bg-secondary hover:border-foreground/10 active:bg-muted"
              >
                {action.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
