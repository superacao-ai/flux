'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';

interface User {
  id: string;
  nome: string;
  email: string;
  tipo: string;
  abas: string[];
}

interface UserContextType {
  user: User | null;
  displayName: string;
  mounted: boolean;
  logout: () => void;
  refreshUser: () => void;
}

const UserContext = createContext<UserContextType | null>(null);

function loadUserFromStorage(): { user: User | null; displayName: string } {
  if (typeof window === 'undefined') {
    return { user: null, displayName: '' };
  }
  
  try {
    const raw = localStorage.getItem('user');
    if (raw) {
      const u = JSON.parse(raw);
      console.log('👤 UserContext - Usuário carregado:', u?.nome, 'Abas:', u?.abas?.length || 0);
      return { user: u, displayName: u?.nome || '' };
    }
    
    const token = localStorage.getItem('token');
    if (token) {
      const parts = token.split('.');
      if (parts.length >= 2) {
        const payloadRaw = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const decoded = decodeURIComponent(
          atob(payloadRaw)
            .split('')
            .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );
        const payload = JSON.parse(decoded);
        const restoredUser: User = {
          id: payload.userId || payload.id || payload._id,
          nome: payload.nome || payload.name || '',
          email: payload.email || '',
          tipo: payload.tipo || 'professor',
          abas: payload.abas || [],
        };
        try {
          localStorage.setItem('user', JSON.stringify(restoredUser));
        } catch (e) {}
        console.log('👤 UserContext - Usuário restaurado do token:', restoredUser?.nome);
        return { user: restoredUser, displayName: restoredUser.nome || '' };
      }
    }
  } catch (e) {
    console.error('❌ UserContext - Erro ao carregar usuário:', e);
  }
  
  return { user: null, displayName: '' };
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState<string>('');
  const [mounted, setMounted] = useState(false);

  // Função para buscar dados atualizados do usuário do servidor
  const syncUserFromServer = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          const updatedUser: User = {
            id: data.user._id || data.user.id,
            nome: data.user.nome,
            email: data.user.email,
            tipo: data.user.tipo,
            abas: data.user.abas || [],
          };
          
          // Comparar se mudou algo
          const currentRaw = localStorage.getItem('user');
          const current = currentRaw ? JSON.parse(currentRaw) : null;
          
          if (!current || JSON.stringify(current.abas) !== JSON.stringify(updatedUser.abas)) {
            console.log('🔄 UserContext - Abas atualizadas do servidor:', updatedUser.abas);
            localStorage.setItem('user', JSON.stringify(updatedUser));
            setUser(updatedUser);
            setDisplayName(updatedUser.nome);
          }
        }
      }
    } catch (e) {
      // Ignora erros de rede (podem ser causados por extensões de segurança)
      if (e instanceof Error && e.name !== 'AbortError') {
        console.warn('Erro ao sincronizar usuário (pode ser extensão de segurança):', e.message);
      }
    }
  }, []);

  useEffect(() => {
    // Sempre carrega do localStorage ao montar
    const { user: loadedUser, displayName: loadedName } = loadUserFromStorage();
    setUser(loadedUser);
    setDisplayName(loadedName);
    setMounted(true);

    // Sincroniza com o servidor ao montar e periodicamente
    syncUserFromServer();
    const syncInterval = setInterval(syncUserFromServer, 60000); // A cada 1 minuto

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'user') {
        const { user: newUser, displayName: newName } = loadUserFromStorage();
        setUser(newUser);
        setDisplayName(newName);
      }
    };

    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
      clearInterval(syncInterval);
    };
  }, [syncUserFromServer]);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    } catch (e) {}
    setUser(null);
    setDisplayName('');
  }, []);

  const refreshUser = useCallback(() => {
    const { user: loadedUser, displayName: loadedName } = loadUserFromStorage();
    setUser(loadedUser);
    setDisplayName(loadedName);
  }, []);

  return (
    <UserContext.Provider value={{ user, displayName, mounted, logout, refreshUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
