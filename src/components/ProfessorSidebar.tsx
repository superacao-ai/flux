"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function ProfessorSidebar() {
  const [hydrated, setHydrated] = useState(false);
  const [user, setUser] = useState<any | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();

  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
      const parsed = raw ? JSON.parse(raw) : null;
      setUser(parsed);
    } catch (e) {
      setUser(null);
    } finally {
      setHydrated(true);
    }
  }, []);

  // While hydrating, render nothing to avoid SSR/CSR mismatch
  if (!hydrated) return null;

  if (!user || user.tipo !== 'professor') return null;

  const handleLogout = () => {
    // Esconder conteúdo imediatamente para evitar flash
    setLoggingOut(true);
    // Redirecionar imediatamente ANTES de limpar o estado
    router.replace('/admin/login');
    // Limpar estado após iniciar navegação
    setTimeout(() => {
      try {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      } catch (e) {}
    }, 100);
  };

  // Se está fazendo logout, mostra uma tela em branco
  if (loggingOut) {
    return (
      <div className="flex flex-col h-full bg-gray-100 items-center justify-center">
        <div className="text-gray-500 text-sm">Saindo...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-dark-900 text-gray-100">
      <div className="flex items-center justify-center px-4 py-4 border-b border-dark-800">
        <div className="flex flex-col items-center">
          <div className="text-white text-xs font-bold">FLUX</div>
        </div>
      </div>
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 py-3">
          {/* Greeting intentionally removed to avoid flashing */}
          <div className="font-semibold text-white">{user.nome}</div>
          <div className="text-xs text-gray-400">Personal</div>
        </div>
        <a href="/professor/agenda" className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium ${false ? 'bg-primary-500 text-white' : 'text-gray-300 hover:bg-dark-800 hover:text-white'}`}>
          <i className="fas fa-calendar-alt w-4 text-gray-300" aria-hidden="true" />
          <span>Agenda</span>
        </a>
        <a href="/perfil" className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium ${false ? 'bg-primary-500 text-white' : 'text-gray-300 hover:bg-dark-800 hover:text-white'}`}>
          <i className="fas fa-user w-4 text-gray-300" aria-hidden="true" />
          <span>Meu Perfil</span>
        </a>
      </nav>
      <div className="p-4 border-t border-dark-800">
        <button onClick={handleLogout} className="w-full bg-primary-500 hover:bg-primary-600 text-white px-3 py-2 rounded-md text-sm font-medium">Sair</button>
      </div>
    </div>
  );
}

