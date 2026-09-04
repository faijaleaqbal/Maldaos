import { UserRole } from '@/types';

/**
 * DEV/TEST ONLY — seeded demo accounts for the LOCAL Supabase stack
 * (campus-pulse-backend/scripts/seed.ts). These credentials must NEVER ship
 * in the production client bundle or be usable in production:
 *
 * 1. The credential literals live ONLY inside the `IS_DEV` branch below.
 *    `process.env.NODE_ENV` is statically replaced by the Next.js bundler
 *    ('production' in prod builds), so in production builds this branch is
 *    dead code and the literals are eliminated from the bundle (verified by
 *    a build-time grep in tests/guards + CI).
 * 2. Runtime guard: every accessor asserts dev-only and throws in production
 *    even if the module were somehow reachable.
 */

// Bundler-static flag (NOT a runtime check): Next replaces NODE_ENV at build.
const IS_DEV = process.env.NODE_ENV !== 'production';

const DEV_ACCOUNTS: Record<UserRole, { email: string; pass: string; label: string }> = IS_DEV
  ? {
      STUDENT: { email: 'student1@campus.test', pass: 'TestPass123!', label: 'Aarav Student (CSE)' },
      STAFF: { email: 'staff.cse@campus.test', pass: 'TestPass123!', label: 'Ravi Staff (CSE Maintenance)' },
      DEPARTMENT_ADMIN: { email: 'admin.cse@campus.test', pass: 'TestPass123!', label: 'Dr. Sen (Dept Admin CSE)' },
      SUPER_ADMIN: { email: 'super@campus.test', pass: 'TestPass123!', label: 'Principal Super (Executive Admin)' },
    }
  : ({} as Record<UserRole, { email: string; pass: string; label: string }>);

export interface SeedAccount {
  email: string;
  pass: string;
  label: string;
}

function assertDevOnly(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SEED_ACCOUNTS are development/test only and are disabled in production.');
  }
}

/** Dev-only credential table. Empty in production (literals eliminated at build). */
export function getSeedAccounts(): Record<UserRole, SeedAccount> {
  assertDevOnly();
  return DEV_ACCOUNTS;
}

/** Dev-only single lookup. Throws in production. */
export function getSeedAccount(role: UserRole): SeedAccount {
  assertDevOnly();
  const account = DEV_ACCOUNTS[role];
  if (!account) {
    throw new Error(`No seeded account exists for role ${role} on the local stack.`);
  }
  return account;
}

/** Safe in every mode: tells the UI whether quick-persona buttons may render. */
export function isDevSeedLoginAvailable(): boolean {
  return IS_DEV;
}
