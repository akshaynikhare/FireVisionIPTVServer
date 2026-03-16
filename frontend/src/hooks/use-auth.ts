'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import api from '@/lib/api';

export function useRequireAuth(requiredRole?: 'Admin' | 'User') {
  const router = useRouter();
  const { user, sessionId } = useAuthStore();
  const [hydrated, setHydrated] = useState(() =>
    typeof window !== 'undefined' ? (useAuthStore.persist?.hasHydrated?.() ?? false) : false,
  );
  const validated = useRef(false);

  useEffect(() => {
    if (hydrated) return;
    const unsub = useAuthStore.persist?.onFinishHydration?.(() => {
      setHydrated(true);
    });
    return () => unsub?.();
  }, [hydrated]);

  // Validate session with backend on page load
  useEffect(() => {
    if (!hydrated || validated.current) return;
    if (!user || !sessionId) return;

    validated.current = true;

    api.get('/auth/me').catch(() => {
      // 401 is handled by the response interceptor (calls logout + redirects)
      // Other errors are transient — don't log the user out
    });
  }, [hydrated, user, sessionId]);

  useEffect(() => {
    if (!hydrated) return;

    if (!user || !sessionId) {
      router.replace('/login');
      return;
    }

    if (requiredRole && user.role !== requiredRole) {
      router.replace(user.role === 'Admin' ? '/admin' : '/user');
      return;
    }
  }, [user, sessionId, requiredRole, router, hydrated]);

  return { user, isAuthenticated: !!user && !!sessionId, isLoading: !hydrated };
}
