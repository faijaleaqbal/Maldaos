import { SupabaseClient } from '@supabase/supabase-js';
import { mapDbError } from '../lib/errors.js';
import { STATUS_TRANSITIONS, Status } from '../lib/validation.js';

/** Transition an issue's status via the guarded RPC.
 *  The DB validates actor role + lifecycle; this is a thin typed wrapper. */
export async function transitionStatus(
  client: SupabaseClient,
  issueId: string,
  newStatus: Status,
  reason?: string
) {
  const { error } = await client.rpc('transition_issue_status', {
    p_issue_id: issueId,
    p_new_status: newStatus,
    p_reason: reason ?? null,
  });
  if (error) throw mapDbError(error);
  return { ok: true };
}

/** Read-only transition map for clients to render legal next states. */
export function legalNextStates(current: Status): Status[] {
  return STATUS_TRANSITIONS[current] ?? [];
}

/** Ordered status history for an issue (RLS: only visible issues). */
export async function getStatusHistory(client: SupabaseClient, issueId: string) {
  const { data, error } = await client
    .from('issue_status_history')
    .select('old_status, new_status, changed_by, reason, created_at')
    .eq('issue_id', issueId)
    .order('created_at', { ascending: true });
  if (error) throw mapDbError(error);
  return data;
}
