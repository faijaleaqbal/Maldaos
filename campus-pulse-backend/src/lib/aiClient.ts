/**
 * AI Gateway client — single entry point for the rest of the backend.
 *
 * Responsibilities:
 *   1. Construct a singleton AIGateway from env (env-driven, no hardcoded keys).
 *   2. Translate the backend's enum domain (CATEGORIES, PRIORITIES) to/from
 *      the gateway's normalized enums.
 *   3. Normalize gateway results into a stable DB-friendly shape.
 *   4. Never throw to callers: a failure yields a recommendation with
 *      `fallback: true` and `summary: "AI analysis unavailable."`.
 *
 * Security:
 *   - Reads provider keys from process.env only.
 *   - Never logs keys.
 *   - Returns no provider secrets to callers.
 */
import {
  AIGateway,
  createGatewayFromEnv,
  UNAVAILABLE_MESSAGE,
  type AIGatewayResult,
  type ProviderName,
} from '@campuspulse/ai-gateway';
import { CATEGORIES, PRIORITIES, type Category, type Priority } from './validation.js';

let _gateway: AIGateway | null = null;

/** Get (or lazily create) the shared AIGateway instance. */
export function getGateway(): AIGateway {
  if (_gateway) return _gateway;
  _gateway = createGatewayFromEnv();
  return _gateway;
}

/** Test-only: allow injecting a stub gateway. */
export function _setGateway(g: AIGateway | null) {
  _gateway = g;
}

// ---------- enum mapping ----------

/** Backend Category (UPPERCASE) <-> gateway category (lowercase). */
const CATEGORY_TO_GATEWAY: Record<Category, string> = {
  INFRASTRUCTURE: 'infrastructure',
  ACADEMICS: 'academic',
  HOSTEL: 'hostel',
  CLEANLINESS: 'cleanliness',
  SAFETY: 'safety',
  OTHER: 'other',
};
const CATEGORY_FROM_GATEWAY: Record<string, Category> = {
  infrastructure: 'INFRASTRUCTURE',
  academic: 'ACADEMICS',
  hostel: 'HOSTEL',
  cleanliness: 'CLEANLINESS',
  safety: 'SAFETY',
  it_network: 'OTHER',
  electrical: 'INFRASTRUCTURE',
  plumbing: 'INFRASTRUCTURE',
  transport: 'OTHER',
  other: 'OTHER',
};

const PRIORITY_TO_GATEWAY: Record<Priority, string> = {
  LOW: 'P4',
  MEDIUM: 'P3',
  HIGH: 'P2',
  URGENT: 'P1',
};
const PRIORITY_FROM_GATEWAY: Record<string, Priority> = {
  P1: 'URGENT',
  P2: 'HIGH',
  P3: 'MEDIUM',
  P4: 'LOW',
};

const SEVERITY_TO_PRIORITY: Record<string, Priority> = {
  critical: 'URGENT',
  high: 'HIGH',
  medium: 'MEDIUM',
  low: 'LOW',
};

export function toGatewayCategory(c: Category): string {
  return CATEGORY_TO_GATEWAY[c] ?? 'other';
}
export function fromGatewayCategory(c: string | undefined): Category {
  const v = (c ?? 'other').toLowerCase();
  return CATEGORY_FROM_GATEWAY[v] ?? 'OTHER';
}
export function toGatewayPriority(p: Priority): string {
  return PRIORITY_TO_GATEWAY[p] ?? 'P3';
}
export function fromGatewayPriority(p: string | undefined): Priority {
  const v = (p ?? 'P3').toUpperCase();
  return PRIORITY_FROM_GATEWAY[v] ?? 'MEDIUM';
}
export function severityToPriority(s: string | undefined): Priority {
  const v = (s ?? 'medium').toLowerCase();
  return SEVERITY_TO_PRIORITY[v] ?? 'MEDIUM';
}

// ---------- normalized result types ----------

/** What we persist with an issue. */
export interface PersistedAIAnalysis {
  category: Category;
  priority: Priority;
  severity: string | null;
  summary: string;
  confidence: number | null;
  reasoning: string | null;
  provider: ProviderName;
  model: string;
  status: 'ok' | 'fallback';
  latency_ms: number;
  attempts: number;
  feature: string;
  created_at: string;
}

/** Allowed analysis categories exposed by the gateway (for documentation/tests). */
export const AI_CATEGORIES: readonly string[] = [
  'infrastructure', 'electrical', 'plumbing', 'cleanliness',
  'safety', 'it_network', 'academic', 'hostel', 'transport', 'other',
];
export { CATEGORIES, PRIORITIES };

// ---------- core: run analysis ----------

export interface AnalyzeInput {
  title: string;
  description: string;
  /** Existing category picked by the user (optional; AI may refine). */
  category?: Category;
  /** Existing location name, if any. */
  locationName?: string;
}

/**
 * Run the full AI analysis pipeline and return a DB-friendly record.
 *
 * Behaviour:
 *   - Always returns a PersistedAIAnalysis.
 *   - On AI failure (any reason), category falls back to input.category or
 *     "OTHER", priority to "MEDIUM", summary to UNAVAILABLE_MESSAGE,
 *     status to "fallback", confidence to null, provider to "deterministic".
 *   - Never throws to the caller.
 */
