/**
 * F-2 SECURITY REGRESSION — direct INSERT authorization bypass on public.issues.
 *
 * Reproduces the Phase-8 audit finding: a STUDENT could PostgREST-INSERT an
 * issue with fabricated state (status='RESOLVED'/'ASSIGNED', arbitrary
 * resolution_summary / resolved_at / department_id), bypassing
 * issue_status_history, issue_assignments, audit_logs and notifications.
 *
 * The migration 0008_issue_insert_guard closes this at the DATABASE level
 * (trigger), on top of the existing RLS ownership policy. These tests prove:
 *   1. Fabricated-status direct INSERTs are rejected by the trigger.
 *   2. Direct INSERT with a legitimate initial state (all protected columns
 *      default) is still allowed for the owning student (RLS unchanged).
 *   3. The create_issue() RPC path still works for students.
 *   4. The trusted service-role path (seed scripts) is unaffected.
 *   5. Non-student roles cannot direct-INSERT issues at all.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import {
  USERS, ANON_CLIENT, SERVICE_CLIENT, signInAs, expectDbError,
} from './helpers.js';

let student1: Awaited<ReturnType<typeof signInAs>>;
let student2: Awaited<ReturnType<typeof signInAs>>;
let staffCse: Awaited<ReturnType<typeof signInAs>>;
let superAdmin: Awaited<ReturnType<typeof signInAs>>;

let LOC: Record<string, string>;
let DEPT: Record<string, string>;
let COLLEGE: string;
let STUDENT1_ID: string;

beforeAll(async () => {
  student1 = await signInAs(USERS.student1);
  student2 = await signInAs(USERS.student2);
  staffCse = await signInAs(USERS.staffCse);
  superAdmin = await signInAs(USERS.superAdmin);

  const { data: locs } = await SERVICE_CLIENT.from('locations').select('code, id');
  const { data: depts } = await SERVICE_CLIENT.from('departments').select('code, id');
  const { data: college } = await SERVICE_CLIENT.from('colleges').select('id').limit(1).maybeSingle();
  LOC = Object.fromEntries((locs ?? []).map((l: { code: string; id: string }) => [l.code, l.id]));
  DEPT = Object.fromEntries((depts ?? []).map((d: { code: string; id: string }) => [d.code, d.id]));
  COLLEGE = college!.id;
  STUDENT1_ID = student1.userId;
});

/** Minimal legitimate direct-insert payload (only RLS-relevant fields set). */
function legitimateInitialRow(overrides: Record<string, unknown> = {}) {
  return {
    college_id: COLLEGE,
    student_id: STUDENT1_ID,
    location_id: LOC.MAIN,
    title: 'F2 regression legitimate initial state',
    description: 'Direct insert with a fully legitimate OPEN initial state.',
    category: 'OTHER',
    ...overrides,
  };
}

// ---------- 1. FABRICATED-STATE DIRECT INSERTS ARE REJECTED ----------
describe('F-2: fabricated direct INSERT rejected at the database', () => {
  it('student cannot direct-INSERT status=RESOLVED (audit-bypass attempt)', async () => {
    const res = await student1.client.from('issues').insert(legitimateInitialRow({
      status: 'RESOLVED',
      resolution_summary: 'Fabricated: fixed by nobody',
      resolved_at: new Date().toISOString(),
      department_id: DEPT.CSE,
    }));
    expect(res.error).toBeTruthy();
    expect(res.error!.message).toMatch(/FORBIDDEN/);
    // no row was created
    const { count } = await SERVICE_CLIENT.from('issues')
      .select('id', { count: 'exact', head: true })
      .eq('title', 'F2 regression legitimate initial state');
    expect(count).toBe(0);
  });

  it('student cannot direct-INSERT status=ASSIGNED with arbitrary department_id', async () => {
    const res = await student1.client.from('issues').insert(legitimateInitialRow({
      status: 'ASSIGNED',
      department_id: DEPT.CSE,
    }));
    expect(res.error).toBeTruthy();
    expect(res.error!.message).toMatch(/FORBIDDEN/);
  });

  it('student cannot direct-INSERT fabricated resolution_summary on an OPEN row', async () => {
    const res = await student1.client.from('issues').insert(legitimateInitialRow({
      resolution_summary: 'Fabricated summary while OPEN',
    }));
    expect(res.error).toBeTruthy();
    expect(res.error!.message).toMatch(/FORBIDDEN/);
  });

  it('student cannot direct-INSERT fabricated resolved_at', async () => {
    const res = await student1.client.from('issues').insert(legitimateInitialRow({
      resolved_at: new Date(Date.now() - 86_400_000).toISOString(),
    }));
    expect(res.error).toBeTruthy();
    expect(res.error!.message).toMatch(/FORBIDDEN/);
  });

  it('student cannot direct-INSERT arbitrary department_id even with status=OPEN', async () => {
    const res = await student1.client.from('issues').insert(legitimateInitialRow({
      department_id: DEPT.CSE,
    }));
    expect(res.error).toBeTruthy();
    expect(res.error!.message).toMatch(/FORBIDDEN/);
  });

  it('fabricated inserts leave NO audit/history/assignment rows behind (atomic rejection)', async () => {
    const before = await SERVICE_CLIENT.from('issue_status_history')
      .select('id', { count: 'exact', head: true });
    const attempt = await student1.client.from('issues').insert(legitimateInitialRow({ status: 'RESOLVED' }));
    expect(attempt.error).toBeTruthy();
    const after = await SERVICE_CLIENT.from('issue_status_history')
      .select('id', { count: 'exact', head: true });
    expect(after.count).toBe(before.count);
  });
});

