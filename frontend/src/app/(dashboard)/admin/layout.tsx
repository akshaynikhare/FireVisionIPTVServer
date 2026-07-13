import { AppShell } from '@/components/layout/app-shell';
import { RoleGuard } from '@/components/role-guard';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard role="Admin">
      <AppShell role="admin">{children}</AppShell>
    </RoleGuard>
  );
}
