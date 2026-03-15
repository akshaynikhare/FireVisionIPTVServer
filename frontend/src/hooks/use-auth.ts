'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';

export function useRequireAuth(requiredRole?: 'Admin' | 'User') {
  const router = useRouter();
  const { user, sessionId } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user || !sessionId) {
      router.replace('/login');
      return;
    }

    if (requiredRole && user.role !== requiredRole) {
      router.replace(user.role === 'Admin' ? '/admin' : '/user');
      return;
    }

    setIsLoading(false);
  }, [user, sessionId, requiredRole, router]);

  return { user, isAuthenticated: !!user && !!sessionId, isLoading };
}
