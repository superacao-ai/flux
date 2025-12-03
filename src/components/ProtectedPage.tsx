'use client';

import { useEffect, useState } from 'react';
import AccessDenied from '@/components/AccessDenied';

interface ProtectedPageProps {
  children: React.ReactNode;
  tab: string;
  title?: string;
  fullWidth?: boolean;
  customLoading?: boolean; // Se true, a página filha gerencia seu próprio loading
}

export default function ProtectedPage({ children, tab, title, fullWidth, customLoading }: ProtectedPageProps) {
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

  // Se a página filha gerencia seu próprio loading, apenas passar children
  // A verificação de permissão ainda acontece, mas mostramos children enquanto isso
  if (customLoading) {
    // Depois de montado, verificar permissão
    if (mounted && hasPermission === false) {
      return <AccessDenied />;
    }
    // Renderizar children (a página filha mostra seu próprio skeleton)
    return (
      <main className={`${fullWidth ? 'w-full' : 'max-w-7xl mx-auto'} py-6 sm:px-6 lg:px-8`}>
        {children}
      </main>
    );
  }

  // Loading enquanto verifica permissão - skeleton genérico
  if (!mounted) {
    return (
      <main className={`${fullWidth ? 'w-full' : 'max-w-7xl mx-auto'} py-6 sm:px-6 lg:px-8`}>
        <div className="px-4 py-6 sm:px-0">
          {/* Header skeleton */}
          <div className="mb-6">
            <div className="h-6 bg-gray-200 rounded w-40 mb-2 animate-pulse" />
            <div className="h-4 bg-gray-200 rounded w-72 animate-pulse" />
          </div>
          {/* Content skeleton */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-center gap-4">
                  <div className="h-10 w-10 bg-gray-200 rounded-lg animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse" />
                    <div className="h-3 bg-gray-100 rounded w-1/2 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>
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
