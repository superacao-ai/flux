'use client';

import { useEffect, useState } from 'react';

interface User {
  id?: string;
  nome?: string;
  email?: string;
  tipo?: string;
  abas?: string[];
}

// Mapeamento de rotas para abas
const routeToTab: Record<string, string> = {
  '/calendario': 'calendario',
  '/horarios': 'horarios',
  '/alunos': 'alunos',
  '/professores': 'professores',
  '/usuarios': 'usuarios',
  '/modalidades': 'modalidades',
  '/aulas-realizadas': 'aulas',
  '/reagendamentos': 'reagendamentos',
  '/relatorios': 'relatorios',
  '/backup': 'backup',
  '/professor/minhaagenda': 'professor:minhaagenda',
  '/professor/alunos': 'professor:alunos',
  '/professor/aulas': 'professor:aulas',
};

export function usePermission() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        setUser(JSON.parse(raw));
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }, []);

  // Verifica se o usuário tem acesso a uma aba específica
  const hasAccess = (tab: string): boolean => {
    if (!user) return false;
    
    // root sempre tem acesso a tudo
    if (user.tipo === 'root') return true;
    
    const abas = user.abas || [];
    return abas.includes(tab);
  };

  // Verifica se o usuário pode acessar uma rota
  const canAccessRoute = (route: string): boolean => {
    if (!user) return false;
    
    // root sempre tem acesso
    if (user.tipo === 'root') return true;
    
    // Dashboard é acessível a todos logados
    if (route === '/dashboard') return true;
    
    // Encontrar a aba correspondente à rota
    const tab = Object.entries(routeToTab).find(([path]) => route.startsWith(path))?.[1];
    
    if (!tab) return true; // Se não encontrar mapeamento, permite acesso
    
    return hasAccess(tab);
  };

  // Retorna as abas permitidas para o usuário
  const getAllowedTabs = (): string[] => {
    if (!user) return [];
    if (user.tipo === 'root') {
      return Object.values(routeToTab);
    }
    return user.abas || [];
  };

  return {
    user,
    loading,
    hasAccess,
    canAccessRoute,
    getAllowedTabs,
    isRoot: user?.tipo === 'root',
    isProfessor: user?.tipo === 'professor',
    isAdmin: user?.tipo === 'admin',
  };
}

export { routeToTab };
