'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.post('/auth/register', { username, email, password });
      router.push('/login');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  function clearError() {
    if (error) setError('');
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
            Create an account to access stream management and device provisioning tools.
          </p>
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
            <h1 className="text-xl font-display font-bold uppercase tracking-[0.1em]">Register</h1>
            <p className="mt-2 text-sm text-muted-foreground">Create a new operator account</p>
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
                  clearError();
                }}
                required
                disabled={loading}
                minLength={3}
                maxLength={50}
                autoComplete="username"
                className="flex h-10 w-full border border-border bg-card px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
                placeholder="Choose a username"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearError();
                }}
                required
                disabled={loading}
                autoComplete="email"
                className="flex h-10 w-full border border-border bg-card px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
                placeholder="Enter your email"
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
                  clearError();
                }}
                required
                disabled={loading}
                minLength={8}
                autoComplete="new-password"
                className="flex h-10 w-full border border-border bg-card px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
                placeholder="Min. 8 characters"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex h-10 w-full items-center justify-center bg-primary text-sm font-semibold text-primary-foreground uppercase tracking-[0.1em] transition-colors hover:bg-primary/90 active:bg-primary/80 disabled:pointer-events-none disabled:opacity-50"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p
            className="mt-6 text-sm text-muted-foreground animate-fade-up"
            style={{ animationDelay: '100ms' }}
          >
            Already registered?{' '}
            <Link
              href="/login"
              className="font-medium text-foreground hover:text-primary transition-colors"
            >
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
