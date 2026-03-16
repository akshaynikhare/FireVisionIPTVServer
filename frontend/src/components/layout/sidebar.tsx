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
  Radio,
  Bug,
} from 'lucide-react';
import { useUIStore } from '@/store/ui-store';

const adminLinks = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/channels', label: 'Channels', icon: Tv },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/devices', label: 'Devices', icon: Smartphone },
  { href: '/admin/import', label: 'Import IPTV', icon: Globe },
  { href: '/admin/sources', label: 'Other Sources', icon: Radio },
  { href: '/admin/versions', label: 'App Versions', icon: Package },
  { href: '/admin/stats', label: 'Statistics', icon: BarChart3 },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

const userLinks = [
  { href: '/user', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/user/channels', label: 'My Channels', icon: Tv },
  { href: '/user/import', label: 'Import IPTV', icon: Globe },
  { href: '/user/devices', label: 'Pair Device', icon: Smartphone },
  { href: '/user/profile', label: 'My Profile', icon: UserCircle },
];

export function Sidebar({ role }: { role: 'admin' | 'user' }) {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const links = role === 'admin' ? adminLinks : userLinks;

  return (
    <aside
      className={`relative flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-200 ${
        sidebarCollapsed ? 'w-14' : 'w-52'
      }`}
    >
      <div className="flex h-11 items-center border-b border-sidebar-border px-4">
        {!sidebarCollapsed ? (
          <span className="text-sm font-display font-bold tracking-tight">
            FIRE<span className="text-sidebar-primary">V</span>
          </span>
        ) : (
          <span className="text-sm font-display font-bold text-sidebar-primary">F</span>
        )}
      </div>

      <nav className="flex-1 py-3 px-2">
        {!sidebarCollapsed && (
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-2 px-2">
            Navigation
          </p>
        )}
        <div className="space-y-0.5">
          {links.map((link) => {
            const isActive = pathname === link.href;
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-2.5 py-2 text-[13px] transition-colors ${
                  sidebarCollapsed ? 'justify-center px-2' : 'px-2.5'
                } ${
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-sidebar-primary font-medium'
                    : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 border-l-2 border-transparent'
                }`}
                title={sidebarCollapsed ? link.label : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className={sidebarCollapsed ? 'sr-only' : 'uppercase tracking-[0.05em]'}>
                  {link.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-sidebar-border py-2 px-2 space-y-0.5">
        <a
          href="https://github.com/akshaynikhare/FireVisionIPTVServer/issues"
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-2.5 py-2 text-[13px] text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors ${
            sidebarCollapsed ? 'justify-center px-2' : 'px-2.5'
          }`}
          title={sidebarCollapsed ? 'Raise Issue' : undefined}
        >
          <Bug className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className={sidebarCollapsed ? 'sr-only' : 'uppercase tracking-[0.05em]'}>
            Raise Issue
          </span>
        </a>
      </div>

      <button
        onClick={toggleSidebar}
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="absolute -right-3 top-[52px] flex h-6 w-6 items-center justify-center border border-border bg-background text-muted-foreground hover:text-foreground transition-colors"
      >
        {sidebarCollapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </button>
    </aside>
  );
}
