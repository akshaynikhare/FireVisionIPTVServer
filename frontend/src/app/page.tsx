import Link from 'next/link';
import { ExternalLink, Download } from 'lucide-react';

const capabilities = [
  {
    title: 'Channel Management',
    desc: 'Organize, distribute, and monitor your IPTV stream catalog',
  },
  {
    title: 'Device Provisioning',
    desc: 'Pair and manage Fire TV devices across your network',
  },
  {
    title: 'Stream Monitoring',
    desc: 'Real-time health, uptime, and performance data for all feeds',
  },
  {
    title: 'User Administration',
    desc: 'Role-based access control and session management',
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-background relative flex flex-col">
      <div className="absolute inset-0 grid-bg opacity-50 dark:opacity-40" />

      <div className="relative z-10 border-b border-border">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 h-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-signal-green animate-pulse-dot" />
            <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
              System Active
            </span>
          </div>
          <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
            v1.0.1
          </span>
        </div>
      </div>

      <div className="relative z-10 flex-1 flex items-center">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 w-full py-20 lg:py-0">
          <div className="grid lg:grid-cols-[1fr,280px] gap-16 lg:gap-20 items-start">
            <div>
              <h1 className="text-5xl sm:text-6xl lg:text-[5.5rem] font-display font-bold tracking-tight leading-none animate-fade-up">
                FIRE<span className="text-primary">VISION</span>
              </h1>

              <div
                className="w-12 h-[2px] bg-primary mt-6 animate-fade-up"
                style={{ animationDelay: '50ms' }}
              />

              <p
                className="mt-4 text-sm uppercase tracking-[0.2em] text-muted-foreground font-medium animate-fade-up"
                style={{ animationDelay: '100ms' }}
              >
                IPTV Management Console
              </p>

              <p
                className="mt-6 text-muted-foreground max-w-md leading-relaxed animate-fade-up"
                style={{ animationDelay: '150ms' }}
              >
                Centralized channel management, device provisioning, and stream monitoring for your
                IPTV infrastructure.
              </p>

              <div
                className="flex flex-wrap items-center gap-3 mt-10 animate-fade-up"
                style={{ animationDelay: '200ms' }}
              >
                <Link
                  href="/login"
                  className="inline-flex items-center bg-primary text-primary-foreground px-8 py-3 text-sm font-semibold uppercase tracking-[0.1em] transition-colors hover:bg-primary/90 active:bg-primary/80"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="inline-flex items-center border border-border px-8 py-3 text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:text-foreground hover:border-foreground/20 active:bg-secondary"
                >
                  Register
                </Link>
              </div>

              <a
                href="https://github.com/akshaynikhare/FireVisionIPTVServer/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-6 text-sm text-muted-foreground hover:text-primary transition-colors animate-fade-up"
                style={{ animationDelay: '250ms' }}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                <span>Download Android TV APK</span>
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            </div>

            <div
              className="border-l border-border pl-8 hidden lg:block animate-fade-up"
              style={{ animationDelay: '300ms' }}
            >
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-8">
                Capabilities
              </p>
              <div className="space-y-6">
                {capabilities.map((cap, i) => (
                  <div key={i}>
                    <span className="text-[11px] text-primary font-medium">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <p className="text-sm font-medium mt-0.5">{cap.title}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{cap.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div
            className="mt-16 border-t border-border pt-8 lg:hidden animate-fade-up"
            style={{ animationDelay: '300ms' }}
          >
            <div className="grid sm:grid-cols-2 gap-6">
              {capabilities.map((cap, i) => (
                <div key={i}>
                  <span className="text-[11px] text-primary font-medium">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <p className="text-sm font-medium mt-0.5">{cap.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{cap.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <footer className="relative z-10 border-t border-border">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-[11px] text-muted-foreground tracking-[0.15em]">
            &copy; 2025 FireVision IPTV &bull; Open Source Project
          </span>
          <a
            href="https://github.com/akshaynikhare"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground tracking-[0.1em] hover:text-primary transition-colors"
          >
            View Source Code &amp; Creator Profile on GitHub
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        </div>
      </footer>
    </div>
  );
}
