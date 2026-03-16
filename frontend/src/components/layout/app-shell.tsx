'use client';

import { Sidebar } from './sidebar';
import { Header } from './header';

export function AppShell({
  children,
  role,
}: {
  children: React.ReactNode;
  role: 'admin' | 'user';
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar role={role} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-5">{children}</main>
      </div>
    </div>
  );
}
