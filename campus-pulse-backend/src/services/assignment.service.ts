import { SupabaseClient } from '@supabase/supabase-js';
import { mapDbError } from '../lib/errors.js';

/** Assign an issue to a department (dept admin of that dept, or super admin).
 *  Transitions OPEN -> ASSIGNED, writes assignment + audit + notifications. */
export async function assignDepartment(
  client: SupabaseClient,
  issueId: string,
  departmentId: string,
  note?: string
) {
  const { error } = await client.rpc('assign_issue', {
    p_issue_id: issueId,
    p_department_id: departmentId,
    p_staff_id: null,
    p_note: note ?? null,
  });
  if (error) throw mapDbError(error);
  return { ok: true };
}

/** Assign specific staff (must belong to the issue's assigned department). */
export async function assignStaff(
  client: SupabaseClient,
  issueId: string,
  departmentId: string,
  staffId: string,
  note?: string
) {
  const { error } = await client.rpc('assign_issue', {
    p_issue_id: issueId,
    p_department_id: departmentId,
    p_staff_id: staffId,
    p_note: note ?? null,
  });
  if (error) throw mapDbError(error);
  return { ok: true };
}
