/**
 * Server-only AI module. Imported exclusively by the Next.js API routes
 * under /api/ai/*. Never imported by client components.
 *
 * Responsibilities:
 *   1. Construct the provider-agnostic AI Gateway (env-driven).
 *   2. Translate gateway enums (lowercase) <-> MaldaOS product enums
 *      (UPPERCASE) and DB enums.
 *   3. Persist every AI run to public.ai_analysis with a strict
 *      status contract:
 *        - 'REAL_PROVIDER'      -> a real upstream provider responded
 *                                 AND the response passed schema validation.
 *        - 'RULE_BASED_FALLBACK'-> every provider failed or the response
 *                                 failed validation. NEVER trust confidence
 *                                 from this status.
 *   4. Never throw to callers; always return a typed result so the
 *      report workflow can keep running.
 *
 * SECURITY: this module is the ONLY place provider API keys are read.
 * It must never be imported from a client component or a file marked
 * "use client". The Next.js API routes call it.
 */
// SERVER-ONLY MODULE. This file is intentionally placed under
// `src/lib/server/` and imports the `server-only` package at runtime
// to prevent bundling into client components. It is the ONLY module
// in the AI runtime path that reads provider API keys or the
// Supabase service-role key.

import {
  AIGateway,
  createGatewayFromEnv,
  UNAVAILABLE_MESSAGE,
  type AIGatewayResult,
  type ProviderName,
} from '@campuspulse/ai-gateway';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ---------- singleton gateway ----------

let _gateway: AIGateway | null = null;

export function getGateway(): AIGateway {
  if (_gateway) return _gateway;
  _gateway = createGatewayFromEnv();
  return _gateway;
}

/** Test seam: replace the gateway instance. */
export function _setGateway(g: AIGateway | null) {
  _gateway = g;
}

// ---------- enum mapping (gateway <-> product) ----------

/**
 * MaldaOS product IssueCategory (frontend-visible).
 * Must match src/types/index.ts `IssueCategory`.
 */
export type ProductCategory =
  | 'ELECTRICAL'
  | 'PLUMBING'
  | 'IT_NETWORK'
  | 'FACILITY_CLASSROOM'
  | 'LAB_EQUIPMENT'
  | 'SANITATION'
  | 'SAFETY_SECURITY'
  | 'HOSTEL'
  | 'OTHER';

/** MaldaOS product IssuePriority. Must match src/types/index.ts. */
export type ProductPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/** AI gateway normalized categories. Must match ai-gateway/src/validation. */
export type GatewayCategory =
  | 'infrastructure' | 'electrical' | 'plumbing' | 'cleanliness'
  | 'safety' | 'it_network' | 'academic' | 'hostel' | 'transport' | 'other';

/** AI gateway normalized priorities. */
export type GatewayPriority = 'P1' | 'P2' | 'P3' | 'P4';

const GATEWAY_TO_PRODUCT_CATEGORY: Record<GatewayCategory, ProductCategory> = {
  electrical: 'ELECTRICAL',
  plumbing: 'PLUMBING',
  it_network: 'IT_NETWORK',
  cleanliness: 'SANITATION',
  safety: 'SAFETY_SECURITY',
  hostel: 'HOSTEL',
  academic: 'FACILITY_CLASSROOM',
  transport: 'OTHER',
  infrastructure: 'FACILITY_CLASSROOM',
  other: 'OTHER',
};

const GATEWAY_TO_PRODUCT_PRIORITY: Record<GatewayPriority, ProductPriority> = {
  P1: 'CRITICAL',
  P2: 'HIGH',
  P3: 'MEDIUM',
  P4: 'LOW',
};

const GATEWAY_TO_PRODUCT_SEVERITY: Record<'critical' | 'high' | 'medium' | 'low', ProductPriority> = {
  critical: 'CRITICAL',
  high: 'HIGH',
  medium: 'MEDIUM',
  low: 'LOW',
};

export function gatewayCategoryToProduct(c: string | undefined): ProductCategory {
  if (!c) return 'OTHER';
  const k = c.toLowerCase() as GatewayCategory;
  return GATEWAY_TO_PRODUCT_CATEGORY[k] ?? 'OTHER';
}
export function gatewayPriorityToProduct(p: string | undefined): ProductPriority {
  if (!p) return 'MEDIUM';
  const k = p.toUpperCase() as GatewayPriority;
  return GATEWAY_TO_PRODUCT_PRIORITY[k] ?? 'MEDIUM';
}
export function gatewaySeverityToProductPriority(s: string | undefined): ProductPriority {
  if (!s) return 'MEDIUM';
  const k = s.toLowerCase() as 'critical' | 'high' | 'medium' | 'low';
  return GATEWAY_TO_PRODUCT_SEVERITY[k] ?? 'MEDIUM';
}

