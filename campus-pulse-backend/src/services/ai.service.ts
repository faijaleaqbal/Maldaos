/**
 * AI service — the only place the backend touches the ai_analysis table.
 *
 * Stores every AI run as a *recommendation* (never authoritative). All
 * mutations are tenant-safe (college_id propagated) and respect RLS via
 * the user-supplied client. Reads use the same client.
 */
import { SupabaseClient } from '@supabase/supabase-js';
import { mapDbError } from '../lib/errors.js';
import {
  CATEGORIES, PRIORITIES, type Category, type Priority,
} from '../lib/validation.js';
import {
  runIssueAnalysis, findSimilarIssueCandidates, generateAdminInsights,
  detectRecurringPatterns, computeRiskIndicators, recommendSeverity,
  type PersistedAIAnalysis,
} from '../lib/aiClient.js';
import { UNAVAILABLE_MESSAGE } from '@campuspulse/ai-gateway';

export interface AIAnalysisRow {
  id: string;
  issue_id: string;
  college_id: string;
  category_recommended: Category;
  severity_recommended: string | null;
  priority_recommended: Priority;
  summary: string;
  confidence: number | null;
  reasoning: string | null;
  provider: string;
  model: string;
  status: 'ok' | 'fallback';
  latency_ms: number;
  attempts: number;
  feature: string;
  created_at: string;
  created_by: string | null;
}

/**
 * Persist an AI run for an issue. Returns the inserted row.
 * Permission: any signed-in user may attach an analysis to an issue they
 * can already see (RLS on issues controls read; we then insert via the
 * SECURITY DEFINER RPC below so the insert policy is consistent).
 */
export async function saveAnalysis(
  client: SupabaseClient,
  args: {
    issueId: string;
    collegeId: string;
    analysis: PersistedAIAnalysis;
  }
): Promise<AIAnalysisRow> {
  const { data, error } = await client.rpc('save_ai_analysis', {
    p_issue_id: args.issueId,
    p_college_id: args.collegeId,
    p_category: args.analysis.category,
    p_severity: args.analysis.severity,
    p_priority: args.analysis.priority,
    p_summary: args.analysis.summary,
    p_confidence: args.analysis.confidence,
    p_reasoning: args.analysis.reasoning,
    p_provider: args.analysis.provider,
    p_model: args.analysis.model,
    p_status: args.analysis.status,
    p_latency_ms: args.analysis.latency_ms,
    p_attempts: args.analysis.attempts,
    p_feature: args.analysis.feature,
  });
  if (error) throw mapDbError(error);
  return data as AIAnalysisRow;
}

