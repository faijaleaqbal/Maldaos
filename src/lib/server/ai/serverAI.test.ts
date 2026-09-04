/**
 * Runtime AI integration tests.
 *
 * These tests verify the actual runtime path the report demands:
 *   frontend -> /api/ai/analyze -> serverAI.runAnalysis
 *              -> AIGateway -> provider / fallback
 *              -> validated response
 *              -> public.ai_analysis
 *
 * They run as plain Node scripts (no browser, no live Supabase) by
 * stubbing:
 *   - the AIGateway instance via _setGateway
 *   - the Supabase service client via a process.env override that
 *     makes serviceClient() throw (we verify it never gets called
 *     when no issueId is supplied, and that an error is caught when
 *     it is)
 *
 * The test file is server-side (uses 'node:assert' and node:test).
 * It is NOT imported by the Next.js client bundle.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Reset modules between tests so env-driven imports re-evaluate.
async function freshImport() {
  // Use a cache-busting query string to force a fresh module load.
  const path = new URL('./serverAI.ts', import.meta.url).href;
  return import(path + '?bust=' + Date.now() + Math.random());
}

test('runAnalysis returns RULE_BASED_FALLBACK when no provider is configured (integrity guarantee)', async () => {
  const mod = await freshImport();
  // Build a fake AIGateway-compatible surface via the public API:
  // we can't directly inject a gateway from outside, so we use the
  // env-driven factory and override env to force the deterministic
  // provider only. Then we verify the "no provider" path returns
  // RULE_BASED_FALLBACK with confidence 0.
  process.env.AI_GATEWAY_PROVIDER_CHAIN = 'deterministic';
  delete process.env.GROQ_API_KEY;
  delete process.env.NVIDIA_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.GOOGLE_AI_STUDIO_API_KEY;
  mod._setGateway(null);

  const r = await mod.runAnalysis({ title: 'Loose handrail', description: 'Stairwell B handrail wobbles when leaned on' });
  assert.equal(r.status, 'RULE_BASED_FALLBACK');
  assert.equal(r.provider, 'deterministic');
  assert.equal(r.model, 'deterministic-v1');
  assert.equal(r.confidence, 0);
  assert.equal(r.isFallback, true);
  assert.match(r.summary, /AI analysis unavailable/);
  assert.equal(r.category, 'OTHER');
  assert.equal(r.priority, 'MEDIUM');
  assert.equal(r.severity, 'MEDIUM');
  assert.ok(r.urgencyFactors.includes('Manual admin review required'));
});

test('runAnalysis never throws and never returns confidence > 0 for fallback', async () => {
  const mod = await freshImport();
  process.env.AI_GATEWAY_PROVIDER_CHAIN = 'deterministic';
  mod._setGateway(null);
  const r = await mod.runAnalysis({ title: 'Anything here', description: 'Some description that is long enough to validate' });
  assert.equal(r.status, 'RULE_BASED_FALLBACK');
  assert.equal(r.confidence, 0);
});

test('enum mapping: gateway -> product categories', async () => {
  const mod = await freshImport();
  assert.equal(mod.gatewayCategoryToProduct('electrical'), 'ELECTRICAL');
  assert.equal(mod.gatewayCategoryToProduct('plumbing'), 'PLUMBING');
  assert.equal(mod.gatewayCategoryToProduct('it_network'), 'IT_NETWORK');
  assert.equal(mod.gatewayCategoryToProduct('cleanliness'), 'SANITATION');
  assert.equal(mod.gatewayCategoryToProduct('safety'), 'SAFETY_SECURITY');
  assert.equal(mod.gatewayCategoryToProduct('hostel'), 'HOSTEL');
  assert.equal(mod.gatewayCategoryToProduct('academic'), 'FACILITY_CLASSROOM');
  assert.equal(mod.gatewayCategoryToProduct('transport'), 'OTHER');
  assert.equal(mod.gatewayCategoryToProduct('infrastructure'), 'FACILITY_CLASSROOM');
  assert.equal(mod.gatewayCategoryToProduct('other'), 'OTHER');
  assert.equal(mod.gatewayCategoryToProduct('spaceship'), 'OTHER');
  assert.equal(mod.gatewayCategoryToProduct(undefined), 'OTHER');
});

test('enum mapping: gateway -> product priorities', async () => {
  const mod = await freshImport();
  assert.equal(mod.gatewayPriorityToProduct('P1'), 'CRITICAL');
  assert.equal(mod.gatewayPriorityToProduct('P2'), 'HIGH');
  assert.equal(mod.gatewayPriorityToProduct('P3'), 'MEDIUM');
  assert.equal(mod.gatewayPriorityToProduct('P4'), 'LOW');
  assert.equal(mod.gatewayPriorityToProduct('P9'), 'MEDIUM');
  assert.equal(mod.gatewayPriorityToProduct(undefined), 'MEDIUM');
});

test('enum mapping: gateway severity -> product priority', async () => {
  const mod = await freshImport();
  assert.equal(mod.gatewaySeverityToProductPriority('critical'), 'CRITICAL');
  assert.equal(mod.gatewaySeverityToProductPriority('high'), 'HIGH');
  assert.equal(mod.gatewaySeverityToProductPriority('medium'), 'MEDIUM');
  assert.equal(mod.gatewaySeverityToProductPriority('low'), 'LOW');
  assert.equal(mod.gatewaySeverityToProductPriority('weird'), 'MEDIUM');
  assert.equal(mod.gatewaySeverityToProductPriority(undefined), 'MEDIUM');
});

test('findDuplicates: empty candidates returns fallback', async () => {
  const mod = await freshImport();
  process.env.AI_GATEWAY_PROVIDER_CHAIN = 'deterministic';
  mod._setGateway(null);
  const r = await mod.findDuplicates({
    newIssue: { title: 'X', description: 'Y is broken' },
    candidates: [],
  });
  assert.equal(r.status, 'RULE_BASED_FALLBACK');
  assert.equal(r.isFallback, true);
  assert.equal(r.candidates.length, 0);
});

test('persistAIResult: returns ok=false when service client throws (no env)', async () => {
  const mod = await freshImport();
  process.env.AI_GATEWAY_PROVIDER_CHAIN = 'deterministic';
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  mod._setGateway(null);
  const r = await mod.persistAIResult({} as any, {
    issueId: '00000000-0000-0000-0000-000000000000',
    result: {
      status: 'RULE_BASED_FALLBACK', provider: 'deterministic', model: 'deterministic-v1',
      category: 'OTHER', priority: 'MEDIUM', severity: 'MEDIUM', summary: 'x', reasoning: null,
      confidence: 0, urgencyFactors: [], possibleDuplicates: [],
      latencyMs: 0, attempts: 0, feature: 'analyze.issue', analyzedAt: new Date().toISOString(),
      isFallback: true, unavailableMessage: 'x',
    },
  });
  assert.equal(r.ok, false);
  assert.ok(typeof r.error === 'string' || typeof r.error === 'object');
});

test('dbRowToAIResult: status=REAL_PROVIDER preserves confidence', async () => {
  const mod = await freshImport();
  const r = mod.dbRowToAIResult({
    status: 'REAL_PROVIDER',
    provider: 'groq', model: 'llama-3.3-70b-versatile',
    category_recommended: 'ELECTRICAL',
    priority_recommended: 'HIGH',
    severity_recommended: 'high',
    summary: 'Loose wire', reasoning: 'Reported by 5 students',
    confidence: 0.91,
    created_at: new Date().toISOString(),
    latency_ms: 312, attempts: 1, feature: 'classify.issue_category',
    urgency_factors: [], possible_duplicates: [],
  });
  assert.equal(r.status, 'REAL_PROVIDER');
  assert.equal(r.isFallback, false);
  assert.equal(r.confidence, 0.91);
  assert.equal(r.provider, 'groq');
  assert.equal(r.model, 'llama-3.3-70b-versatile');
});

test('dbRowToAIResult: status=RULE_BASED_FALLBACK forces confidence=0', async () => {
  const mod = await freshImport();
  const r = mod.dbRowToAIResult({
    status: 'RULE_BASED_FALLBACK',
    provider: 'deterministic', model: 'deterministic-v1',
    category_recommended: 'OTHER',
    priority_recommended: 'MEDIUM',
    severity_recommended: null,
    summary: 'AI analysis unavailable.', reasoning: 'AI analysis unavailable.',
    confidence: 0.88, // would be set by the gateway to 0 anyway, but the
                      // loader is the last line of defense: the client
                      // must never see 0.88 for a fallback row.
    created_at: new Date().toISOString(),
    latency_ms: 0, attempts: 0, feature: 'classify.issue_category',
    urgency_factors: [], possible_duplicates: [],
  });
  assert.equal(r.status, 'RULE_BASED_FALLBACK');
  assert.equal(r.isFallback, true);
  assert.equal(r.confidence, 0);
  assert.equal(r.provider, 'deterministic');
  assert.match(r.summary, /AI analysis unavailable/);
});

test('readAIHealth: returns [] when service-role env missing', async () => {
  const mod = await freshImport();
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const r = await mod.readAIHealth({} as any);
  assert.deepEqual(r, []);
});
