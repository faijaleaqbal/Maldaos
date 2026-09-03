import { SupabaseClient } from '@supabase/supabase-js';
import { mapDbError } from '../lib/errors.js';

export interface NotificationRow {
  id: string;
  user_id: string;
  issue_id: string | null;
  type: string;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export async function listMyNotifications(client: SupabaseClient, unreadOnly = false) {
  let q = client
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  if (unreadOnly) q = q.is('read_at', null);
  const { data, error } = await q;
  if (error) throw mapDbError(error);
  return data as NotificationRow[];
}

export async function markRead(client: SupabaseClient, notificationId: string) {
  const { error } = await client.rpc('read_notification', { p_notification_id: notificationId });
  if (error) throw mapDbError(error);
  return { ok: true };
}