/** Fetch the latest AI analysis for an issue (RLS-safe). */
export async function getLatestAnalysis(
  client: SupabaseClient,
  issueId: string,
): Promise<AIAnalysisRow | null> {
  const { data, error } = await client
    .from('ai_analysis')
    .select('*')
    .eq('issue_id', issueId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw mapDbError(error);
  return (data as AIAnalysisRow | null) ?? null;
}

/**
 * High-level: run AI analysis and persist it for an issue.
 * Never throws on AI failure — falls back to deterministic response.
 */
export async function analyzeAndPersist(
  client: SupabaseClient,
  args: {
    issueId: string;
    collegeId: string;
    title: string;
    description: string;
    category?: Category;
    locationName?: string;
  }
): Promise<{ row: AIAnalysisRow; analysis: PersistedAIAnalysis }> {
  const analysis = await runIssueAnalysis({
    title: args.title,
    description: args.description,
    category: args.category,
    locationName: args.locationName,
  });
  const row = await saveAnalysis(client, {
    issueId: args.issueId,
    collegeId: args.collegeId,
    analysis,
  });
  return { row, analysis };
}

/**
 * Find duplicate candidates for a new issue. Reads recent issues from DB
 * (capped) and asks the gateway to recommend which (if any) are duplicates.
 * Returns ONLY candidates, never fake similarity scores.
 */
export async function findDuplicatesForNewIssue(
  client: SupabaseClient,
  args: {
    collegeId: string;
    title: string;
    description: string;
    category?: Category;
    locationName?: string;
    /** Cap how many candidates to send to the AI. */
    candidateLimit?: number;
  }
): Promise<{
  candidates: Array<{ existingIssueId: string; reason: string }>;
  provider: string;
  fallback: boolean;
}> {
  const limit = Math.min(args.candidateLimit ?? 20, 50);
  const { data, error } = await client
    .from('issues')
    .select('id, title, description')
    .eq('college_id', args.collegeId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw mapDbError(error);
  const rows = (data ?? []) as Array<{ id: string; title: string; description: string | null }>;
  return findSimilarIssueCandidates(
    { title: args.title, description: args.description, category: args.category, locationName: args.locationName },
    rows.map(r => ({ id: r.id, title: r.title, description: r.description ?? undefined })),
  );
}

/** Admin insights: read recent issues and ask gateway for bullets. */
export async function buildAdminInsights(
  client: SupabaseClient,
  args: { collegeId: string; windowDays: number; cap?: number }
): Promise<{ bullets: string[]; provider: string; fallback: boolean }> {
  const cap = Math.min(args.cap ?? 200, 500);
  const since = new Date(Date.now() - args.windowDays * 86_400_000).toISOString();
  const { data, error } = await client
    .from('issues')
    .select('id, title, category, status, created_at')
    .eq('college_id', args.collegeId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(cap);
  if (error) throw mapDbError(error);
  const issues = (data ?? []).map(r => ({
    id: r.id as string,
    title: r.title as string,
    category: (r.category as string | null) ?? undefined,
    status: r.status as string,
    createdAt: r.created_at as string,
  }));
  return generateAdminInsights(args.windowDays, issues);
}

/** Recurring-pattern detection. */
export async function buildRecurringPatterns(
  client: SupabaseClient,
  args: { collegeId: string; windowDays: number; cap?: number }
): Promise<{ insights: Array<{ pattern: string; evidence: string[] }>; provider: string; fallback: boolean }> {
  const cap = Math.min(args.cap ?? 200, 500);
  const since = new Date(Date.now() - args.windowDays * 86_400_000).toISOString();
  const { data, error } = await client
    .from('issues')
    .select('id, title, category, created_at')
    .eq('college_id', args.collegeId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(cap);
  if (error) throw mapDbError(error);
  const issues = (data ?? []).map(r => ({
    id: r.id as string,
    title: r.title as string,
    category: (r.category as string | null) ?? undefined,
    createdAt: r.created_at as string,
  }));
  return detectRecurringPatterns(issues);
}

/** Risk indicators based on history of similar issues. */
export async function buildRiskIndicators(
  client: SupabaseClient,
  args: { collegeId: string; category?: Category; locationName?: string; cap?: number }
): Promise<{ indicators: Array<{ label: string; score: number; reason: string }>; provider: string; fallback: boolean }> {
  const cap = Math.min(args.cap ?? 100, 300);
  const { data, error } = await client
    .from('issues')
    .select('id, title, category, location_id, created_at')
    .eq('college_id', args.collegeId)
    .order('created_at', { ascending: false })
    .limit(cap);
  if (error) throw mapDbError(error);
  const issues = (data ?? []).map(r => ({
    id: r.id as string,
    title: r.title as string,
    category: (r.category as string | null) ?? undefined,
    location: undefined as string | undefined,
    severity: undefined as string | undefined,
    createdAt: r.created_at as string,
  }));
  return computeRiskIndicators({
    category: args.category,
    location: args.locationName,
    history: issues,
  });
}

/** Pure helper: severity → priority mapping (used as a fallback). */
export { severityToPriority } from '../lib/aiClient.js';
export { recommendSeverity, UNAVAILABLE_MESSAGE };
export { CATEGORIES, PRIORITIES };
export type { Category, Priority, PersistedAIAnalysis };