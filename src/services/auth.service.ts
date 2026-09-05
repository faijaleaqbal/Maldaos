import { getSupabaseClient, isMockModeEnabled, toBackendError } from '@/lib/supabase';
import { mapProfileToUser, ProfileRow } from '@/lib/backendTypes';
import { User, UserRole } from '@/types';
import { MOCK_USERS } from './mockData';
import { getSeedAccount } from './devSeedAccounts';

const USER_STORAGE_KEY = 'campuspulse_active_user';

/**
 * Load the authoritative profile row for a user id. Role/department/full_name
 * come from the DB ONLY — browser user_metadata.role is never trusted.
 * Throws typed error when the profile is missing (live mode must not invent
 * a role).
 */
async function loadDbUser(userId: string, email?: string | null): Promise<User> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw toBackendError({ message: 'BACKEND_NOT_CONFIGURED: Supabase client missing.' }, 'BACKEND_NOT_CONFIGURED');
  }
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*, colleges(name), departments(name, code)')
    .eq('id', userId)
    .maybeSingle();

  if (error || !profile) {
    throw toBackendError(
      { message: 'PROFILE_NOT_FOUND: your account profile is unavailable in the database. Contact the administrator.' },
      'PROFILE_NOT_FOUND'
    );
  }
  return mapProfileToUser(profile as ProfileRow, email);
}

export const AuthService = {
  /** Restore session on load (live: DB profile; mock: stored persona). */
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
      const user = await loadDbUser(session.user.id, session.user.email);
      this.setCurrentUser(user);
      return user;
    } catch (err) {
      console.error('Session restore failed:', err);
      return null;
    }
  },

  /** Current persona (MOCK MODE: localStorage; LIVE MODE: unauthenticated guest). */
  getCurrentUser(): User {
    if (isMockModeEnabled()) {
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
    }
    // LIVE MODE: never read client localStorage to grant identity/roles
    return {
      id: '',
      name: 'Guest Student',
      email: '',
      role: 'STUDENT',
      department: 'Malda College',
      studentId: 'MC-2024-REG-042',
    };
  },

  setCurrentUser(user: User): void {
    if (isMockModeEnabled() && typeof window !== 'undefined') {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    }
  },

  /**
   * Switch role/persona.
   *  - MOCK MODE: swaps the local demo persona (no auth involved).
   *  - LIVE MODE (non-production dev only): performs a REAL Supabase login as
   *    the seeded demo account for that role. The resulting role is whatever
   *    profiles.role says in the DB.
   *  - PRODUCTION: hard-blocked. Seeded demo logins (including SUPER_ADMIN)
   *    are never usable in production; only real credentials authenticate.
   */
  async switchRole(role: UserRole): Promise<User> {
    if (!isMockModeEnabled()) {
      if (process.env.NODE_ENV === 'production') {
        throw toBackendError(
          { message: 'ACCOUNT_SWITCH_FAILED: role switching via seeded accounts is disabled in production. Sign in with your real credentials.' },
          'ACCOUNT_SWITCH_FAILED'
        );
      }
      const creds = getSeedAccount(role);
      const res = await this.login(creds.email, creds.pass);
      if (res.user) {
        return res.user;
      }
      throw toBackendError(
        { message: res.error || 'Could not switch to the seeded account for this role.' },
        'ACCOUNT_SWITCH_FAILED'
      );
    }

    let targetUser: User = MOCK_USERS.student;
    if (role === 'STUDENT') targetUser = MOCK_USERS.student;
    else if (role === 'STAFF') targetUser = MOCK_USERS.staff;
    else if (role === 'DEPARTMENT_ADMIN') targetUser = MOCK_USERS.deptAdmin;
    else if (role === 'SUPER_ADMIN') targetUser = MOCK_USERS.superAdmin;

    this.setCurrentUser(targetUser);
    return targetUser;
  },

  /**
   * Login. LIVE mode requires the password from the form — there is NO
   * hardcoded default. Role comes from profiles.role (DB), never from
   * user_metadata.
   */
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

      if (!password) {
        return { user: null, error: 'Password is required.' };
      }

      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          return { user: null, error: error.message };
        }

        if (data.user) {
          try {
            const user = await loadDbUser(data.user.id, data.user.email);
            this.setCurrentUser(user);
            return { user, error: null };
          } catch (profErr: any) {
            // Auth succeeded but the profile row is missing/damaged — fail
            // loudly rather than falling back to metadata (role safety).
            return { user: null, error: profErr.message || 'Profile unavailable. Contact administrator.' };
          }
        }
        return { user: null, error: 'Login returned no user.' };
      } catch (err: any) {
        return { user: null, error: err.message || 'Supabase authentication failed' };
      }
    }

    // ---- MOCK MODE ----
    const matched = Object.values(MOCK_USERS).find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (matched) {
      this.setCurrentUser(matched);
      return { user: matched, error: null };
    }

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

  /**
   * Register. LIVE mode: real supabase.auth.signUp with full_name metadata —
   * the backend's auth trigger (0006) creates the profiles row with role
   * STUDENT. The DB trigger is the authority; the browser cannot choose a
   * role at signup.
   */
  async register(
    email: string,
    password: string,
    fullName: string
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
          // Local stack has email confirmations disabled -> session exists
          // immediately and the profile trigger has run. Sign in to establish
          // the session and load the DB profile.
          const res = await this.login(email, password);
          if (res.user) {
            return { user: res.user, error: null };
          }
          // No session (e.g. remote project with confirmations on):
          // surface a clear message instead of a silent partial login.
          return {
            user: null,
            error: 'Account created. Please confirm your email, then sign in.',
          };
        }
        return { user: null, error: 'Registration returned no user.' };
      } catch (err: any) {
        return { user: null, error: err.message || 'Registration failed' };
      }
    }

    // Mock mode
    return this.login(email, password, 'STUDENT');
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
