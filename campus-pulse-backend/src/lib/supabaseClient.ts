import { createClient, SupabaseClient } from '@supabase/supabase-js';

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name} (copy .env.example to .env)`);
  return v;
}

export const SUPABASE_URL = () => env('SUPABASE_URL');
export const ANON_KEY = () => env('SUPABASE_ANON_KEY');
export const SERVICE_KEY = () => env('SUPABASE_SERVICE_ROLE_KEY');

/** Client for a signed-in user's JWT — all RLS policies apply. */
export function userClient(accessToken: string): SupabaseClient {
  return createClient(SUPABASE_URL(), ANON_KEY(), {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

/** Client using the current session's token (convenience wrapper). */
export function sessionClient(token: string): SupabaseClient {
  return userClient(token);
}

/**
 * Service-role client — bypasses RLS. SERVER-SIDE ONLY (scripts, seeding,
 * trusted backend jobs). NEVER import this into browser/client code and
 * never expose the key to the client.
 */
export function serviceClient(): SupabaseClient {
  return createClient(SUPABASE_URL(), SERVICE_KEY(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
