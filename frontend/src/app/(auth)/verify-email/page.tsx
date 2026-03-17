'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, RefreshCw, CheckCircle2, AlertCircle, LogOut } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { user, logout, setUser } = useAuthStore();

  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const tokenHandled = useRef(false);

  // Mode A: Process verification token from email link
  useEffect(() => {
    if (!token || tokenHandled.current) return;
    tokenHandled.current = true;
    setVerifying(true);

    api
      .post('/auth/verify-email', { token })
      .then(() => {
        setVerified(true);
        if (user) {
          setUser({ ...user, emailVerified: true });
        }
      })
      .catch((err) => {
        const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
        setError(msg || 'Verification failed. The link may have expired.');
      })
      .finally(() => setVerifying(false));
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mode B: If no token and not logged in, redirect to login
  useEffect(() => {
    if (token) return;
    if (!user) {
      router.replace('/login');
    }
  }, [token, user, router]);

  async function handleResend() {
    setResending(true);
    setError('');
    setResent(false);
    try {
      await api.post('/auth/resend-verification');
      setResent(true);
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      setError(msg || 'Failed to resend verification email.');
    } finally {
      setResending(false);
    }
  }

  function handleLogout() {
    logout();
    router.push('/login');
  }

  function handleContinue() {
    if (user) {
      router.push(user.role === 'Admin' ? '/admin' : '/user');
    } else {
      router.push('/login');
    }
  }

  // --- Token mode: verifying / success / error ---
  if (token) {
    return (
      <div className="w-full max-w-sm text-center">
        {verifying && (
          <>
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center border border-border bg-card">
              <RefreshCw className="h-6 w-6 text-primary animate-spin" />
            </div>
            <h1 className="text-xl font-display font-bold uppercase tracking-wider">Verifying</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Please wait while we verify your email address...
            </p>
          </>
        )}

        {verified && (
          <>
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center border border-signal-green/30 bg-signal-green/10">
              <CheckCircle2 className="h-6 w-6 text-signal-green" />
            </div>
            <h1 className="text-xl font-display font-bold uppercase tracking-wider">
              Email Verified
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your email has been verified successfully. You can now access your account.
            </p>
            <button
              onClick={handleContinue}
              className="mt-6 flex h-10 w-full items-center justify-center bg-primary text-sm font-semibold text-primary-foreground uppercase tracking-wider transition-colors hover:bg-primary/90 active:bg-primary/80"
            >
              {user ? 'Continue to Dashboard' : 'Sign In'}
            </button>
          </>
        )}

        {!verifying && !verified && error && (
          <>
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center border border-destructive/30 bg-destructive/10">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <h1 className="text-xl font-display font-bold uppercase tracking-wider">
              Verification Failed
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <Link
              href="/login"
              className="mt-6 flex h-10 w-full items-center justify-center bg-primary text-sm font-semibold text-primary-foreground uppercase tracking-wider transition-colors hover:bg-primary/90 active:bg-primary/80"
            >
              Sign In
            </Link>
            <p className="mt-3 text-xs text-muted-foreground">
              Sign in to request a new verification email.
            </p>
          </>
        )}
      </div>
    );
  }

  // --- Waiting mode: logged in but unverified ---
  if (!user) return null;

  return (
    <div className="w-full max-w-sm text-center">
      <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center border border-primary/30 bg-primary/10">
        <Mail className="h-6 w-6 text-primary" />
      </div>

      <h1 className="text-xl font-display font-bold uppercase tracking-wider">Verify Your Email</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        We sent a verification link to{' '}
        <span className="font-medium text-foreground">{user.email}</span>
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Check your inbox and spam folder, then click the link to verify.
      </p>

      {error && (
        <div
          role="alert"
          className="mt-4 border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      {resent && (
        <div className="mt-4 border border-signal-green/40 bg-signal-green/10 px-3 py-2.5 text-sm text-signal-green">
          Verification email sent! Check your inbox.
        </div>
      )}

      <button
        onClick={handleResend}
        disabled={resending}
        className="mt-6 flex h-10 w-full items-center justify-center gap-2 border border-border bg-card text-sm font-medium transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
      >
        <RefreshCw className={`h-4 w-4 ${resending ? 'animate-spin' : ''}`} />
        {resending ? 'Sending...' : 'Resend Verification Email'}
      </button>

      <button
        onClick={handleLogout}
        className="mt-3 flex h-10 w-full items-center justify-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <LogOut className="h-4 w-4" />
        Sign Out
      </button>
    </div>
  );
}

export default function VerifyEmailPage() {
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
                <p className="text-sm font-medium text-foreground">Create Account</p>
                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                  Register with your email and set a secure password.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border border-primary bg-primary text-primary-foreground text-xs font-semibold">
                02
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Verify Email</p>
                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                  Click the link in your inbox to confirm your email address.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border border-border bg-muted text-muted-foreground text-xs font-semibold">
                03
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Access Dashboard</p>
                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                  Start managing channels, devices, and EPG schedules.
                </p>
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Email verification helps protect your account and ensures secure access.
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 bg-background">
        <div className="lg:hidden absolute top-6 left-6">
          <Link href="/">
            <span className="text-lg font-display font-bold tracking-tight">
              FIRE<span className="text-primary">VISION</span>
            </span>
          </Link>
        </div>

        <Suspense
          fallback={
            <div className="w-full max-w-sm text-center">
              <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center border border-border bg-card">
                <RefreshCw className="h-6 w-6 text-primary animate-spin" />
              </div>
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          }
        >
          <VerifyEmailContent />
        </Suspense>
      </div>
    </div>
  );
}
