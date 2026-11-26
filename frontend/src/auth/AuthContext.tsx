import React, { createContext, useContext, useEffect, useState } from 'react';
import type { AuthUser } from './types';
import { bootstrapCsrfProtection, getCurrentSession, logout } from '../services/authApi';

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  refreshSession: () => Promise<void>;
  setAuthenticatedUser: (user: AuthUser | null) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const SESSION_HINT_KEY = 'antcrowd_session_hint';
const PROTECTED_PATH_PREFIXES = [
  '/researcher/verification',
  '/dashboard',
  '/programs',
  '/reports',
  '/inbox',
  '/settings',
  '/payments',
  '/invitations',
  '/organization/workspace',
  '/company/onboarding',
  '/organization/invite',
  '/company/invite',
  '/compliance',
  '/developer'
];

function isProtectedPath(pathname: string) {
  return PROTECTED_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function hasSessionHint() {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    return window.localStorage.getItem(SESSION_HINT_KEY) === '1';
  } catch {
    return false;
  }
}

function setSessionHint(enabled: boolean) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (enabled) {
      window.localStorage.setItem(SESSION_HINT_KEY, '1');
      return;
    }

    window.localStorage.removeItem(SESSION_HINT_KEY);
  } catch {
    // Ignore storage access failures so auth still works in locked-down browsers.
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  function applyAuthenticatedUser(nextUser: AuthUser | null) {
    setUser(nextUser);
    setSessionHint(Boolean(nextUser));
    if (typeof window !== 'undefined') {
      try {
        if (nextUser) {
          window.localStorage.setItem('antcrowd_user_role', nextUser.accountType || '');
          window.localStorage.setItem('antcrowd_user_email', nextUser.email || '');
        } else {
          window.localStorage.removeItem('antcrowd_user_role');
          window.localStorage.removeItem('antcrowd_user_email');
        }
      } catch {}
    }
  }

  async function refreshSession() {
    try {
      const response = await getCurrentSession();
      applyAuthenticatedUser(response.user);
    } catch {
      applyAuthenticatedUser(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function signOut() {
    try {
      await logout();
    } finally {
      applyAuthenticatedUser(null);
    }
  }

  useEffect(() => {
    void bootstrapCsrfProtection();
    const pathname = typeof window === 'undefined' ? '/' : window.location.pathname;
    if (hasSessionHint() || isProtectedPath(pathname)) {
      void refreshSession();
    } else {
      setIsLoading(false);
    }

    if (typeof window !== 'undefined') {
      const handleStorage = (e: StorageEvent) => {
        if (e.key === 'antcrowd_user_role' || e.key === 'antcrowd_user_email' || e.key === SESSION_HINT_KEY) {
          void refreshSession();
        }
      };
      window.addEventListener('storage', handleStorage);
      return () => window.removeEventListener('storage', handleStorage);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        refreshSession,
        setAuthenticatedUser: applyAuthenticatedUser,
        signOut
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
