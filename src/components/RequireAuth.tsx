"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AccessDenied from '@/components/AccessDenied';

export default function RequireAuth({ children, roles, showLoginRedirect = true }: { children: React.ReactNode; roles?: string[]; showLoginRedirect?: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState<'checking' | 'ok' | 'denied'>('checking');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const token = localStorage.getItem('token');
      const raw = localStorage.getItem('user');
      const user = raw ? JSON.parse(raw) : null;

      if (!token || !user) {
        if (showLoginRedirect) {
          router.replace('/admin/login');
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
        router.replace('/admin/login');
        return;
      }
      setStatus('denied');
    }
  }, [router, roles, showLoginRedirect]);

  // Durante verificação, mostrar loading para evitar requisições não autenticadas
  if (!mounted || status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }
  
  if (status === 'denied') return <AccessDenied />;

  return <>{children}</>;
}
