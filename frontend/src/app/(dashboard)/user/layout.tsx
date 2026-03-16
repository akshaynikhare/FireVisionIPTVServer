import { AppShell } from '@/components/layout/app-shell';

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return <AppShell role="user">{children}</AppShell>;
}
