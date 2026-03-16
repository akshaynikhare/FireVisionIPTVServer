'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';

export function useRequireAuth(requiredRole?: 'Admin' | 'User') {
  const router = useRouter();
  const { user, sessionId } = useAuthStore();
  const [hydrated, setHydrated] = useState(() =>
    typeof window !== 'undefined' ? (useAuthStore.persist?.hasHydrated?.() ?? false) : false,
  );

  useEffect(() => {
    if (hydrated) return;
    const unsub = useAuthStore.persist?.onFinishHydration?.(() => {
      setHydrated(true);
    });
    return () => unsub?.();
  }, [hydrated]);

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
