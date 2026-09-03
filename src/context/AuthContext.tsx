'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, UserRole } from '@/types';
import { AuthService } from '@/services/auth.service';
import { MOCK_USERS } from '@/services/mockData';

interface AuthContextType {
  user: User;
  role: UserRole;
  isAuthenticated: boolean;
  isAdmin: boolean;
  switchRole: (role: UserRole) => void;
  login: (email: string, rolePreference?: UserRole) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  mockUsers: typeof MOCK_USERS;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User>(MOCK_USERS.student);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const current = AuthService.getCurrentUser();
    setUser(current);
    setMounted(true);
  }, []);

  const switchRole = (newRole: UserRole) => {
    const updated = AuthService.switchRole(newRole);
    setUser(updated);
  };

  const login = async (email: string, rolePreference?: UserRole) => {
    const res = await AuthService.login(email, rolePreference);
    if (res.user) {
      setUser(res.user);
      return { success: true };
    }
    return { success: false, error: res.error || 'Login failed' };
  };

  const logout = async () => {
    await AuthService.logout();
    setUser(MOCK_USERS.student);
  };

  const isAdmin = user.role === 'STAFF' || user.role === 'DEPARTMENT_ADMIN' || user.role === 'SUPER_ADMIN';

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user.role,
        isAuthenticated: mounted,
        isAdmin,
        switchRole,
        login,
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
