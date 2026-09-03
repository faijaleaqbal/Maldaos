import { SupabaseClient } from '@supabase/supabase-js';
import { mapDbError } from '../lib/errors.js';
import { validateIssueInput, Category, Priority } from '../lib/validation.js';
import { enrichIssueWithAI, findDuplicatesForIssue } from './aiHooks.js';
import type { AIAnalysisRow } from './ai.service.js';

export interface IssueRow {
  id: string;
  college_id: string;
  student_id: string;
  department_id: string | null;
  location_id: string;
  title: string;
  description: string;
  category: Category;
  priority: Priority;
  status: 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  is_anonymous: boolean;
  resolution_summary: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  issues?: unknown[]; // joins from supabase-js come back keyed oddly; see getIssue
  locations?: { id: string; name: string; code: string }[];
  departments?: { id: string; name: string; code: string }[];
  vote_count?: number;
}

/** Create an issue (students only). Server-side validation + RPC (DB re-validates). */
export async function createIssue(
  client: SupabaseClient,
  input: {
    title: string;
    description: string;
    category: Category;
    locationId: string;
    priority?: Priority;
    departmentId?: string | null;
    isAnonymous?: boolean;
  }
) {
  const v = validateIssueInput({
    title: input.title,
    description: input.description,
    category: input.category,
    priority: input.priority,
  });
  if (!v.ok) throw { error: { code: 'INVALID_INPUT', message: v.errors.join('; '), details: v.errors } };

  const { data, error } = await client.rpc('create_issue', {
    p_title: input.title,
    p_description: input.description,
    p_category: input.category,
    p_location_id: input.locationId,
    p_priority: input.priority ?? 'LOW',
    p_department_id: input.departmentId ?? null,
    p_is_anonymous: input.isAnonymous ?? false,
  });
  if (error) throw mapDbError(error);
  return data as IssueRow;
}

/** Get one issue with location, department and vote count. */
export async function getIssue(client: SupabaseClient, issueId: string) {
  const { data, error } = await client
    .from('issues')
    .select(`*, locations(name, code), departments(name, code), issue_votes(count)`)
    .eq('id', issueId)
    .single();
  if (error) throw mapDbError(error);
  const row = data as unknown as IssueRow & { issue_votes: { count: number }[] };
  return { ...row, vote_count: row.issue_votes?.[0]?.count ?? 0 };
}

export interface IssueFilters {
  status?: string;
  departmentId?: string;
  locationId?: string;
  category?: string;
  limit?: number;
  offset?: number;
}

/** List issues visible to the current user (RLS decides visibility). */
export async function listIssues(client: SupabaseClient, filters: IssueFilters = {}) {
  let q = client
    .from('issues')
    .select(`id, title, category, priority, status, is_anonymous, created_at, locations(name), departments(name)`, { count: 'exact' });
  if (filters.status) q = q.eq('status', filters.status);
  if (filters.departmentId) q = q.eq('department_id', filters.departmentId);
  if (filters.locationId) q = q.eq('location_id', filters.locationId);
  if (filters.category) q = q.eq('category', filters.category);
  q = q.range(filters.offset ?? 0, (filters.offset ?? 0) + (filters.limit ?? 20) - 1);
  const { data, error, count } = await q;
  if (error) throw mapDbError(error);
  return { data, total: count ?? 0 };
}

/** Student owner edits title/description while the issue is OPEN. */
export async function updateMyIssue(
  client: SupabaseClient,
  issueId: string,
  patch: { title?: string; description?: string }
) {
  const clean: Record<string, string> = {};
  if (patch.title !== undefined) {
    const v = validateTitleLen(patch.title);
    if (!v.ok) throw { error: { code: 'INVALID_TITLE', message: v.errors.join('; ') } };
    clean.title = patch.title;
  }
  if (patch.description !== undefined) {
    const v = validateDescLen(patch.description);
    if (!v.ok) throw { error: { code: 'INVALID_DESCRIPTION', message: v.errors.join('; ') } };
    clean.description = patch.description;
  }
  if (Object.keys(clean).length === 0) throw { error: { code: 'INVALID_INPUT', message: 'nothing to update' } };
  const { data, error } = await client.from('issues').update(clean).eq('id', issueId).select().single();
  if (error) throw mapDbError(error);
  return data as IssueRow;
}

function validateTitleLen(t: string) {
  const n = (t ?? '').trim().length;
  return n >= 5 && n <= 200 ? { ok: true, errors: [] as string[] } : { ok: false, errors: ['title must be 5-200 characters'] };
}
function validateDescLen(d: string) {
  const n = (d ?? '').trim().length;
  return n >= 10 && n <= 5000 ? { ok: true, errors: [] as string[] } : { ok: false, errors: ['description must be 10-5000 characters'] };
}

/**
 * Create an issue and additionally request AI enrichment. The AI step is
 * strictly non-blocking: if every provider fails (rate-limited, down,
 * malformed response), the issue is still created and the response just
 * carries `ai: null` plus a top-level `aiUnavailable: true` flag.
 *
 * AI recommendations are persisted in `ai_analysis` but are NEVER applied
 * back to the issue row — a human (or the admin's explicit accept) decides.
 */
export async function createIssueWithAI(
  client: SupabaseClient,
  input: {
    title: string;
    description: string;
    category: Category;
    locationId: string;
    priority?: Priority;
    departmentId?: string | null;
    isAnonymous?: boolean;
    locationName?: string;
  }
): Promise<{ issue: IssueRow; ai: AIAnalysisRow | null; aiUnavailable: boolean }> {
  const issue = await createIssue(client, input);

  // Fire-and-forget AI enrichment. NEVER throws.
  const ai = await enrichIssueWithAI(client, {
    issueId: issue.id,
    collegeId: issue.college_id,
    title: issue.title,
    description: issue.description,
    category: issue.category,
    locationName: input.locationName,
  });

  // "Unavailable" means either: (a) the AI call itself threw (ai is null) or
  // (b) the AI was forced into deterministic fallback (status === 'fallback').
  // The brief mandates that ticket creation continues either way.
  const aiUnavailable = ai === null || ai.status === 'fallback';

  return { issue, ai, aiUnavailable };
}

/**
 * Optional duplicate-candidate check, called BEFORE createIssue when the
 * client wants to show a "this looks like a duplicate" hint. Returns null
 * on AI failure (caller should just proceed).
 */
export async function checkDuplicatesBeforeCreate(
  client: SupabaseClient,
  input: { title: string; description: string; category: Category; locationName?: string; collegeId: string }
) {
  return findDuplicatesForIssue(client, {
    collegeId: input.collegeId,
    title: input.title,
    description: input.description,
    category: input.category,
    locationName: input.locationName,
  });
}