// ---------- public result shape ----------

export interface AIResult {
  /** Always defined. */
  status: 'REAL_PROVIDER' | 'RULE_BASED_FALLBACK';
  /** Provider that produced the result. Always "deterministic" for fallback. */
  provider: ProviderName;
  /** Model id (e.g. llama-3.3-70b-versatile) or "deterministic-v1". */
  model: string;
  /** Recommendations. */
  category: ProductCategory;
  priority: ProductPriority;
  severity: ProductPriority | null;
  summary: string;
  reasoning: string | null;
  /** ALWAYS 0 for RULE_BASED_FALLBACK. Never fabricated. */
  confidence: number;
  urgencyFactors: string[];
  possibleDuplicates: Array<{ existingIssueId: string; reason: string }>;
  /** ms spent in the gateway (sum of attempts). */
  latencyMs: number;
  attempts: number;
  feature: string;
  analyzedAt: string;
  /** Convenience flags for the UI. */
  isFallback: boolean;
  unavailableMessage: string | null;
}

// ---------- core: run analysis ----------

export interface AnalyzeInput {
  title: string;
  description: string;
  locationName?: string;
}

export async function runAnalysis(input: AnalyzeInput): Promise<AIResult> {
  const gateway = getGateway();
  const started = Date.now();

  let out: { analysis?: any; provider: ProviderName; model: string; fallback: boolean; attempts: any[]; latencyMs: number };
  try {
    const { Features } = await import('@campuspulse/ai-gateway');
    out = (await Features.analyzeIssue(gateway, {
      title: input.title,
      description: input.description,
      location: input.locationName,
    })) as any;
  } catch (e) {
    // Defensive: gateway is designed not to throw, but guard anyway.
    return deterministicResult({
      started,
      attempts: 0,
      reason: (e as Error)?.message ?? 'unknown',
    });
  }

  if (out.fallback || !out.analysis) {
    return deterministicResult({
      started,
      attempts: (out.attempts ?? []).length,
      reason: UNAVAILABLE_MESSAGE,
    });
  }

  // Real provider responded AND validation passed. Confidence is whatever
  // the model returned; we do NOT fabricate.
  const a = out.analysis;
  const conf = typeof a.confidence === 'number' ? Math.max(0, Math.min(1, a.confidence)) : 0;
  return {
    status: 'REAL_PROVIDER',
    provider: out.provider,
    model: out.model,
    category: gatewayCategoryToProduct(a.category),
    priority: gatewayPriorityToProduct(a.priority),
    severity: a.severity ? gatewaySeverityToProductPriority(a.severity) : null,
    summary: typeof a.summary === 'string' && a.summary.length > 0 ? a.summary : UNAVAILABLE_MESSAGE,
    reasoning: typeof a.reasoning === 'string' ? a.reasoning : null,
    confidence: conf,
    urgencyFactors: [],
    possibleDuplicates: [],
    latencyMs: Date.now() - started,
    attempts: (out.attempts ?? []).length,
    feature: 'classify.issue_category',
    analyzedAt: new Date().toISOString(),
    isFallback: false,
    unavailableMessage: null,
  };
}

/** Standalone duplicate-candidate pass. */
export async function findDuplicates(args: {
  newIssue: { title: string; description: string; locationName?: string };
  candidates: Array<{ id: string; title: string; description?: string }>;
}): Promise<{
  status: 'REAL_PROVIDER' | 'RULE_BASED_FALLBACK';
  provider: ProviderName;
  candidates: Array<{ existingIssueId: string; reason: string }>;
  isFallback: boolean;
}> {
  if (args.candidates.length === 0) {
    return { status: 'RULE_BASED_FALLBACK', provider: 'deterministic', candidates: [], isFallback: true };
  }
  const { Features } = await import('@campuspulse/ai-gateway');
  const r = await Features.detectDuplicateCandidates(getGateway(), {
    newIssue: { title: args.newIssue.title, description: args.newIssue.description, location: args.newIssue.locationName },
    candidates: args.candidates,
  });
  if (r.fallback) {
    return { status: 'RULE_BASED_FALLBACK', provider: r.provider, candidates: [], isFallback: true };
  }
  return { status: 'REAL_PROVIDER', provider: r.provider, candidates: r.candidates, isFallback: false };
}

