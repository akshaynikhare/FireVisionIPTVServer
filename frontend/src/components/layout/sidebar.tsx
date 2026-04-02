'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Tv,
  Users,
  Settings,
  BarChart3,
  Smartphone,
  ChevronLeft,
  ChevronRight,
  Globe,
  UserCircle,
  Package,
  MonitorPlay,
  Bug,
  Zap,
  Calendar,
  Activity,
  Clock,
  X,
} from 'lucide-react';
import { useUIStore } from '@/store/ui-store';

const adminLinks = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/quick-pick', label: 'Quick Pick', icon: Zap },
  { href: '/admin/channels', label: 'Channels', icon: Tv },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/devices', label: 'Devices', icon: Smartphone },
  { href: '/admin/import', label: 'Import IPTV', icon: Globe },
  { href: '/admin/sources', label: 'Other Sources', icon: MonitorPlay },
  { href: '/admin/epg', label: 'EPG Guide', icon: Calendar },
  { href: '/admin/versions', label: 'App Versions', icon: Package },
  { href: '/admin/stats', label: 'Statistics', icon: BarChart3 },
  { href: '/admin/activity', label: 'Activity', icon: Activity },
  { href: '/admin/scheduler', label: 'Scheduler', icon: Clock },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

const userLinks = [
  { href: '/user', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/user/quick-pick', label: 'Quick Pick', icon: Zap },
  { href: '/user/channels', label: 'My Channels', icon: Tv },
  { href: '/user/import', label: 'Import IPTV', icon: Globe },
  { href: '/user/sources', label: 'Other Sources', icon: MonitorPlay },
  { href: '/user/devices', label: 'Pair Device', icon: Smartphone },
  { href: '/user/profile', label: 'My Profile', icon: UserCircle },
];

export function Sidebar({ role }: { role: 'admin' | 'user' }) {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar, mobileSidebarOpen, setMobileSidebarOpen } = useUIStore();
  const links = role === 'admin' ? adminLinks : userLinks;

  return (
    <>
      {/* Mobile overlay backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200 ease-in-out w-64
          ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:relative md:z-auto md:translate-x-0 md:transition-[width,padding] md:duration-200
          ${sidebarCollapsed ? 'md:w-14' : 'md:w-52'}
        `}
      >
        <div className="flex h-11 items-center border-b border-sidebar-border px-4">
          <span className="text-sm font-display font-bold tracking-tight md:hidden">
            FIRE<span className="text-sidebar-primary">Vision</span>
          </span>
          <span className="text-sm font-display font-bold tracking-tight hidden md:inline">
            {!sidebarCollapsed ? (
              <>
                FIRE<span className="text-sidebar-primary">Vision</span>
              </>
            ) : (
              <>
                F<span className="text-sidebar-primary">V</span>
              </>
            )}
          </span>
          {/* Mobile close button */}
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="ml-auto flex h-8 w-8 items-center justify-center text-sidebar-foreground/60 hover:text-sidebar-foreground md:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2" aria-label="Main navigation">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2 px-2 md:hidden">
            Navigation
          </p>
          {!sidebarCollapsed && (
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2 px-2 hidden md:block">
              Navigation
            </p>
          )}
          <ul className="space-y-0.5">
            {links.map((link) => {
              const isActive =
                link.href === '/admin' || link.href === '/user'
                  ? pathname === link.href
                  : pathname.startsWith(link.href);
              const Icon = link.icon;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setMobileSidebarOpen(false)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex items-center gap-2.5 py-2 text-xs transition-colors px-2.5 ${
                      sidebarCollapsed ? 'md:justify-center md:px-2' : 'md:px-2.5'
                    } ${
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-sidebar-primary font-medium'
                        : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 border-l-2 border-transparent'
                    }`}
                    title={sidebarCollapsed ? link.label : undefined}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="uppercase tracking-[0.05em] md:hidden">{link.label}</span>
                    <span
                      className={`uppercase tracking-[0.05em] hidden md:inline ${sidebarCollapsed ? 'md:sr-only' : ''}`}
                    >
                      {link.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-sidebar-border py-2 px-2 space-y-0.5">
          <a
            href="https://github.com/akshaynikhare/FireVisionIPTVServer/issues"
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-2.5 py-2 text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors px-2.5 ${
              sidebarCollapsed ? 'md:justify-center md:px-2' : 'md:px-2.5'
            }`}
            title={sidebarCollapsed ? 'Raise Issue' : undefined}
          >
            <Bug className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="uppercase tracking-[0.05em] md:hidden">
              Raise Issue
              <span className="sr-only"> (opens in new tab)</span>
            </span>
            <span
              className={`uppercase tracking-[0.05em] hidden md:inline ${sidebarCollapsed ? 'md:sr-only' : ''}`}
            >
              Raise Issue
              <span className="sr-only"> (opens in new tab)</span>
            </span>
          </a>
        </div>

        {/* Desktop collapse toggle - hidden on mobile */}
        <button
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!sidebarCollapsed}
          className="absolute -right-3 top-[44px] hidden md:flex h-6 w-6 items-center justify-center border border-sidebar-border bg-sidebar text-sidebar-foreground/60 shadow-sm hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-primary transition-colors"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronLeft className="h-3 w-3" />
          )}
        </button>
      </aside>
    </>
  );
}
