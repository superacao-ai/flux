"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import Logo from './Logo';
import PWAInstallPrompt from './PWAInstallPrompt';
import { useUser } from '@/contexts/UserContext';

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, displayName, mounted, logout } = useUser();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  // Fechar menu mobile ao navegar
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Memoizar lista de abas para evitar re-cálculo
  const userAbas = useMemo(() => user?.abas || [], [user?.abas]);
  
  // Função inline para checar acesso
  const hasAccess = (tab: string) => userAbas.includes(tab);

  // Estilos para esconder conteúdo até montar (evita piscar)
  const contentStyle = mounted ? {} : { visibility: 'hidden' as const };

  const sidebar = (
    <div className="flex flex-col h-full bg-white text-gray-700 border-r border-gray-200">
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-center">
          <Logo size="sm" />
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto" style={contentStyle}>
        {/* Seção Professor */}
        {(hasAccess('professor:minhaagenda') || hasAccess('professor:alunos') || hasAccess('professor:aulas')) && (
          <div className="mb-4">
            <div className="px-2 text-xs font-semibold uppercase text-gray-500">Professor</div>
            <div className="mt-2 space-y-1">
              {hasAccess('professor:minhaagenda') && (
                <Link href="/professor/minhaagenda" className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${pathname?.startsWith('/professor/minhaagenda') ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100'}`}><i className="fas fa-calendar-alt w-4 text-gray-500" aria-hidden="true" /> <span>Minha Agenda</span></Link>
              )}
              {hasAccess('professor:alunos') && (
                <Link href="/professor/alunos" className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${pathname?.startsWith('/professor/alunos') ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100'}`}><i className="fas fa-user-graduate w-4 text-gray-500" aria-hidden="true" /> <span>Meus Alunos</span></Link>
              )}
              {hasAccess('professor:aulas') && (
                <Link href="/professor/aulas" className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${pathname?.startsWith('/professor/aulas') ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100'}`}><i className="fas fa-clipboard-list w-4 text-gray-500" aria-hidden="true" /> <span>Minhas Aulas</span></Link>
              )}
            </div>
          </div>
        )}

        {/* Seção Principal */}
        {(hasAccess('calendario') || hasAccess('horarios')) && (
          <div className="mb-4">
            <div className="px-2 text-xs font-semibold uppercase text-gray-500">Principal</div>
            <div className="mt-2 space-y-1">
              {hasAccess('calendario') && (
                <Link href="/calendario" className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${pathname?.startsWith('/calendario') ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100'}`}><i className="fas fa-calendar-alt w-4 text-gray-500" aria-hidden="true" /> <span>Calendário</span></Link>
              )}
              {hasAccess('horarios') && (
                <Link href="/horarios" className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${pathname?.startsWith('/horarios') ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100'}`}><i className="fas fa-clock w-4 text-gray-500" aria-hidden="true" /> <span>Horários</span></Link>
              )}
            </div>
          </div>
        )}

        {/* Seção Gestão */}
        {(hasAccess('alunos') || hasAccess('usuarios') || hasAccess('modalidades') || hasAccess('aulas')) && (
          <div className="mb-4">
            <div className="px-2 text-xs font-semibold uppercase text-gray-500">Gestão</div>
            <div className="mt-2 space-y-1">
              {hasAccess('alunos') && (
                <Link href="/alunos" className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${pathname?.startsWith('/alunos') ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100'}`}><i className="fas fa-user-graduate w-4 text-gray-500" aria-hidden="true" /> <span>Alunos</span></Link>
              )}
              {hasAccess('usuarios') && (
                <Link href="/usuarios" className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${pathname?.startsWith('/usuarios') ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100'}`}><i className="fas fa-users-cog w-4 text-gray-500" aria-hidden="true" /> <span>Usuários</span></Link>
              )}
              {hasAccess('modalidades') && (
                <Link href="/modalidades" className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${pathname?.startsWith('/modalidades') ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100'}`}><i className="fas fa-layer-group w-4 text-gray-500" aria-hidden="true" /> <span>Modalidades</span></Link>
              )}
              {hasAccess('aulas') && (
                <Link href="/aulas-realizadas" className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${pathname?.startsWith('/aulas-realizadas') ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100'}`}><i className="fas fa-clipboard-check w-4 text-gray-500" aria-hidden="true" /> <span>Aulas</span></Link>
              )}
            </div>
          </div>
        )}

        {/* Seção Ferramentas */}
        {(hasAccess('reagendamentos') || hasAccess('relatorios') || hasAccess('backup')) && (
          <div className="mb-4">
            <div className="px-2 text-xs font-semibold uppercase text-gray-500">Ferramentas</div>
            <div className="mt-2 space-y-1">
              {hasAccess('reagendamentos') && (
                <Link href="/reagendamentos" className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${pathname?.startsWith('/reagendamentos') ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100'}`}><i className="fas fa-exchange-alt w-4 text-gray-500" aria-hidden="true" /> <span>Reagendamentos</span></Link>
              )}
              {hasAccess('relatorios') && (
                <Link href="/relatorios" className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${pathname?.startsWith('/relatorios') ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100'}`}><i className="fas fa-chart-line w-4 text-gray-500" aria-hidden="true" /> <span>Relatórios</span></Link>
              )}
              {hasAccess('backup') && (
                <Link href="/backup" className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${pathname?.startsWith('/backup') ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100'}`}><i className="fas fa-database w-4 text-gray-500" aria-hidden="true" /> <span>Backups</span></Link>
              )}
            </div>
          </div>
        )}
      </nav>

      <div className="px-3 py-4 border-t bg-gray-50" style={contentStyle}>
        <div className="flex items-center gap-3 mb-3 px-2">
          {user?.tipo === 'root' ? (
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 text-lg shadow-md border border-amber-300">
              <i className="fas fa-shield" aria-hidden="true" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
              {(displayName || 'U').charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-gray-900 truncate">{displayName || 'Usuário'}</div>
            <div className="text-xs text-gray-500">{user?.tipo === 'professor' ? 'Professor' : user?.tipo === 'root' ? 'Root' : 'Administrador'}</div>
          </div>
        </div>
        <button onClick={handleLogout} className="w-full bg-white hover:bg-gray-100 text-gray-700 px-3 py-2 rounded-md text-sm font-medium transition border border-gray-300 inline-flex items-center justify-center gap-2">
          <i className="fas fa-sign-out-alt" aria-hidden="true" />
          <span>Sair</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile top bar */}
      <div className="md:hidden bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-30">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center">
              <button onClick={() => setMobileOpen(true)} className="p-2 text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
              <div className="ml-3">
                <Logo size="sm" />
              </div>
            </div>
            <button onClick={handleLogout} className="bg-white hover:bg-gray-100 text-gray-700 px-3 py-1 rounded-md text-sm font-medium border border-gray-300 inline-flex items-center gap-1" style={contentStyle}>
              <i className="fas fa-sign-out-alt" aria-hidden="true" />
              Sair
            </button>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar fixa para desktop */}
        <aside className="hidden md:fixed md:inset-y-0 md:flex md:w-56 md:flex-col z-20">
          {sidebar}
        </aside>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div className="absolute inset-0 bg-black opacity-50" onClick={() => setMobileOpen(false)} />
            <div className="absolute inset-y-0 left-0 w-72 bg-white shadow-lg">
              <div className="h-full">{sidebar}</div>
            </div>
          </div>
        )}

        {/* Área de conteúdo principal */}
        <div className="flex-1 md:ml-56 pt-14 md:pt-0">
          {children}
        </div>

        <PWAInstallPrompt />
      </div>
    </div>
  );
}