export async function runIssueAnalysis(
  input: AnalyzeInput,
  opts: { gateway?: AIGateway } = {},
): Promise<PersistedAIAnalysis> {
  const gateway = opts.gateway ?? getGateway();
  const started = Date.now();
  const feature = 'analyze.issue';

  // Build the issue input for the gateway. We pass the user-selected category
  // as a hint; the AI is allowed to refine it but only within the backend's
  // own CATEGORIES enum (we map/clamp on the way out).
  const base = {
    title: input.title,
    description: input.description,
    location: input.locationName,
  };

  let gatewayResult: { analysis?: any; provider: ProviderName; fallback: boolean; model?: string; attempts?: any[]; latencyMs?: number };
  try {
    const { Features } = await import('@campuspulse/ai-gateway');
    const out = await Features.analyzeIssue(gateway, base) as any;
    gatewayResult = out;
  } catch (e) {
    // Defensive: even if the gateway throws (it shouldn't), produce a fallback.
    return {
      category: input.category ?? 'OTHER',
      priority: 'MEDIUM',
      severity: null,
      summary: UNAVAILABLE_MESSAGE,
      confidence: null,
      reasoning: UNAVAILABLE_MESSAGE,
      provider: 'deterministic',
      model: 'deterministic-v1',
      status: 'fallback',
      latency_ms: Date.now() - started,
      attempts: 0,
      feature,
      created_at: new Date().toISOString(),
    };
  }

  const analysis = gatewayResult.analysis;
  const provider: ProviderName = gatewayResult.provider ?? 'deterministic';
  const fallback = gatewayResult.fallback === true;
  const attempts = (gatewayResult.attempts ?? []).length;
  const model = gatewayResult.model ?? 'unknown';

  if (fallback || !analysis) {
    return {
      category: input.category ?? 'OTHER',
      priority: 'MEDIUM',
      severity: null,
      summary: UNAVAILABLE_MESSAGE,
      confidence: null,
      reasoning: UNAVAILABLE_MESSAGE,
      provider,
      model,
      status: 'fallback',
      latency_ms: Date.now() - started,
      attempts,
      feature,
      created_at: new Date().toISOString(),
    };
  }

  return {
    category: fromGatewayCategory(analysis.category),
    priority: fromGatewayPriority(analysis.priority),
    severity: analysis.severity ?? null,
    summary: analysis.summary ?? UNAVAILABLE_MESSAGE,
    confidence: typeof analysis.confidence === 'number' ? analysis.confidence : null,
    reasoning: analysis.reasoning ?? null,
    provider,
    model,
    status: 'ok',
    latency_ms: Date.now() - started,
    attempts,
    feature,
    created_at: new Date().toISOString(),
  };
}

// ---------- per-feature helpers (optional) ----------

/** Standalone severity recommendation (not used in create flow by default). */
export async function recommendSeverity(input: AnalyzeInput): Promise<{
  severity: 'low' | 'medium' | 'high' | 'critical';
  reasoning: string;
  provider: ProviderName;
  fallback: boolean;
}> {
  const { Features } = await import('@campuspulse/ai-gateway');
  const r = await Features.recommendSeverity(getGateway(), input);
  return { ...r, fallback: r.reasoning === UNAVAILABLE_MESSAGE };
}

/** Standalone duplicate-candidate pass. Used by the similar-issues endpoint. */
export async function findSimilarIssueCandidates(
  newIssue: AnalyzeInput,
  candidates: Array<{ id: string; title: string; description?: string }>,
): Promise<{
  candidates: Array<{ existingIssueId: string; reason: string }>;
  provider: ProviderName;
  fallback: boolean;
}> {
  if (candidates.length === 0) return { candidates: [], provider: 'deterministic', fallback: true };
  const { Features } = await import('@campuspulse/ai-gateway');
  return Features.detectDuplicateCandidates(getGateway(), { newIssue, candidates });
}

/** Standalone admin insights. Used by the admin endpoint. */
export async function generateAdminInsights(
  windowDays: number,
  issues: Array<{ id: string; title: string; category?: string; status: string; createdAt: string }>,
): Promise<{ bullets: string[]; provider: ProviderName; fallback: boolean }> {
  const { Features } = await import('@campuspulse/ai-gateway');
  return Features.adminInsights(getGateway(), { windowDays, issues });
}

/** Standalone recurring pattern detection. */
export async function detectRecurringPatterns(
  recentIssues: Array<{ id: string; title: string; category?: string; createdAt: string }>,
): Promise<{ insights: Array<{ pattern: string; evidence: string[] }>; provider: ProviderName; fallback: boolean }> {
  if (recentIssues.length === 0) return { insights: [], provider: 'deterministic', fallback: true };
  const { Features } = await import('@campuspulse/ai-gateway');
  return Features.detectRecurringPattern(getGateway(), { recentIssues });
}

/** Standalone historical risk indicators. */
export async function computeRiskIndicators(
  args: { category?: string; location?: string; history: Array<{ id: string; title: string; category?: string; location?: string; severity?: string; createdAt: string }> },
): Promise<{ indicators: Array<{ label: string; score: number; reason: string }>; provider: ProviderName; fallback: boolean }> {
  if (args.history.length === 0) return { indicators: [], provider: 'deterministic', fallback: true };
  const { Features } = await import('@campuspulse/ai-gateway');
  return Features.historicalRiskIndicators(getGateway(), args);
}

/** Expose gateway health snapshot for ops endpoint. */
export function getGatewayHealth(): Record<string, { ok: number; fail: number; score: number; lastErr?: string }> {
  return getGateway().getHealthSnapshot() as any;
}
