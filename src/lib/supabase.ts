import { createClient, SupabaseClient } from '@supabase/supabase-js';

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
  if (typeof window !== 'undefined') {
    const forced = localStorage.getItem('campuspulse_force_mock');
    if (forced !== null) {
      return forced === 'true';
    }
  }
  const envMock = process.env.NEXT_PUBLIC_USE_MOCK_DATA;
  if (envMock !== undefined) {
    return envMock === 'true';
  }
  return !isSupabaseConfigured();
};

export const setMockMode = (enabled: boolean) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('campuspulse_force_mock', enabled ? 'true' : 'false');
    window.location.reload();
  }
};

let clientInstance: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient | null => {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!clientInstance) {
    clientInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return clientInstance;
};
