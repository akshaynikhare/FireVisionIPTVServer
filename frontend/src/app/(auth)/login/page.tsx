'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setSession } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const message = searchParams.get('message');
  const redirect = searchParams.get('redirect');
  const oauthHandled = useRef(false);

  // Handle OAuth code exchange on mount
  useEffect(() => {
    if (oauthHandled.current) return;
    const oauthCode = searchParams.get('oauth_code');
    const oauthError = searchParams.get('error');

    if (oauthError) {
      setError('OAuth authentication failed. Try a different sign-in method or contact support.');
      return;
    }

    if (oauthCode) {
      oauthHandled.current = true;
      setLoading(true);
      api
        .post('/auth/oauth-exchange', { code: oauthCode })
        .then((res) => {
          const { user, sessionId } = res.data;
          setSession(user, sessionId);
          if (redirect && redirect.startsWith('/pair')) {
            router.push(redirect);
          } else if (user.emailVerified === false) {
            router.push('/verify-email');
          } else {
            router.push(user.role === 'Admin' ? '/admin' : '/user');
          }
        })
        .catch((err: unknown) => {
          const status = (err as { response?: { status?: number } })?.response?.status;
          if (status === 429) {
            setError(
              'Too many requests — you have been rate-limited. Please wait a few minutes and try again.',
            );
          } else {
            setError('OAuth login failed. The code may have expired — please try again.');
          }
          setLoading(false);
        });
    }
  }, [searchParams, setSession, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/login', { username, password });
      const { user, sessionId } = res.data;
      setSession(user, sessionId);

      if (redirect && redirect.startsWith('/pair')) {
        router.push(redirect);
      } else if (user.emailVerified === false) {
        router.push('/verify-email');
      } else if (user.role === 'Admin') {
        router.push('/admin');
      } else {
        router.push('/user');
      }
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 429) {
        setError(
          'Too many requests — you have been rate-limited. Please wait a few minutes and try again.',
        );
      } else {
        setError('Invalid username or password');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="lg:hidden mb-10">
        <Link href="/">
          <span className="text-lg font-display font-bold tracking-tight">
            FIRE<span className="text-primary">VISION</span>
          </span>
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-xl font-display font-bold uppercase tracking-wider">Sign In</h1>
        <p className="mt-2 text-sm text-muted-foreground">Access your IPTV management console</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {message && !error && (
          <div className="border border-primary/40 bg-primary/10 px-3 py-2.5 text-sm text-primary">
            {message}
          </div>
        )}

        {error && (
          <div
            role="alert"
            aria-live="polite"
            className="border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          >
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <label
            htmlFor="username"
            className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
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
            aria-required="true"
            className="flex h-10 w-full border border-border bg-card px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:text-muted-foreground"
            aria-label="Username"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="password"
            className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              required
              disabled={loading}
              autoComplete="current-password"
              aria-required="true"
              className="flex h-10 w-full border border-border bg-card px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:text-muted-foreground"
              aria-label="Password"
            />
            <button
              type="button"
              className="absolute right-1 top-1/2 -translate-y-1/2 p-2.5"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          aria-busy={loading}
          className="flex h-10 w-full items-center justify-center bg-primary text-sm font-semibold text-primary-foreground uppercase tracking-wider transition-colors hover:bg-primary/90 active:bg-primary/80 disabled:pointer-events-none disabled:opacity-50"
        >
          {loading ? 'Authenticating...' : 'Sign In'}
        </button>
      </form>

      <div className="mt-6 space-y-3">
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <span className="relative bg-background px-3 text-xs text-muted-foreground">
            Or continue with
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <a
            href="/api/v1/auth/google"
            aria-label="Sign in with Google"
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
            aria-label="Sign in with GitHub"
            className="flex h-10 items-center justify-center gap-2 border border-border bg-card text-sm font-medium transition-colors hover:bg-muted"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            GitHub
          </a>
        </div>
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        No account?{' '}
        <Link
          href={redirect ? `/register?redirect=${encodeURIComponent(redirect)}` : '/register'}
          className="font-medium text-foreground hover:text-primary transition-colors"
        >
          Register
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="h-screen overflow-y-auto flex">
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
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border border-primary/30 bg-primary/10 text-primary text-xs font-semibold">
                01
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Stream Management</p>
                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                  Import, organize, and monitor live IPTV channels with real-time health checks.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border border-primary/30 bg-primary/10 text-primary text-xs font-semibold">
                02
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Device Provisioning</p>
                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                  Pair and manage connected devices across your network with ease.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border border-primary/30 bg-primary/10 text-primary text-xs font-semibold">
                03
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">EPG & Scheduling</p>
                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                  Deliver electronic program guides and schedule content for your viewers.
                </p>
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Secure access to your channel management and device provisioning infrastructure.
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 bg-background">
        <Suspense fallback={null}>
          <LoginContent />
        </Suspense>
      </div>
    </div>
  );
}
