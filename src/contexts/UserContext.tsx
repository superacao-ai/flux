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

// Singleton global - persiste mesmo quando o Provider remonta
const globalState = {
  user: null as User | null,
  displayName: '',
  initialized: false,
};

function loadUserFromStorage(): { user: User | null; displayName: string } {
  if (typeof window === 'undefined') {
    return { user: null, displayName: '' };
  }
  
  try {
    const raw = localStorage.getItem('user');
    if (raw) {
      const u = JSON.parse(raw);
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
        return { user: restoredUser, displayName: restoredUser.nome || '' };
      }
    }
  } catch (e) {
    // ignore
  }
  
  return { user: null, displayName: '' };
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  // Inicializa com o estado global (já preenchido se não for a primeira montagem)
  const [user, setUser] = useState<User | null>(globalState.user);
  const [displayName, setDisplayName] = useState<string>(globalState.displayName);
  const [mounted, setMounted] = useState(globalState.initialized);
  const initRef = useRef(false);

  useEffect(() => {
    // Evita múltiplas inicializações
    if (initRef.current) return;
    initRef.current = true;

    // Só carrega do localStorage se ainda não foi inicializado globalmente
    if (!globalState.initialized) {
      const { user: loadedUser, displayName: loadedName } = loadUserFromStorage();
      globalState.user = loadedUser;
      globalState.displayName = loadedName;
      globalState.initialized = true;
      setUser(loadedUser);
      setDisplayName(loadedName);
    }
    
    setMounted(true);

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'user') {
        const { user: newUser, displayName: newName } = loadUserFromStorage();
        globalState.user = newUser;
        globalState.displayName = newName;
        setUser(newUser);
        setDisplayName(newName);
      }
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    } catch (e) {}
    globalState.user = null;
    globalState.displayName = '';
    setUser(null);
    setDisplayName('');
  }, []);

  const refreshUser = useCallback(() => {
    const { user: loadedUser, displayName: loadedName } = loadUserFromStorage();
    globalState.user = loadedUser;
    globalState.displayName = loadedName;
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
