"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RequireAuth({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const router = useRouter();

  useEffect(() => {
    // Non-blocking check: redirect unauthorized users but don't show a placeholder
    try {
      const token = localStorage.getItem('token');
      const raw = localStorage.getItem('user');
      const user = raw ? JSON.parse(raw) : null;
      if (!token || !user) {
        router.replace('/login');
        return;
      }
      if (roles && roles.length > 0) {
        const tipo = user?.tipo;
        if (!tipo || !roles.includes(tipo)) {
          router.replace('/login');
          return;
        }
      }
    } catch (e) {
      router.replace('/login');
      return;
    }
  }, [router, roles]);

  // Render children immediately; the effect will redirect if not authorized.
  return <>{children}</>;
}
