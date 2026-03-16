'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';

export default function LoginPage() {
  const router = useRouter();
  const { setSession } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/login', { username, password });
      const { user, sessionId } = res.data;
      setSession(user, sessionId);

      if (user.role === 'Admin') {
        router.push('/admin');
      } else {
        router.push('/user');
      }
    } catch {
      setError('Invalid username or password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-[420px] flex-col justify-between border-r border-border bg-card p-10">
        <div>
          <Link href="/" className="inline-block">
            <h2 className="text-lg font-display font-bold tracking-tight">
              FIRE<span className="text-primary">VISION</span>
            </h2>
          </Link>
          <div className="w-8 h-[2px] bg-primary mt-4" />
          <p className="mt-4 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            IPTV Management Console
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-signal-green animate-pulse-dot" />
            <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
              System Active
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Secure access to your channel management and device provisioning infrastructure.
          </p>
          <div className="mt-4 border-t border-border pt-4">
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60">
              IPTV Management Console
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 bg-background">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-10">
            <Link href="/">
              <h2 className="text-lg font-display font-bold tracking-tight">
                FIRE<span className="text-primary">VISION</span>
              </h2>
            </Link>
            <div className="w-8 h-[2px] bg-primary mt-3" />
          </div>

          <div className="mb-8 animate-fade-up">
            <h1 className="text-xl font-display font-bold uppercase tracking-[0.1em]">Sign In</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Enter your credentials to access the console
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-5 animate-fade-up"
            style={{ animationDelay: '50ms' }}
          >
            {error && (
              <div className="border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="username"
                className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError('');
                }}
                required
                disabled={loading}
                autoComplete="username"
                className="flex h-10 w-full border border-border bg-card px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
                placeholder="Enter username"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                required
                disabled={loading}
                autoComplete="current-password"
                className="flex h-10 w-full border border-border bg-card px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
                placeholder="Enter password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex h-10 w-full items-center justify-center bg-primary text-sm font-semibold text-primary-foreground uppercase tracking-[0.1em] transition-colors hover:bg-primary/90 active:bg-primary/80 disabled:pointer-events-none disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 space-y-3 animate-fade-up" style={{ animationDelay: '100ms' }}>
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <span className="relative bg-background px-3 text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                Or continue with
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <a
                href="/api/v1/auth/google"
                className="flex h-10 items-center justify-center gap-2 border border-border bg-card text-sm font-medium transition-colors hover:bg-muted"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 001 12c0 1.78.43 3.46 1.18 4.93l3.66-2.84z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Google
              </a>
              <a
                href="/api/v1/auth/github"
                className="flex h-10 items-center justify-center gap-2 border border-border bg-card text-sm font-medium transition-colors hover:bg-muted"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                GitHub
              </a>
            </div>
          </div>

          <p
            className="mt-6 text-sm text-muted-foreground animate-fade-up"
            style={{ animationDelay: '150ms' }}
          >
            No account?{' '}
            <Link
              href="/register"
              className="font-medium text-foreground hover:text-primary transition-colors"
            >
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
