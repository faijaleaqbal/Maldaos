import { SupabaseClient } from '@supabase/supabase-js';
import { mapDbError } from '../lib/errors.js';

export interface Profile {
  id: string;
  college_id: string;
  department_id: string | null;
  role: 'STUDENT' | 'STAFF' | 'DEPARTMENT_ADMIN' | 'SUPER_ADMIN';
  full_name: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Sign up a new user (email+password). Profile row is auto-created by the
 *  on_auth_user_created trigger with role STUDENT. */
export async function signUp(client: SupabaseClient, email: string, password: string, fullName: string) {
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) throw mapDbError(error);
  return data;
}

export async function signIn(email: string, password: string) {
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_ANON_KEY!;
  const c = createClient(url, key);
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw mapDbError(error);
  return data;
}

export async function getMyProfile(client: SupabaseClient): Promise<Profile | null> {
  const { data, error } = await client.from('profiles').select('*').single();
  if (error) throw mapDbError(error);
  return data as Profile;
}

/** Update own profile (full_name, phone only — role/dept are protected). */
export async function updateMyProfile(client: SupabaseClient, patch: { full_name?: string; phone?: string }) {
  const clean: Record<string, string> = {};
  if (patch.full_name !== undefined) clean.full_name = patch.full_name;
  if (patch.phone !== undefined) clean.phone = patch.phone;
  const { data, error } = await client.from('profiles').update(clean).eq('id', (await client.auth.getUser()).data.user!.id).select().single();
  if (error) throw mapDbError(error);
  return data as Profile;
}

/** List departments visible to the current user (same college). */
export async function listDepartments(client: SupabaseClient) {
  const { data, error } = await client.from('departments').select('id, name, code');
  if (error) throw mapDbError(error);
  return data;
}

/** List locations visible to the current user (same college). */
export async function listLocations(client: SupabaseClient) {
  const { data, error } = await client.from('locations').select('id, name, code');
  if (error) throw mapDbError(error);
  return data;
}
