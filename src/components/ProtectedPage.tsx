'use client';

import { useEffect, useState } from 'react';
import AccessDenied from '@/components/AccessDenied';

interface ProtectedPageProps {
  children: React.ReactNode;
  tab: string;
  title?: string;
  fullWidth?: boolean;
}

export default function ProtectedPage({ children, tab, title, fullWidth }: ProtectedPageProps) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem('user');
      const user = raw ? JSON.parse(raw) : null;
      if (user) {
        const abas = user.abas || [];
        setHasPermission(abas.includes(tab));
      } else {
        setHasPermission(false);
      }
    } catch {
      setHasPermission(false);
    }
  }, [tab]);

  // Loading enquanto verifica permissão
  if (!mounted) {
    return (
      <main className={`${fullWidth ? 'w-full' : 'max-w-7xl mx-auto'} py-6 sm:px-6 lg:px-8`}>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </main>
    );
  }

  // Sem permissão - mostrar acesso negado
  if (hasPermission === false) {
    return <AccessDenied />;
  }

  return (
    <main className={`${fullWidth ? 'w-full' : 'max-w-7xl mx-auto'} py-6 sm:px-6 lg:px-8`}>
      {children}
    </main>
  );
}
