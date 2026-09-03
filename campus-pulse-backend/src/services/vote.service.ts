import { SupabaseClient } from '@supabase/supabase-js';
import { mapDbError } from '../lib/errors.js';

/** Cast a vote (students). Idempotent — duplicate casts are no-ops.
 *  Returns the issue's total vote count. */
export async function castVote(client: SupabaseClient, issueId: string): Promise<number> {
  const { data, error } = await client.rpc('cast_vote', { p_issue_id: issueId });
  if (error) throw mapDbError(error);
  return data as number;
}

export async function getVoteCount(client: SupabaseClient, issueId: string): Promise<number> {
  const { count, error } = await client
    .from('issue_votes')
    .select('id', { count: 'exact', head: true })
    .eq('issue_id', issueId);
  if (error) throw mapDbError(error);
  return count ?? 0;
}