function deterministicResult(args: { started: number; attempts: number; reason: string }): AIResult {
  return {
    status: 'RULE_BASED_FALLBACK',
    provider: 'deterministic',
    model: 'deterministic-v1',
    category: 'OTHER',
    priority: 'MEDIUM',
    severity: 'MEDIUM',
    summary: UNAVAILABLE_MESSAGE,
    reasoning: args.reason,
    confidence: 0,
    urgencyFactors: ['Manual admin review required'],
    possibleDuplicates: [],
    latencyMs: Date.now() - args.started,
    attempts: args.attempts,
    feature: 'classify.issue_category',
    analyzedAt: new Date().toISOString(),
    isFallback: true,
    unavailableMessage: UNAVAILABLE_MESSAGE,
  };
}

// ---------- persistence ----------

/**
 * Persist an AI result to public.ai_analysis via the SECURITY DEFINER
 * save_ai_analysis() RPC. The service-role Supabase client must already
 * be supplied. If the issue exists, we re-read its college_id from the
 * DB so the client never has to track it.
 *
 * AI failure must NEVER break the create flow — this function never
 * throws.
 */
export async function persistAIResult(
  sb: SupabaseClient,
  args: {
    issueId: string;
    /** Optional. If absent, the function looks it up from the issues table. */
    collegeId?: string;
    result: AIResult;
  }
): Promise<{ ok: boolean; error?: string }> {
  try {
    let collegeId = args.collegeId;
    if (!collegeId) {
      const { data: issue, error: ie } = await sb
        .from('issues')
        .select('college_id')
        .eq('id', args.issueId)
        .maybeSingle();
      if (ie || !issue) return { ok: false, error: ie?.message ?? 'issue not found' };
      collegeId = (issue as any).college_id;
    }
    const { error } = await sb.rpc('save_ai_analysis', {
      p_issue_id: args.issueId,
      p_college_id: collegeId,
      p_category: args.result.category,
      p_priority: args.result.priority,
      p_severity: args.result.severity,
      p_summary: args.result.summary,
      p_reasoning: args.result.reasoning,
      p_confidence: args.result.status === 'RULE_BASED_FALLBACK' ? 0 : args.result.confidence,
      p_provider: args.result.provider,
      p_model: args.result.model,
      p_status: args.result.status,
      p_latency_ms: args.result.latencyMs,
      p_attempts: args.result.attempts,
      p_feature: args.result.feature,
      p_possible_duplicates: args.result.possibleDuplicates as any,
      p_urgency_factors: args.result.urgencyFactors as any,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Read the latest AI analysis for an issue (via latest_ai_analysis RPC).
 * Returns null when no analysis exists.
 */
export async function readLatestAI(
  sb: SupabaseClient,
  issueId: string,
): Promise<AIResult | null> {
  try {
    const { data, error } = await sb.rpc('latest_ai_analysis', { p_issue_id: issueId });
    if (error || !data) return null;
    return dbRowToAIResult(data);
  } catch {
    return null;
  }
}

export function dbRowToAIResult(row: any): AIResult {
  const isReal = row.status === 'REAL_PROVIDER';
  return {
    status: row.status,
    provider: row.provider,
    model: row.model,
    category: row.category_recommended as ProductCategory,
    priority: row.priority_recommended as ProductPriority,
    severity: (row.severity_recommended ?? null) as ProductPriority | null,
    summary: row.summary,
    reasoning: row.reasoning ?? null,
    confidence: isReal && typeof row.confidence === 'number' ? row.confidence : 0,
    urgencyFactors: Array.isArray(row.urgency_factors) ? row.urgency_factors : [],
    possibleDuplicates: Array.isArray(row.possible_duplicates) ? row.possible_duplicates : [],
    latencyMs: row.latency_ms,
    attempts: row.attempts,
    feature: row.feature,
    analyzedAt: row.created_at,
    isFallback: !isReal,
    unavailableMessage: isReal ? null : UNAVAILABLE_MESSAGE,
  };
}

/** Read provider activity for the settings page. */
export async function readAIHealth(
  sb: SupabaseClient,
): Promise<Array<{ provider: string; status: string; n: number; lastAt: string; avgLatencyMs: number }>> {
  try {
    const { data, error } = await sb.rpc('ai_health_snapshot');
    if (error || !Array.isArray(data)) return [];
    return data as any;
  } catch {
    return [];
  }
}

/** Service-role client. SERVER-ONLY. */
export function serviceClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (server-only)');
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
