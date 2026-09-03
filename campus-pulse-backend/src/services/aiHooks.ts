/**
 * AI hooks — integrate the AI gateway into the issue workflow
 * WITHOUT breaking the existing create path. The brief mandates:
 *
 *   - "ticket creation must continue" if AI fails.
 *   - AI output is ALWAYS a recommendation, never authoritative.
 *
 * Strategy:
 *   - createIssue() stays exactly as it is (RPC-backed, RLS-enforced).
 *   - After a successful create, we call enrichIssueWithAI() in a
 *     non-blocking, error-swallowing way. Any AI failure is logged and
 *     ignored: the issue row is already persisted.
 *   - Recommendation values (category, priority) are NOT auto-applied to
 *     the issue row. They are persisted to ai_analysis only. The user /
 *     admin can opt in.
 */
import { SupabaseClient } from '@supabase/supabase-js';
import { analyzeAndPersist, findDuplicatesForNewIssue, type AIAnalysisRow } from './ai.service.js';
import { createConsoleLogger } from '@campuspulse/ai-gateway';

const log = createConsoleLogger('info');

/**
 * Fire-and-forget enrich a freshly-created issue with AI analysis.
 * Returns the AI row if successful, else null. Never throws.
 */
export async function enrichIssueWithAI(
  client: SupabaseClient,
  args: {
    issueId: string;
    collegeId: string;
    title: string;
    description: string;
    category?: import('../lib/validation.js').Category;
    locationName?: string;
  }
): Promise<AIAnalysisRow | null> {
  try {
    const { row } = await analyzeAndPersist(client, args);
    log.info('ai analysis persisted', {
      issueId: args.issueId,
      provider: row.provider,
      status: row.status,
      latencyMs: row.latency_ms,
      attempts: row.attempts,
    });
    return row;
  } catch (e) {
    log.warn('ai analysis failed (issue creation continues)', {
      issueId: args.issueId,
      err: (e as Error).message,
    });
    return null;
  }
}

/**
 * Find duplicate candidates for a new issue. Non-throwing.
 * The caller (UI) decides whether to show a "looks like X" hint.
 */
export async function findDuplicatesForIssue(
  client: SupabaseClient,
  args: {
    collegeId: string;
    title: string;
    description: string;
    category?: import('../lib/validation.js').Category;
    locationName?: string;
    candidateLimit?: number;
  }
): Promise<{ candidates: Array<{ existingIssueId: string; reason: string }>; provider: string; fallback: boolean } | null> {
  try {
    return await findDuplicatesForNewIssue(client, args);
  } catch (e) {
    log.warn('duplicate detection failed', { err: (e as Error).message });
    return null;
  }
}