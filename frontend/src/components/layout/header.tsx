'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { LogOut, Moon, Sun, UserCircle } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuthStore } from '@/store/auth-store';
import api from '@/lib/api';

export function Header() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuthStore();
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const prevUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user || user.id === prevUserIdRef.current) return;
    prevUserIdRef.current = user.id;
    api
      .get('/auth/me')
      .then((res) => {
        const data = res.data.user || res.data.data || res.data;
        if (data.profilePicture) {
          setProfilePic(
            data.profilePicture.startsWith('/')
              ? `/api/v1${data.profilePicture}`
              : data.profilePicture,
          );
        }
      })
      .catch(() => {});
  }, [user]);

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
    <header className="flex h-11 items-center justify-end border-b border-border bg-background px-4">
      <div className="flex items-center gap-1">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="relative flex h-10 w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary"
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-pressed={theme === 'dark'}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
        </button>

        {user && (
          <div className="flex items-center gap-2 px-2 border-l border-border ml-1">
            {profilePic ? (
              <img
                src={profilePic}
                alt={`${user.username}'s profile picture`}
                loading="lazy"
                width={24}
                height={24}
                className="h-6 w-6 rounded-full object-cover"
                onError={() => setProfilePic(null)}
              />
            ) : (
              <UserCircle className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-xs text-muted-foreground">{user.username}</span>
          </div>
        )}

        <button
          onClick={handleLogout}
          className="flex h-10 w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
