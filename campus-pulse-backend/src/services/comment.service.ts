import { SupabaseClient } from '@supabase/supabase-js';
import { mapDbError } from '../lib/errors.js';

export interface CommentRow {
  id: string;
  issue_id: string;
  author_id: string;
  body: string;
  is_internal: boolean;
  created_at: string;
}

/** Add a comment via guarded RPC (role + visibility rules enforced in DB). */
export async function addComment(
  client: SupabaseClient,
  issueId: string,
  body: string,
  isInternal = false
) {
  const { data, error } = await client.rpc('add_comment', {
    p_issue_id: issueId,
    p_body: body,
    p_is_internal: isInternal,
  });
  if (error) throw mapDbError(error);
  return data as CommentRow;
}

/** List comments (internal comments only visible to staff of that dept / super admin). */
export async function listComments(client: SupabaseClient, issueId: string) {
  const { data, error } = await client
    .from('issue_comments')
    .select('id, issue_id, author_id, body, is_internal, created_at')
    .eq('issue_id', issueId)
    .order('created_at', { ascending: true });
  if (error) throw mapDbError(error);
  return data as CommentRow[];
}
