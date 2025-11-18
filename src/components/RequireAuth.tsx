"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AccessDenied from '@/components/AccessDenied';

export default function RequireAuth({ children, roles, showLoginRedirect = true }: { children: React.ReactNode; roles?: string[]; showLoginRedirect?: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState<'checking' | 'ok' | 'denied'>('checking');

  useEffect(() => {
    // Check auth state from localStorage; if missing, either redirect to login or show access denied depending on prop
    try {
      const token = localStorage.getItem('token');
      const raw = localStorage.getItem('user');
      const user = raw ? JSON.parse(raw) : null;

      if (!token || !user) {
        if (showLoginRedirect) {
          router.replace('/login');
          return;
        }
        setStatus('denied');
        return;
      }

      if (roles && roles.length > 0) {
        const tipo = user?.tipo;
        if (!tipo || !roles.includes(tipo)) {
          setStatus('denied');
          return;
        }
      }

      setStatus('ok');
    } catch (e) {
      if (showLoginRedirect) {
        router.replace('/login');
        return;
      }
      setStatus('denied');
    }
  }, [router, roles, showLoginRedirect]);

  if (status === 'checking') return <>{/* loading placeholder */}</>;
  if (status === 'denied') return <AccessDenied />;

  return <>{children}</>;
}
