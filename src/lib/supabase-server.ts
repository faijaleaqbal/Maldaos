import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { UserRole } from '@/types';
import { isSupabaseConfigured } from '@/lib/supabase';

export interface AuthoritativeProfile {
  id: string;
  role: UserRole;
  full_name: string;
}

/**
 * Server-only Supabase client bound to the request cookies (anon key).
 * Never uses the service-role key.
 */
export function createServerSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const cookieStore = cookies();

  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot always set cookies; middleware refreshes.
        }
      },
    },
  });
}

/**
 * Load the signed-in user's role from `profiles` (DB). Returns null when
 * there is no session or no profile. Never consults user_metadata.
 */
export async function getAuthoritativeProfile(): Promise<AuthoritativeProfile | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return null;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile) return null;

  return {
    id: profile.id as string,
    role: profile.role as UserRole,
    full_name: (profile.full_name as string) || user.email || 'User',
  };
}
