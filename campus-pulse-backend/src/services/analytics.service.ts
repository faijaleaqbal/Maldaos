import { SupabaseClient } from '@supabase/supabase-js';
import { mapDbError } from '../lib/errors.js';

export interface AdminStats {
  scope: 'COLLEGE' | 'DEPARTMENT';
  by_status: Record<string, number>;
  by_category: Record<string, number>;
  avg_resolution_minutes: number | null;
}

/** Admin analytics via SECURITY DEFINER RPC (scoped by role in the DB). */
export async function getAdminStats(client: SupabaseClient): Promise<AdminStats> {
  const { data, error } = await client.rpc('admin_stats');
  if (error) throw mapDbError(error);
  return data as AdminStats;
}

/** Super-admin only: read the audit trail. */
export async function listAuditLogs(client: SupabaseClient, entity?: string, entityId?: string) {
  let q = client
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (entity) q = q.eq('entity', entity);
  if (entityId) q = q.eq('entity_id', entityId);
  const { data, error } = await q;
  if (error) throw mapDbError(error);
  return data;
}
