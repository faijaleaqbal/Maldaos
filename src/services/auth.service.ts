import { getSupabaseClient, isMockModeEnabled } from '@/lib/supabase';
import { User, UserRole } from '@/types';
import { MOCK_USERS } from './mockData';

const USER_STORAGE_KEY = 'campuspulse_active_user';

export const AuthService = {
  getCurrentUser(): User {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(USER_STORAGE_KEY);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {
          // fallback
        }
      }
    }
    // Default to student persona for standard onboarding
    return MOCK_USERS.student;
  },

  setCurrentUser(user: User): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    }
  },

  switchRole(role: UserRole): User {
    let targetUser: User = MOCK_USERS.student;
    if (role === 'STUDENT') targetUser = MOCK_USERS.student;
    else if (role === 'STAFF') targetUser = MOCK_USERS.staff;
    else if (role === 'DEPARTMENT_ADMIN') targetUser = MOCK_USERS.deptAdmin;
    else if (role === 'SUPER_ADMIN') targetUser = MOCK_USERS.superAdmin;

    this.setCurrentUser(targetUser);
    return targetUser;
  },

  async login(email: string, rolePreference?: UserRole): Promise<{ user: User | null; error: string | null }> {
    if (!isMockModeEnabled()) {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password: 'password123',
          });
          if (error) {
            return { user: null, error: error.message };
          }
          if (data.user) {
            const role = (data.user.user_metadata?.role as UserRole) || 'STUDENT';
            const user: User = {
              id: data.user.id,
              name: data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'User',
              email: data.user.email || email,
              role,
              department: data.user.user_metadata?.department || 'Malda College',
            };
            this.setCurrentUser(user);
            return { user, error: null };
          }
        } catch (err: any) {
          return { user: null, error: err.message || 'Supabase authentication failed' };
        }
      }
    }

    // Mock mode authentication
    const matched = Object.values(MOCK_USERS).find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (matched) {
      this.setCurrentUser(matched);
      return { user: matched, error: null };
    }

    // New mock login with selected role
    const chosenRole = rolePreference || 'STUDENT';
    const newUser: User = {
      id: `usr-${Date.now()}`,
      name: email.split('@')[0].replace('.', ' ').toUpperCase(),
      email,
      role: chosenRole,
      department: chosenRole === 'STUDENT' ? 'Malda College Academic Unit' : 'Campus Infrastructure',
      studentId: chosenRole === 'STUDENT' ? `MC-${new Date().getFullYear()}-GEN-${Math.floor(100 + Math.random() * 900)}` : undefined,
    };
    this.setCurrentUser(newUser);
    return { user: newUser, error: null };
  },

  async logout(): Promise<void> {
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  },

  getAllMockUsers(): User[] {
    return Object.values(MOCK_USERS);
  },
};
