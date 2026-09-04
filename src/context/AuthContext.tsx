'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, UserRole } from '@/types';
import { AuthService, SEED_ACCOUNTS } from '@/services/auth.service';
import { MOCK_USERS } from '@/services/mockData';
import { getSupabaseClient, isMockModeEnabled } from '@/lib/supabase';

interface AuthContextType {
  user: User;
  role: UserRole;
  isAuthenticated: boolean;
  isAdmin: boolean;
  loading: boolean;
  switchRole: (role: UserRole) => Promise<void>;
  login: (email: string, password?: string, rolePreference?: UserRole) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, fullName: string, role?: UserRole) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  mockUsers: typeof MOCK_USERS;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User>(MOCK_USERS.student);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  const initAuth = useCallback(async () => {
    try {
      setLoading(true);
      const sessionUser = await AuthService.getSessionUser();
      if (sessionUser) {
        setUser(sessionUser);
      } else {
        setUser(AuthService.getCurrentUser());
      }
    } finally {
      setLoading(false);
      setMounted(true);
    }
  }, []);

  useEffect(() => {
    initAuth();

    if (!isMockModeEnabled()) {
      const supabase = getSupabaseClient();
      if (supabase) {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
            const current = await AuthService.getSessionUser();
            if (current) setUser(current);
          } else if (event === 'SIGNED_OUT') {
            setUser(MOCK_USERS.student);
          }
        });

        return () => {
          subscription.unsubscribe();
        };
      }
    }
  }, [initAuth]);

  const switchRole = async (newRole: UserRole) => {
    setLoading(true);
    try {
      const updated = await AuthService.switchRole(newRole);
      setUser(updated);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password?: string, rolePreference?: UserRole) => {
    setLoading(true);
    try {
      const res = await AuthService.login(email, password, rolePreference);
      if (res.user) {
        setUser(res.user);
        return { success: true };
      }
      return { success: false, error: res.error || 'Login failed' };
    } finally {
      setLoading(false);
    }
  };

  const register = async (email: string, password: string, fullName: string, role?: UserRole) => {
    setLoading(true);
    try {
      const res = await AuthService.register(email, password, fullName);
      if (res.user) {
        setUser(res.user);
        return { success: true };
      }
      return { success: false, error: res.error || 'Registration failed' };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await AuthService.logout();
      setUser(MOCK_USERS.student);
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = user.role === 'STAFF' || user.role === 'DEPARTMENT_ADMIN' || user.role === 'SUPER_ADMIN';

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user.role,
        isAuthenticated: mounted && !loading,
        isAdmin,
        loading,
        switchRole,
        login,
        register,
        logout,
        mockUsers: MOCK_USERS,
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

