import { AppShell } from '@/components/layout/app-shell';
import { RoleGuard } from '@/components/role-guard';

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard role="User">
      <AppShell role="user">{children}</AppShell>
    </RoleGuard>
  );
}
