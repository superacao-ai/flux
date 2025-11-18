"use client";

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Logo from './Logo';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  fullWidth?: boolean;
}

export default function Layout({ children, title = 'Superação Flux', fullWidth = false }: LayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  // do NOT read localStorage during render to avoid SSR/CSR mismatch
  const [user, setUser] = useState<any | null>(null);
  // null = unknown, true = professor, false = admin/other
  const [isProfessor, setIsProfessor] = useState<boolean | null>(null);
  // stable display name to avoid blinking when user state toggles briefly
  const [displayName, setDisplayName] = useState<string>('');
  const router = useRouter();

  const handleLogout = () => {
    try {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      // call server to clear auth cookie as well
      try { fetch('/api/auth/logout', { method: 'POST' }); } catch(e) {}
    } catch (e) {
      // ignore
    }
    // clear displayed name immediately to prevent stale greeting
    try { setDisplayName(''); } catch (e) {}
    router.push('/login');
  };

  // Keep storage sync so opening a new tab or login/logout updates sidebar
  useEffect(() => {
    // read localStorage on mount (client-only) so server-render doesn't differ
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        const u = JSON.parse(raw);
        setUser(u);
        setIsProfessor(u?.tipo === 'professor');
        setDisplayName(u?.nome || '');
      } else {
        // attempt to recover from token if present
        const token = localStorage.getItem('token');
        if (token) {
          try {
            const parts = token.split('.');
            if (parts.length >= 2) {
              const payloadRaw = parts[1].replace(/-/g, '+').replace(/_/g, '/');
              const decoded = decodeURIComponent(atob(payloadRaw).split('').map(function(c) { return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2); }).join(''));
              const payload = JSON.parse(decoded);
              const restoredUser = { id: payload.userId || payload.id || payload._id, nome: payload.nome || payload.name || '', email: payload.email || '', tipo: payload.tipo || 'professor' };
              try { localStorage.setItem('user', JSON.stringify(restoredUser)); } catch(e) {}
              setUser(restoredUser);
              setIsProfessor(restoredUser.tipo === 'professor');
              setDisplayName(restoredUser.nome || '');
            }
          } catch (e) { /* ignore */ }
        }
      }
    } catch (e) {
      // ignore
    }
  if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'user') {
          try {
            const raw = e.newValue;
            if (raw) {
              const u = JSON.parse(raw);
              setUser(u);
              setIsProfessor(u?.tipo === 'professor');
              setDisplayName(u?.nome || '');
            } else {
              setUser(null);
              setIsProfessor(null);
              setDisplayName('');
            }
          } catch (err) {
            // ignore
          }
        }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const sidebar = (
    <div className=" flex flex-col h-full bg-white text-gray-700 border-r border-gray-200">
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-center">
          <Logo size="sm" />
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {isProfessor === true ? (
          <div>
            <div className="mb-4">
              <div className="px-2 text-xs font-semibold uppercase text-gray-500 ">Professor</div>
              <div className="mt-2 space-y-1">
                <a href="/professor/minhaagenda" className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium ${pathname?.startsWith('/professor/minhaagenda') ? 'bg-primary-50 text-primary-700 transition-colors duration-200' : 'text-gray-600 hover:bg-gray-100 transition-colors duration-200'} `}><i className="fas fa-calendar-alt w-4 text-gray-500" aria-hidden="true" /> <span>Minha Agenda</span></a>
                <a href="/professor/alunos" className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium ${pathname?.startsWith('/professor/alunos') ? 'bg-primary-50 text-primary-700 transition-colors duration-200' : 'text-gray-600 hover:bg-gray-100 transition-colors duration-200'} `}><i className="fas fa-user-graduate w-4 text-gray-500" aria-hidden="true" /> <span>Meus Alunos</span></a>
                <a href="/professor/aulas" className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium ${pathname?.startsWith('/professor/aulas') ? 'bg-primary-50 text-primary-700 transition-colors duration-200' : 'text-gray-600 hover:bg-gray-100 transition-colors duration-200'} `}><i className="fas fa-clipboard-list w-4 text-gray-500" aria-hidden="true" /> <span>Minhas Aulas</span></a>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <div className="px-2 text-xs font-semibold uppercase text-gray-500">Principal</div>
              <div className="mt-2 space-y-1">
                <a href="/calendario" className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium ${pathname?.startsWith('/calendario') ? 'bg-primary-50 text-primary-700 transition-colors duration-200' : 'text-gray-600 hover:bg-gray-100 transition-colors duration-200'} `}><i className="fas fa-calendar-alt w-4 text-gray-500" aria-hidden="true" /> <span>Calendário</span></a>
                <a href="/horarios" className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium ${pathname?.startsWith('/horarios') ? 'bg-primary-50 text-primary-700 transition-colors duration-200' : 'text-gray-600 hover:bg-gray-100 transition-colors duration-200'} `}><i className="fas fa-clock w-4 text-gray-500" aria-hidden="true" /> <span>Horários</span></a>
              </div>
            </div>

            <div className="mb-4">
              <div className="px-2 text-xs font-semibold uppercase text-gray-500">Gestão</div>
              <div className="mt-2 space-y-1">
                <a href="/alunos" className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium ${pathname?.startsWith('/alunos') ? 'bg-primary-50 text-primary-700 transition-colors duration-200' : 'text-gray-600 hover:bg-gray-100 transition-colors duration-200'} `}><i className="fas fa-user-graduate w-4 text-gray-500" aria-hidden="true" /> <span>Alunos</span></a>
                <a href="/professores" className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium ${pathname?.startsWith('/professores') ? 'bg-primary-50 text-primary-700 transition-colors duration-200' : 'text-gray-600 hover:bg-gray-100 transition-colors duration-200'} `}><i className="fas fa-chalkboard-teacher w-4 text-gray-500" aria-hidden="true" /> <span>Professores</span></a>
                <a href="/modalidades" className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium ${pathname?.startsWith('/modalidades') ? 'bg-primary-50 text-primary-700 transition-colors duration-200' : 'text-gray-600 hover:bg-gray-100 transition-colors duration-200'} `}><i className="fas fa-layer-group w-4 text-gray-500" aria-hidden="true" /> <span>Modalidades</span></a>
                <a href="/aulas-realizadas" className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium ${pathname?.startsWith('/aulas-realizadas') ? 'bg-primary-50 text-primary-700 transition-colors duration-200' : 'text-gray-600 hover:bg-gray-100 transition-colors duration-200'} `}><i className="fas fa-clipboard-check w-4 text-gray-500" aria-hidden="true" /> <span>Aulas</span></a>
              </div>
            </div>

            <div className="mb-4">
              <div className="px-2 text-xs font-semibold uppercase text-gray-500">Ferramentas</div>
              <div className="mt-2 space-y-1">
                <a href="/reagendamentos" className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium ${pathname?.startsWith('/reagendamentos') ? 'bg-primary-50 text-primary-700 transition-colors duration-200' : 'text-gray-600 hover:bg-gray-100 transition-colors duration-200'} `}><i className="fas fa-exchange-alt w-4 text-gray-500" aria-hidden="true" /> <span>Reagendamentos</span></a>
                <a href="/relatorios" className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium ${pathname?.startsWith('/relatorios') ? 'bg-primary-50 text-primary-700 transition-colors duration-200' : 'text-gray-600 hover:bg-gray-100 transition-colors duration-200'} `}><i className="fas fa-chart-line w-4 text-gray-500" aria-hidden="true" /> <span>Relatórios</span></a>
                <a href="/backup" className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium ${pathname?.startsWith('/backup') ? 'bg-primary-50 text-primary-700 transition-colors duration-200' : 'text-gray-600 hover:bg-gray-100 transition-colors duration-200'} `}><i className="fas fa-database w-4 text-gray-500" aria-hidden="true" /> <span>Backups</span></a>
              </div>
            </div>
          </>
        )}

        <div className="mt-6 px-3">
          {/* Suporte removido conforme solicitado */}
        </div>

        
      </nav>

      <div className="px-3 py-4 border-t bg-gray-50">
        <div className="flex items-center gap-3 mb-3 px-2">
          {/* Avatar/Foto de Perfil */}
          <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
            {(displayName || 'U').charAt(0).toUpperCase()}
          </div>
          {/* Informações do usuário */}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-gray-900 truncate">{displayName || 'Usuário'}</div>
            <div className="text-xs text-gray-500">{user?.tipo === 'professor' ? 'Professor' : 'Administrador'}</div>
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
      <div className="md:hidden bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center">
              <button onClick={() => setMobileOpen(true)} className="p-2 text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
              <div className="ml-3">
                <Logo size="sm" />
              </div>
            </div>
            <div>
              <button onClick={handleLogout} className="bg-white hover:bg-gray-100 text-gray-700 px-3 py-1 rounded-md text-sm font-medium border border-gray-300 inline-flex items-center gap-1">
                <i className="fas fa-sign-out-alt" aria-hidden="true" />
                Sair
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar for md+ */}
        <aside className="hidden md:fixed md:inset-y-0 md:flex md:w-56 md:flex-col">
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

        {/* Main content area */}
        <div className={`flex-1 md:ml-56`}>
          <main className={`${fullWidth ? 'w-full' : 'max-w-7xl mx-auto'} py-6 sm:px-6 lg:px-8`}>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}