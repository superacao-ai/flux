'use client';

import AppShell from '@/components/AppShell';
import RequireAuth from '@/components/RequireAuth';

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireAuth showLoginRedirect={true}>
      <AppShell>
        {children}
      </AppShell>
    </RequireAuth>
  );
}
