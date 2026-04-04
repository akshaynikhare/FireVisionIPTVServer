import Link from 'next/link';

const features = [
  {
    num: '01',
    title: 'Stream Management',
    desc: 'Import, organize, and monitor live IPTV channels with real-time health checks.',
  },
  {
    num: '02',
    title: 'Device Provisioning',
    desc: 'Pair and manage connected devices across your network with ease.',
  },
  {
    num: '03',
    title: 'EPG & Scheduling',
    desc: 'Deliver electronic program guides and schedule content for your viewers.',
  },
];

export function AuthSidePanel({ footer }: { footer: string }) {
  return (
    <div className="hidden lg:flex lg:w-[420px] flex-col justify-between border-r border-border bg-card p-10">
      <div>
        <Link href="/" className="inline-block">
          <span className="text-lg font-display font-bold tracking-tight">
            FIRE<span className="text-primary">VISION</span>
          </span>
        </Link>
        <p className="mt-4 text-xs uppercase tracking-widest text-muted-foreground">
          IPTV Management Console
        </p>

        <div className="mt-10 space-y-4">
          {features.map((f) => (
            <div key={f.num} className="flex items-start gap-3">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border border-primary/30 bg-primary/10 text-primary text-xs font-semibold">
                {f.num}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{f.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">{footer}</p>
    </div>
  );
}
