import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BackendError } from '@/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith('http') &&
    supabaseAnonKey.length > 20
  );
};

export const isMockModeEnabled = (): boolean => {
  // FAIL-CLOSED: production builds can NEVER run in mock mode, regardless of
  // env flags or client-side localStorage overrides.
  if (process.env.NODE_ENV === 'production') {
    return false;
  }
  if (typeof window !== 'undefined') {
    const forced = localStorage.getItem('campuspulse_force_mock');
    if (forced !== null) {
      return forced === 'true';
    }
  }
  // Mock mode requires explicit opt-in via NEXT_PUBLIC_USE_MOCK_DATA === 'true'.
  // Production/live mode must NEVER silently activate mock mode because Supabase is unconfigured.
  return process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';
};

export const setMockMode = (enabled: boolean) => {
  if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
    localStorage.setItem('campuspulse_force_mock', enabled ? 'true' : 'false');
    window.location.reload();
  }
};

let clientInstance: SupabaseClient | null = null;

/**
 * Browser Supabase client wired through @supabase/ssr so the auth session is
 * persisted in COOKIES (document.cookie), not localStorage. The server-side
 * middleware client (src/middleware.ts) reads the same cookies — this is the
 * session sync between browser auth and the /admin gate. F-1.
 */
export const getSupabaseClient = (): SupabaseClient | null => {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!clientInstance) {
    clientInstance = createBrowserClient(supabaseUrl, supabaseAnonKey);
  }
  return clientInstance;
};

/** Live mode = NOT mock mode. Services branch on this; never silently blend. */
export const isLiveMode = (): boolean => !isMockModeEnabled();

/**
 * Require a configured Supabase client in live mode or throw a typed error.
 * Live mode must NEVER silently fall back to mock data — callers surface this
 * as a UI ErrorState instead.
 */
export const requireSupabaseClient = (): SupabaseClient => {
  const client = getSupabaseClient();
  if (!client) {
    throw createBackendError(
      'BACKEND_NOT_CONFIGURED',
      'Live mode is enabled but Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY). Set NEXT_PUBLIC_USE_MOCK_DATA=true for the offline demo or provide valid keys.'
    );
  }
  return client;
};

/**
 * Build a typed BackendError from a Supabase/PostgREST error (or anything
 * thrown). Backend RPCs raise `CODE: message` — the code prefix is stable and
 * is what the UI branches on.
 */
export function createBackendError(
  code: string,
  message: string,
  details?: unknown
): BackendError {
  const err = new Error(message) as BackendError;
  err.code = code;
  err.details = details;
  err.name = 'BackendError';
  return err;
}

/**
 * Normalize any error value into a typed BackendError. Extracts the stable
 * `CODE:` prefix from Postgres raise_exception messages when present.
 */
export function toBackendError(err: unknown, fallbackCode = 'UNKNOWN'): BackendError {
  if (err instanceof Error && (err as BackendError).code) {
    return err as BackendError;
  }
  const raw: { message?: string; code?: string; details?: string; hint?: string } =
    typeof err === 'object' && err !== null
      ? (err as Record<string, unknown>) as any
      : { message: String(err) };
  const message = raw.message || String(err);
  const match = message.match(/^([A-Z][A-Z0-9_]+):\s*(.*)$/);
  if (match) {
    return createBackendError(match[1], match[2], raw.details);
  }
  return createBackendError(raw.code || fallbackCode, message, raw.details);
}
