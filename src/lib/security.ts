import type { User, UserRole } from '@/types';

/** Roles that unlock the operations console. DB `profiles.role` is the source. */
export const PRIVILEGED_ROLES: readonly UserRole[] = [
  'STAFF',
  'DEPARTMENT_ADMIN',
  'SUPER_ADMIN',
];

export const UNAUTHENTICATED_USER: User = {
  id: '',
  name: 'Guest',
  email: '',
  role: 'STUDENT',
};

export function isPrivilegedRole(role: string | null | undefined): boolean {
  return role === 'STAFF' || role === 'DEPARTMENT_ADMIN' || role === 'SUPER_ADMIN';
}

export function isAdminPath(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

/**
 * Mock mode is an explicit local-demo flag. It is NEVER enabled in production
 * builds, NEVER enabled by a missing Supabase config (no silent fallback),
 * and NEVER enabled by a client localStorage override alone.
 */
export function resolveMockMode(opts: {
  nodeEnv?: string;
  envFlag?: string;
  localStorageForce?: string | null;
}): boolean {
  if (opts.nodeEnv === 'production') return false;
  if (opts.envFlag !== 'true') return false;
  if (opts.localStorageForce === 'false') return false;
  return true;
}

export function isProductionEnv(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function isMockModeEnabledOnServer(): boolean {
  return resolveMockMode({
    nodeEnv: process.env.NODE_ENV,
    envFlag: process.env.NEXT_PUBLIC_USE_MOCK_DATA,
    localStorageForce: null,
  });
}

/** Mock login/register always land as STUDENT — never a privileged persona. */
export function clampMockAuthRole(_requested?: UserRole | null): UserRole {
  return 'STUDENT';
}
