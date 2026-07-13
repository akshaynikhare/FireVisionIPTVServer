'use client';

import { useRequireAuth } from '@/hooks/use-auth';

export function RoleGuard({
  role,
  children,
}: {
  role: 'Admin' | 'User';
  children: React.ReactNode;
}) {
  const { user, isAuthenticated, isLoading } = useRequireAuth(role);

  if (isLoading || !isAuthenticated || user?.role !== role) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return <>{children}</>;
}
