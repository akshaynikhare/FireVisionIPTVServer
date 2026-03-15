'use client';

import { useRouter } from 'next/navigation';
import { LogOut, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuthStore } from '@/store/auth-store';
import api from '@/lib/api';

export function Header() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuthStore();

  async function handleLogout() {
    try {
      await api.post('/auth/logout');
    } catch {
      // Logout even if API call fails
    }
    logout();
    router.push('/login');
  }

  return (
    <header className="flex h-11 items-center justify-between border-b border-border bg-background px-4">
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-signal-green animate-pulse-dot" />
        <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
          Online
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="relative flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Toggle theme"
        >
          <Sun className="h-3.5 w-3.5 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-3.5 w-3.5 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
        </button>

        {user && (
          <span className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground px-2 border-l border-border ml-1">
            {user.username}
          </span>
        )}

        <button
          onClick={handleLogout}
          className="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Sign out"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    </header>
  );
}
