import { getSupabaseClient, isMockModeEnabled } from '@/lib/supabase';
import { User, UserRole } from '@/types';
import { MOCK_USERS } from './mockData';

const USER_STORAGE_KEY = 'campuspulse_active_user';

// Test credentials matching database seed
export const SEED_ACCOUNTS: Record<UserRole, { email: string; pass: string; label: string }> = {
  STUDENT: { email: 'student1@campus.test', pass: 'TestPass123!', label: 'Aarav Student (CSE)' },
  STAFF: { email: 'staff.cse@campus.test', pass: 'TestPass123!', label: 'Ravi Staff (CSE Maintenance)' },
  DEPARTMENT_ADMIN: { email: 'admin.cse@campus.test', pass: 'TestPass123!', label: 'Dr. Sen (Dept Admin CSE)' },
  SUPER_ADMIN: { email: 'super@campus.test', pass: 'TestPass123!', label: 'Principal Super (Executive Admin)' },
};

export const AuthService = {
  async getSessionUser(): Promise<User | null> {
    if (isMockModeEnabled()) {
      return this.getCurrentUser();
    }

    const supabase = getSupabaseClient();
    if (!supabase) return null;

    try {
      const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr || !session?.user) {
        return null;
      }

      const { data: profile, error: profErr } = await supabase
        .from('profiles')
        .select('*, colleges(name), departments(name, code)')
        .eq('id', session.user.id)
        .single();

      if (profErr || !profile) {
        console.warn('Could not fetch authoritative profile:', profErr);
        // Fallback user from session metadata if profile trigger is slightly delayed
        const fallbackRole = (session.user.user_metadata?.role as UserRole) || 'STUDENT';
        const user: User = {
          id: session.user.id,
          name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
          email: session.user.email || '',
          role: fallbackRole,
          department: 'Malda College',
        };
        this.setCurrentUser(user);
        return user;
      }

      const user: User = {
        id: profile.id,
        name: profile.full_name || session.user.email?.split('@')[0] || 'User',
        email: session.user.email || '',
        role: profile.role as UserRole,
        department: profile.departments?.name || profile.colleges?.name || 'Malda College',
        phone: profile.phone || undefined,
        studentId: profile.role === 'STUDENT' ? `MC-${profile.id.slice(0, 6).toUpperCase()}` : undefined,
        staffId: profile.role !== 'STUDENT' ? `MC-STF-${profile.id.slice(0, 6).toUpperCase()}` : undefined,
      };

      this.setCurrentUser(user);
      return user;
    } catch (err) {
      console.error('Session restore failed:', err);
      return null;
    }
  },

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
    return MOCK_USERS.student;
  },

  setCurrentUser(user: User): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    }
  },

  async switchRole(role: UserRole): Promise<User> {
    if (!isMockModeEnabled()) {
      const creds = SEED_ACCOUNTS[role];
      if (creds) {
        const res = await this.login(creds.email, creds.pass);
        if (res.user) {
          return res.user;
        }
      }
    }

    let targetUser: User = MOCK_USERS.student;
    if (role === 'STUDENT') targetUser = MOCK_USERS.student;
    else if (role === 'STAFF') targetUser = MOCK_USERS.staff;
    else if (role === 'DEPARTMENT_ADMIN') targetUser = MOCK_USERS.deptAdmin;
    else if (role === 'SUPER_ADMIN') targetUser = MOCK_USERS.superAdmin;

    this.setCurrentUser(targetUser);
    return targetUser;
  },

  async login(
    email: string,
    password?: string,
    rolePreference?: UserRole
  ): Promise<{ user: User | null; error: string | null }> {
    if (!isMockModeEnabled()) {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return { user: null, error: 'Supabase client is not configured' };
      }

      try {
        const pass = password || 'TestPass123!';
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password: pass,
        });

        if (error) {
          return { user: null, error: error.message };
        }

        if (data.user) {
          const { data: profile, error: pErr } = await supabase
            .from('profiles')
            .select('*, colleges(name), departments(name, code)')
            .eq('id', data.user.id)
            .single();

          const role = (profile?.role as UserRole) || (data.user.user_metadata?.role as UserRole) || 'STUDENT';
          const user: User = {
            id: data.user.id,
            name: profile?.full_name || data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'User',
            email: data.user.email || email,
            role,
            department: profile?.departments?.name || profile?.colleges?.name || 'Malda College',
            phone: profile?.phone || undefined,
            studentId: role === 'STUDENT' ? `MC-${data.user.id.slice(0, 6).toUpperCase()}` : undefined,
            staffId: role !== 'STUDENT' ? `MC-STF-${data.user.id.slice(0, 6).toUpperCase()}` : undefined,
          };

          this.setCurrentUser(user);
          return { user, error: null };
        }
      } catch (err: any) {
        return { user: null, error: err.message || 'Supabase authentication failed' };
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

  async register(
    email: string,
    password: string,
    fullName: string,
    role: UserRole = 'STUDENT'
  ): Promise<{ user: User | null; error: string | null }> {
    if (!isMockModeEnabled()) {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return { user: null, error: 'Supabase client is not configured' };
      }

      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
          },
        });

        if (error) {
          return { user: null, error: error.message };
        }

        if (data.user) {
          // If session created immediately:
          return await this.login(email, password, role);
        }
      } catch (err: any) {
        return { user: null, error: err.message || 'Registration failed' };
      }
    }

    // Mock mode
    return this.login(email, password, role);
  },

  async logout(): Promise<void> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn('SignOut error:', e);
      }
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  },

  getAllMockUsers(): User[] {
    return Object.values(MOCK_USERS);
  },
};

