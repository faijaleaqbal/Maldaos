import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * True when the public Supabase env is configured.
 * The check is deliberately strict (URL must start with http, anon
 * key must be at least 20 chars) so that a half-configured environment
 * does not silently fall through to local mock data.
 */
export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith('http') &&
    supabaseAnonKey.length > 20
  );
};

/**
 * Returns true when the application should run in development mock
 * mode. Mock mode is OFF by default. It is only enabled when the
 * operator has explicitly opted in via the NEXT_PUBLIC_USE_MOCK_DATA
 * environment variable.
 *
 * If the operator has not opted in:
 *   - The runtime FAILS CLOSED. There is no silent fallback to mock
 *     data when Supabase is unconfigured (the previous behaviour the
 *     Jan 2027 audit flagged as a critical blocker).
 *   - The UI shows a clear "Configuration required" message.
 *   - All write paths in the codebase check this flag and either
 *     bail out with an error or short-circuit to the no-op path.
 *
 * The localStorage override (`campuspulse_force_mock`) is also removed:
 * the previous build allowed any browser to force the app into mock
 * mode, which silently served fabricated data.
 */
export const isMockModeEnabled = (): boolean => {
  // No localStorage override. The previous override was a critical
  // security/quality regression (any visitor could force the app
  // into mock mode, which silently served fabricated data even when
  // Supabase was configured).
  if (process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true') return true;
  return false;
};

export const setMockMode = (_enabled: boolean) => {
  // No-op. The previous implementation called window.location.reload()
  // and persisted a localStorage flag. Both are removed: changing the
  // mock-mode state now requires a deploy, not a client toggle.
};

let clientInstance: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient | null => {
  if (!isSupabaseConfigured()) return null;
  if (!clientInstance) {
    clientInstance = createClient(supabaseUrl, supabaseAnonKey);
  }
  return clientInstance;
};
