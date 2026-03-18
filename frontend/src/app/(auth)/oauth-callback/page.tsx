'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';

function OAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setSession, setTokens } = useAuthStore();
  const [error, setError] = useState('');

  useEffect(() => {
    const sessionId = searchParams.get('sessionId');
    const accessToken = searchParams.get('accessToken');
    const refreshToken = searchParams.get('refreshToken');
    const userStr = searchParams.get('user');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setError(errorParam);
      return;
    }

    if (userStr) {
      try {
        const user = JSON.parse(decodeURIComponent(userStr));

        if (sessionId) {
          setSession(user, sessionId);
        } else if (accessToken && refreshToken) {
          setTokens(user, accessToken, refreshToken);
        }

        // Check if there's a pending TV pairing
        // Don't remove from sessionStorage — let /pair page clear it on success
        const pairingPin = sessionStorage.getItem('firevision-pairing-pin');
        if (pairingPin) {
          router.replace(`/pair?pin=${pairingPin}`);
        } else if (user.role === 'Admin') {
          router.replace('/admin');
        } else {
          router.replace('/user');
        }
        return;
      } catch {
        setError('Failed to process authentication response');
        return;
      }
    }

    // If no params, redirect to login
    if (!sessionId && !accessToken && !userStr) {
      router.replace('/login');
    }
  }, [searchParams, router, setSession, setTokens]);

  if (error) {
    return (
      <div className="h-screen overflow-y-auto flex items-center justify-center bg-background px-6">
        <div className="w-full max-w-sm text-center space-y-4">
          <h1 className="text-lg font-display font-bold uppercase tracking-[0.1em]">
            Authentication Failed
          </h1>
          <div className="border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
          <button
            onClick={() => router.push('/login')}
            className="inline-flex items-center px-6 py-2.5 text-sm font-medium bg-primary text-primary-foreground uppercase tracking-[0.1em] transition-colors hover:bg-primary/90"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-y-auto flex items-center justify-center bg-background">
      <div className="text-center space-y-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
        <p className="text-sm text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen overflow-y-auto flex items-center justify-center bg-background">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      }
    >
      <OAuthCallbackContent />
    </Suspense>
  );
}
