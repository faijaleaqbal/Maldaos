/**
 * Production guard tests — mock mode must NEVER activate in production,
 * even with hostile client-side overrides.
 */
import { describe, it, expect } from 'vitest';
import { resolveMockMode, isPrivilegedRole, clampMockAuthRole } from '@/lib/security';
import { isMockModeEnabled } from '@/lib/supabase';
import { AIService } from '@/services/ai.service';
import { getSeedAccount, isDevSeedLoginAvailable } from '@/services/devSeedAccounts';

describe('production environment guard (fail-closed)', () => {
  it('NODE_ENV=production NEVER allows mock mode', () => {
    expect(
      resolveMockMode({ nodeEnv: 'production', envFlag: 'true', localStorageForce: 'true' })
    ).toBe(false);
  });

  it('mock requires explicit env opt-in (no silent fallback on missing config)', () => {
    expect(resolveMockMode({ nodeEnv: 'development', envFlag: undefined, localStorageForce: null })).toBe(false);
    expect(resolveMockMode({ nodeEnv: 'development', envFlag: 'false', localStorageForce: null })).toBe(false);
    expect(resolveMockMode({ nodeEnv: 'development', envFlag: 'true', localStorageForce: null })).toBe(true);
  });

  it('localStorage force cannot ENABLE mock when env flag is off', () => {
    expect(resolveMockMode({ nodeEnv: 'development', envFlag: 'false', localStorageForce: 'true' })).toBe(false);
  });

  it('client isMockModeEnabled never returns true in production (window-stubbed)', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalFlag = process.env.NEXT_PUBLIC_USE_MOCK_DATA;
    (process.env as Record<string, string>).NODE_ENV = 'production';
    (process.env as Record<string, string | undefined>).NEXT_PUBLIC_USE_MOCK_DATA = 'true';
    try {
      expect(isMockModeEnabled()).toBe(false);
    } finally {
      (process.env as Record<string, string>).NODE_ENV = originalEnv;
      (process.env as Record<string, string | undefined>).NEXT_PUBLIC_USE_MOCK_DATA = originalFlag;
    }
  });

  it('role gates: only DB-privileged roles pass; mock auth always clamps to STUDENT', () => {
    expect(isPrivilegedRole('SUPER_ADMIN')).toBe(true);
    expect(isPrivilegedRole('DEPARTMENT_ADMIN')).toBe(true);
    expect(isPrivilegedRole('STAFF')).toBe(true);
    expect(isPrivilegedRole('STUDENT')).toBe(false);
    expect(isPrivilegedRole(null)).toBe(false);
    expect(clampMockAuthRole('SUPER_ADMIN')).toBe('STUDENT');
  });
});

describe('seed credentials are dev/test only', () => {
  // NOTE: bundler-static elimination of the literals in production builds is
  // verified by the build + grep gate (CI). Here we prove the RUNTIME guard:
  // the accessor refuses to serve seed credentials once NODE_ENV is 'production'
  // at call time, and the static flag prevents UI affordances in prod builds.
  it('runtime guard throws when NODE_ENV is production at call time', () => {
    const original = process.env.NODE_ENV;
    (process.env as Record<string, string>).NODE_ENV = 'production';
    try {
      expect(() => getSeedAccount('SUPER_ADMIN')).toThrow(/development\/test only/);
    } finally {
      (process.env as Record<string, string>).NODE_ENV = original;
    }
  });

  it('dev seed accessor works outside production (local dev convenience preserved)', () => {
    const account = getSeedAccount('STUDENT');
    expect(account.email).toContain('@campus.test');
    // vitest runs with NODE_ENV='test' (not production) → dev affordance on
    expect(isDevSeedLoginAvailable()).toBe(true);
  });
});

describe('AI integrity: deterministic heuristic is labelled fallback', () => {
  it('generateDeterministicTriage never claims to be real AI', () => {
    const result = AIService.generateDeterministicTriage(
      'Fire spark near main gate electrical panel',
      'Sparks and smoke visible from the breaker panel, immediate danger.',
      'Main Block'
    );

    // Must be labelled fallback — never presented as real AI output
    expect(result.isFallback).toBe(true);
    // No fabricated confidence — heuristic carries zero confidence claim
    expect(result.confidence).toBe(0);
    // Provider string must clearly distinguish from real providers
    expect(result.gatewayProvider).toMatch(/heuristic/i);
    expect(result.gatewayProvider).not.toMatch(/^groq$|^nvidia$|^openrouter$|^google$|^deterministic$/);
    // Triage value itself is preserved (category detection still functions)
    expect(result.detectedCategory).toBe('SAFETY');
    expect(result.suggestedPriority).toBe('URGENT');
  });

  it('getFallbackAnalysis is also honest (isFallback, zero confidence)', () => {
    const result = AIService.getFallbackAnalysis();
    expect(result.isFallback).toBe(true);
    expect(result.confidence).toBe(0);
  });
});
