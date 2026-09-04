/**
 * Auth service — Production
 *
 * Security invariants (per the Jan 2027 audit):
 *   1. Provider API keys / admin credentials are NEVER in this file.
 *   2. The role is ALWAYS read from public.profiles.role (DB) — never
 *      from user_metadata, which is user-editable and not authoritative.
 *   3. The seed accounts shipped in the previous build (TestPass123!
 *      on a SUPER_ADMIN) have been removed. There is no client-side
 *      "1-click login as super admin" anymore.
 *   4. If Supabase is configured, every login goes through Supabase
 *      Auth. If Supabase is NOT configured, the app fails closed:
 *      the user sees a clear "configuration required" message and
 *      cannot proceed (no mock fallthrough that silently serves
 *      fake data in production).
 *   5. The admin gate is enforced SERVER-SIDE in the API route
 *      middleware and via the SQL RLS policies. The client
 *      `isAdmin` is a hint, never a security boundary.
 */
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';
import { User, UserRole } from '@/types';

const USER_STORAGE_KEY = 'campuspulse_active_user';

export const AuthService = {
  /**
   * Read the locally-cached user (the previous session). NEVER trusts
   * this as authoritative — every page that needs the role re-fetches
   * it from public.profiles.
   */
  getCurrentUser(): User | null {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(USER_STORAGE_KEY);
      if (stored) {
        try {
          return JSON.parse(stored) as User;
        } catch {
          // corrupted cache; fall through
        }
      }
    }
    return null;
  },

  setCurrentUser(user: User): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    }
  },

  clearCurrentUser(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  },

  /**
   * Sign in via Supabase Auth. The user's role is then resolved from
   * public.profiles.role (DB-authoritative). If no profile row exists,
   * the role defaults to STUDENT.
   *
   * Returns the user object on success or { error } on failure.
   * NEVER throws. NEVER falls through to a mock persona.
   */
  async login(email: string, password: string): Promise<{ user: User | null; error: string | null }> {
    if (!isSupabaseConfigured()) {
      return {
        user: null,
        error: 'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment to sign in.',
      };
    }
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { user: null, error: 'Supabase client unavailable.' };
    }
    let data: { user: { id: string; email?: string } | null; session: unknown } | null = null;
    let error: { message: string } | null = null;
    try {
      const res = await supabase.auth.signInWithPassword({ email, password });
      data = res.data as any;
      error = res.error as any;
    } catch (e: any) {
      return { user: null, error: e?.message ?? 'Supabase authentication failed' };
    }
    if (error || !data?.user) {
      return { user: null, error: error?.message ?? 'Invalid credentials' };
    }
    // Fetch the authoritative role from public.profiles (DB).
    const profile = await this.fetchProfile(data.user.id, data.user.email ?? email);
    this.setCurrentUser(profile);
    return { user: profile, error: null };
  },

  async signUp(email: string, password: string, fullName: string): Promise<{ user: User | null; error: string | null }> {
    if (!isSupabaseConfigured()) {
      return { user: null, error: 'Supabase is not configured.' };
    }
    const supabase = getSupabaseClient();
    if (!supabase) return { user: null, error: 'Supabase client unavailable.' };
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error || !data.user) return { user: null, error: error?.message ?? 'Sign-up failed' };
      // The DB auth trigger (0006_auth_trigger.sql) creates a public.profiles
      // row with role='STUDENT' by default. Read it back to be sure.
      const profile = await this.fetchProfile(data.user.id, data.user.email ?? email);
      this.setCurrentUser(profile);
      return { user: profile, error: null };
    } catch (e: any) {
      return { user: null, error: e?.message ?? 'Sign-up failed' };
    }
  },

  async logout(): Promise<void> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch {
        // best effort
      }
    }
    this.clearCurrentUser();
  },

  /**
   * Read public.profiles.role for the given auth user id. NEVER falls
   * back to user_metadata.role (which is attacker-editable). If the
   * profile row is missing, defaults to STUDENT.
   */
  async fetchProfile(userId: string, email: string): Promise<User> {
    const supabase = getSupabaseClient();
    let role: UserRole = 'STUDENT';
    let fullName = email.split('@')[0] || 'User';
    let collegeId: string | undefined;
    let departmentId: string | undefined;
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, role, full_name, college_id, department_id')
          .eq('id', userId)
          .maybeSingle();
        if (!error && data) {
          role = ((data as any).role as UserRole) ?? 'STUDENT';
          fullName = (data as any).full_name ?? fullName;
          collegeId = (data as any).college_id ?? undefined;
          departmentId = (data as any).department_id ?? undefined;
        }
      } catch {
        // ignore; fall back to defaults
      }
    }
    return {
      id: userId,
      name: fullName,
      email,
      role,
      department: departmentId,
      collegeId,
    };
  },

  /**
   * Re-resolve the current user's role from the DB. Call this on
   * every sensitive action (e.g. entering /admin/*) to defeat any
   * stale local cache.
   */
  async refreshCurrentUser(): Promise<User | null> {
    if (!isSupabaseConfigured()) return null;
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    try {
      const { data } = await supabase.auth.getUser();
      const u = data?.user;
      if (!u) return null;
      const profile = await this.fetchProfile(u.id, u.email ?? '');
      this.setCurrentUser(profile);
      return profile;
    } catch {
      return null;
    }
  },
};
