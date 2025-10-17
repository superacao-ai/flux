"use client";

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import Logo from './Logo';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  fullWidth?: boolean;
}

export default function Layout({ children, title = 'Superação Flux', fullWidth = false }: LayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const sidebar = (
    <div className="flex flex-col h-full bg-dark-900 text-gray-100">
      <div className="flex items-center justify-center px-4 py-4 border-b border-dark-800">
        <div className="flex flex-col items-center">
          <Logo size="md" />
          <div className="text-white text-xs font-bold mt-1">FLUX</div>
        </div>
      </div>
    <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
  <a href="/dashboard" aria-current={pathname?.startsWith('/dashboard') ? 'page' : undefined} className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium ${pathname?.startsWith('/dashboard') ? 'bg-primary-500 text-white' : 'text-gray-300 hover:bg-dark-800 hover:text-white'}`}><i className="fas fa-tachometer-alt w-4 text-gray-300" aria-hidden="true" /> <span>Dashboard</span></a>
  <a href="/modalidades" aria-current={pathname?.startsWith('/modalidades') ? 'page' : undefined} className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium ${pathname?.startsWith('/modalidades') ? 'bg-primary-500 text-white' : 'text-gray-300 hover:bg-dark-800 hover:text-white'}`}><i className="fas fa-layer-group w-4 text-gray-300" aria-hidden="true" /> <span>Modalidades</span></a>
  <a href="/alunos" aria-current={pathname?.startsWith('/alunos') ? 'page' : undefined} className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium ${pathname?.startsWith('/alunos') ? 'bg-primary-500 text-white' : 'text-gray-300 hover:bg-dark-800 hover:text-white'}`}><i className="fas fa-user-graduate w-4 text-gray-300" aria-hidden="true" /> <span>Alunos</span></a>
  <a href="/professores" aria-current={pathname?.startsWith('/professores') ? 'page' : undefined} className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium ${pathname?.startsWith('/professores') ? 'bg-primary-500 text-white' : 'text-gray-300 hover:bg-dark-800 hover:text-white'}`}><i className="fas fa-chalkboard-teacher w-4 text-gray-300" aria-hidden="true" /> <span>Professores</span></a>
  <a href="/horarios" aria-current={pathname?.startsWith('/horarios') ? 'page' : undefined} className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium ${pathname?.startsWith('/horarios') ? 'bg-primary-500 text-white' : 'text-gray-300 hover:bg-dark-800 hover:text-white'}`}><i className="fas fa-clock w-4 text-gray-300" aria-hidden="true" /> <span>Horários</span></a>
  <a href="/calendar" aria-current={pathname?.startsWith('/calendar') ? 'page' : undefined} className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium ${pathname?.startsWith('/calendar') ? 'bg-primary-500 text-white' : 'text-gray-300 hover:bg-dark-800 hover:text-white'}`}><i className="fas fa-calendar-alt w-4 text-gray-300" aria-hidden="true" /> <span>Calendário</span></a>
  <a href="/reagendamentos" aria-current={pathname?.startsWith('/reagendamentos') ? 'page' : undefined} className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium ${pathname?.startsWith('/reagendamentos') ? 'bg-primary-500 text-white' : 'text-gray-300 hover:bg-dark-800 hover:text-white'}`}><i className="fas fa-exchange-alt w-4 text-gray-300" aria-hidden="true" /> <span>Reagendamentos</span></a>
  <a href="/relatorios" aria-current={pathname?.startsWith('/relatorios') ? 'page' : undefined} className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium ${pathname?.startsWith('/relatorios') ? 'bg-primary-500 text-white' : 'text-gray-300 hover:bg-dark-800 hover:text-white'}`}><i className="fas fa-chart-line w-4 text-gray-300" aria-hidden="true" /> <span>Relatórios</span></a>
    </nav>
      <div className="p-4 border-t border-dark-800">
        <button className="w-full bg-primary-500 hover:bg-primary-600 text-white px-3 py-2 rounded-md text-sm font-medium">Sair</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile top bar */}
      <div className="md:hidden bg-dark-900 border-b border-dark-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center">
              <button onClick={() => setMobileOpen(true)} className="p-2 text-gray-200">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
              <div className="ml-3">
                <Logo size="sm" />
              </div>
            </div>
            <div>
              <button className="bg-primary-500 hover:bg-primary-600 text-white px-3 py-1 rounded-md text-sm">Sair</button>
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
            <div className="absolute inset-y-0 left-0 w-72 bg-dark-900 shadow-lg">
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