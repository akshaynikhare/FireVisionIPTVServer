import Link from 'next/link';
import { ExternalLink, Download } from 'lucide-react';

const capabilities = [
  {
    title: 'Channel Management',
    desc: 'Add, organize, and test IPTV channels with M3U import, DRM support, and live stream preview',
  },
  {
    title: 'Multi-Source Import',
    desc: 'Import from IPTV-org, Pluto TV, and Samsung TV Plus with region-based filtering',
  },
  {
    title: 'Device Pairing',
    desc: 'Provision and manage Fire TV devices with pairing codes, status tracking, and user assignment',
  },
  {
    title: 'User & Access Control',
    desc: 'Role-based user management with channel list codes, session tracking, and activity monitoring',
  },
  {
    title: 'System Analytics',
    desc: 'Real-time dashboard with channel, user, device, and session metrics across your infrastructure',
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-background relative flex flex-col">
      <div className="absolute inset-0 grid-bg opacity-50 dark:opacity-40" />

      <div className="relative z-10 border-b border-border">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 h-10 flex items-center justify-end">
          <span className="text-xs text-muted-foreground">v1.0.1</span>
        </div>
      </div>

      <div className="relative z-10 flex-1 flex items-center">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 w-full py-20 lg:py-0">
          <div className="grid lg:grid-cols-[1fr,280px] gap-16 lg:gap-20 items-start">
            <div>
              <h1 className="text-5xl sm:text-6xl lg:text-[5.5rem] font-display font-bold tracking-tight leading-none">
                FIRE<span className="text-primary">VISION</span>
              </h1>

              <p className="mt-4 text-sm uppercase tracking-widest text-muted-foreground font-medium">
                IPTV Management Console
              </p>

              <p className="mt-6 text-muted-foreground max-w-md leading-relaxed">
                Centralized channel management, device provisioning, and stream monitoring for your
                IPTV infrastructure.
              </p>

              <nav aria-label="Get started" className="flex flex-wrap items-center gap-3 mt-10">
                <Link
                  href="/login"
                  className="inline-flex items-center bg-primary text-primary-foreground px-8 py-3 text-sm font-semibold uppercase tracking-widest transition-colors hover:bg-primary/90 active:bg-primary/80"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="inline-flex items-center border border-border px-8 py-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground hover:border-foreground/20 active:bg-secondary"
                >
                  Register
                </Link>
              </nav>
              <a
                href="https://github.com/akshaynikhare/FireVisionIPTV/releases/latest"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 mt-4 border-2 border-primary/30 bg-primary/5 px-8 py-4 text-sm font-semibold uppercase tracking-widest text-foreground hover:bg-primary/10 hover:border-primary/50 transition-colors"
              >
                <Download className="h-5 w-5 text-primary" aria-hidden="true" />
                <span>Download Android TV APK</span>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                <span className="sr-only"> (opens in new tab)</span>
              </a>
            </div>

            <div className="border-l border-border pl-8 hidden lg:block">
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-8">
                Capabilities
              </p>
              <ol className="space-y-6">
                {capabilities.map((cap, i) => (
                  <li key={i}>
                    <span className="text-xs text-primary font-medium" aria-hidden="true">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <p className="text-sm font-medium mt-0.5">{cap.title}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{cap.desc}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className="mt-16 border-t border-border pt-8 lg:hidden">
            <ol className="grid sm:grid-cols-2 gap-6">
              {capabilities.map((cap, i) => (
                <li key={i}>
                  <span className="text-xs text-primary font-medium" aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <p className="text-sm font-medium mt-0.5">{cap.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{cap.desc}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      <footer className="relative z-10 border-t border-border">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            &copy; 2025 FireVision IPTV <span aria-hidden="true">&bull;</span> Open Source Project
          </span>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/akshaynikhare/FireVisionIPTV"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              View Source Code
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
              <span className="sr-only"> (opens in new tab)</span>
            </a>
            <span className="text-muted-foreground/40" aria-hidden="true">
              &bull;
            </span>
            <a
              href="https://github.com/akshaynikhare/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              Built by Akshay Nikhare
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
              <span className="sr-only"> (opens in new tab)</span>
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
