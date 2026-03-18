'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import api from '@/lib/api';

export function useRequireAuth(requiredRole?: 'Admin' | 'User') {
  const router = useRouter();
  const { user, sessionId, setUser } = useAuthStore();
  const [hydrated, setHydrated] = useState(false);
  const validated = useRef(false);

  useEffect(() => {
    if (hydrated) return;
    const unsub = useAuthStore.persist?.onFinishHydration?.(() => {
      setHydrated(true);
    });
    if (useAuthStore.persist?.hasHydrated?.()) {
      setHydrated(true);
    }
    return () => unsub?.();
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated || validated.current) return;
    if (!user || !sessionId) return;
    validated.current = true;
    api
      .get('/auth/me')
      .then((res) => {
        const serverUser = res.data?.user;
        if (serverUser && user && serverUser.emailVerified !== user.emailVerified) {
          setUser({ ...user, emailVerified: serverUser.emailVerified });
        }
      })
      .catch(() => {
        // 401 is handled by the response interceptor (calls logout + redirects)
      });
  }, [hydrated, user, sessionId, setUser]);

  useEffect(() => {
    if (!hydrated) return;
    if (!user || !sessionId) {
      router.replace('/login');
      return;
    }
    if (user.emailVerified === false) {
      router.replace('/verify-email');
      return;
    }
    if (requiredRole && user.role !== requiredRole) {
      router.replace(user.role === 'Admin' ? '/admin' : '/user');
      return;
    }
  }, [user, sessionId, requiredRole, router, hydrated]);

  return {
    user,
    isAuthenticated: !!user && !!sessionId && user.emailVerified !== false,
    isLoading: !hydrated,
  };
}
