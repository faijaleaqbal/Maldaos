'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, UserRole } from '@/types';
import { AuthService } from '@/services/auth.service';
import { isSupabaseConfigured } from '@/lib/supabase';

interface AuthContextType {
  /** Always null when Supabase is not configured (fail-closed). */
  user: User | null;
  role: UserRole;
  isAuthenticated: boolean;
  isAdmin: boolean;
  /** True if Supabase env is configured. UI should branch on this. */
  supabaseConfigured: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  /** Re-resolve role from DB. Use on /admin entry. */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [mounted, setMounted] = useState(false);
  const [supabaseConfigured, setSupabaseConfigured] = useState(false);

  useEffect(() => {
    setSupabaseConfigured(isSupabaseConfigured());
    const cached = AuthService.getCurrentUser();
    setUser(cached);
    setMounted(true);
  }, []);

  const login = async (email: string, password: string) => {
    const res = await AuthService.login(email, password);
    if (res.user) {
      setUser(res.user);
      return { success: true as const };
    }
    return { success: false as const, error: res.error ?? 'Login failed' };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const res = await AuthService.signUp(email, password, fullName);
    if (res.user) {
      setUser(res.user);
      return { success: true as const };
    }
    return { success: false as const, error: res.error ?? 'Sign-up failed' };
  };

  const logout = async () => {
    await AuthService.logout();
    setUser(null);
  };

  const refresh = async () => {
    const u = await AuthService.refreshCurrentUser();
    if (u) setUser(u);
  };

  const isAdmin = !!user && (user.role === 'STAFF' || user.role === 'DEPARTMENT_ADMIN' || user.role === 'SUPER_ADMIN');

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role ?? 'STUDENT',
        isAuthenticated: mounted && !!user,
        isAdmin,
        supabaseConfigured,
        login,
        signUp,
        logout,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