// ---------- 2. LEGITIMATE INITIAL STATE STILL WORKS ----------
describe('F-2: legitimate direct INSERT with initial state remains allowed', () => {
  it('student can direct-INSERT an OPEN issue with all protected columns default', async () => {
    const title = 'F2 legit OPEN direct insert ' + Date.now();
    const res = await student1.client.from('issues').insert(legitimateInitialRow({ title }));
    expect(res.error).toBeNull();
    // cleanup
    await SERVICE_CLIENT.from('issues').delete().like('title', 'F2 legit OPEN direct insert%');
  });
});

// ---------- 3. RPC WORKFLOW PRESERVED ----------
describe('F-2: create_issue RPC path unaffected', () => {
  it('student create_issue RPC still returns an OPEN issue', async () => {
    const { data, error } = await student1.client.rpc('create_issue', {
      p_title: 'F2 rpc still works ' + Date.now(),
      p_description: 'Regression: the RPC workflow must keep working after the insert guard.',
      p_category: 'OTHER',
      p_location_id: LOC.MAIN,
    });
    expect(error).toBeNull();
    expect(data.status).toBe('OPEN');
    expect(data.resolved_at).toBeNull();
    await SERVICE_CLIENT.from('issues').delete().eq('id', data.id);
  });

  it('valid state machine end-to-end still functions (assign → progress → resolve)', async () => {
    const { data: issue } = await student1.client.rpc('create_issue', {
      p_title: 'F2 lifecycle ' + Date.now(),
      p_description: 'Regression: full valid lifecycle after insert guard migration.',
      p_category: 'OTHER',
      p_location_id: LOC.MAIN,
    });
    await superAdmin.client.rpc('assign_issue', { p_issue_id: issue.id, p_department_id: DEPT.CSE });
    await staffCse.client.rpc('transition_issue_status', { p_issue_id: issue.id, p_new_status: 'IN_PROGRESS' });
    const resolved = await staffCse.client.rpc('transition_issue_status', {
      p_issue_id: issue.id, p_new_status: 'RESOLVED', p_reason: 'Regression test resolution.',
    });
    expect(resolved.error).toBeNull();
    // history + audit integrity preserved for the RPC path
    const { data: hist } = await SERVICE_CLIENT.from('issue_status_history')
      .select('new_status').eq('issue_id', issue.id).order('created_at');
    expect((hist ?? []).map((h: { new_status: string }) => h.new_status)).toEqual(['ASSIGNED', 'IN_PROGRESS', 'RESOLVED']);
    await SERVICE_CLIENT.from('issues').delete().eq('id', issue.id);
  });
});

// ---------- 4. TRUSTED SERVER PATH UNAFFECTED ----------
describe('F-2: trusted service-role path (seed scripts) unaffected', () => {
  it('service client can insert a RESOLVED demo row (auth.uid() is null)', async () => {
    const { data, error } = await SERVICE_CLIENT.from('issues').insert({
      college_id: COLLEGE,
      student_id: STUDENT1_ID,
      department_id: DEPT.FAC,
      location_id: LOC.MAIN,
      title: 'F2 service path seed row',
      description: 'Trusted seed-path insert with non-initial state must remain possible.',
      category: 'OTHER',
      priority: 'LOW',
      status: 'RESOLVED',
      is_anonymous: false,
      resolution_summary: 'Seeded resolved demo row.',
      resolved_at: new Date().toISOString(),
    }).select('id').single();
    expect(error).toBeNull();
    await SERVICE_CLIENT.from('issues').delete().eq('id', data!.id);
  });
});

// ---------- 5. NON-STUDENT ROLES BLOCKED FROM DIRECT INSERT ----------
describe('F-2: non-student roles cannot direct-INSERT issues', () => {
  it('staff direct-INSERT is rejected by the guard (RLS would allow via ownership only for students)', async () => {
    // staff has no INSERT policy; even if one existed the guard restricts to STUDENT
    const res = await staffCse.client.from('issues').insert(legitimateInitialRow());
    expect(res.error).toBeTruthy();
  });

  it('student2 cannot direct-INSERT an issue owned by student1 (ownership RLS intact)', async () => {
    const res = await student2.client.from('issues').insert(legitimateInitialRow({
      title: 'F2 foreign ownership attempt',
    }));
    // RLS with check: student_id must equal auth.uid() → rejected
    expect(res.error).toBeTruthy();
  });

  it('anon (unauthenticated) insert remains rejected', async () => {
    const res = await ANON_CLIENT.from('issues').insert(legitimateInitialRow());
    expect(res.error).toBeTruthy();
  });
});
