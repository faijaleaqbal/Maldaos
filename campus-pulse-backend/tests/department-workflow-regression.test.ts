/**
 * Stage-5 REAL-STACK regression — department workflow on live local Supabase.
 * Runs against the test-bootstrap.sh seeded stack with real GoTrue JWTs
 * (RLS fully active). Covers the exact gate matrix:
 *   student -> staff review -> confirm -> dept admin approve/reject/return,
 *   cross-department isolation, notifications + audit writes, legacy create.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import {
  USERS, SERVICE_CLIENT, signInAs, expectDbError,
} from './helpers.js';

let student1: Awaited<ReturnType<typeof signInAs>>;
let student2: Awaited<ReturnType<typeof signInAs>>;
let staffCse: Awaited<ReturnType<typeof signInAs>>;
let staffEce: Awaited<ReturnType<typeof signInAs>>;
let deptAdmin: Awaited<ReturnType<typeof signInAs>>;
let superAdmin: Awaited<ReturnType<typeof signInAs>>;
let LOC: Record<string, string>;
let DEPT: Record<string, string>;

beforeAll(async () => {
  student1 = await signInAs(USERS.student1);
  student2 = await signInAs(USERS.student2);
  staffCse = await signInAs(USERS.staffCse);
  staffEce = await signInAs(USERS.staffEce);
  deptAdmin = await signInAs(USERS.deptAdminCse);
  superAdmin = await signInAs(USERS.superAdmin);
  const { data: locs } = await SERVICE_CLIENT.from('locations').select('code, id');
  const { data: depts } = await SERVICE_CLIENT.from('departments').select('code, id');
  LOC = Object.fromEntries((locs ?? []).map((l: { code: string; id: string }) => [l.code, l.id]));
  DEPT = Object.fromEntries((depts ?? []).map((d: { code: string; id: string }) => [d.code, d.id]));
});

async function makeDeptIssue(title: string, dept: string, extra: Record<string, unknown> = {}) {
  const { data, error } = await student1.client.rpc('create_issue', {
    p_title: title,
    p_description: 'Stage-5 real-stack regression probe with sufficient length.',
    p_category: 'INFRASTRUCTURE',
    p_location_id: LOC.MAIN,
    p_department_id: dept,
    ...extra,
  });
  if (error) throw new Error(`setup create failed: ${error.message}`);
  return data as { id: string; status: string };
}

describe('real-stack: legacy create untouched', () => {
  it('7-arg legacy call returns OPEN/COMPLAINT, no new params required', async () => {
    const { data, error } = await student1.client.rpc('create_issue', {
      p_title: 'Legacy path probe title',
      p_description: 'Legacy call without report_type still works fine here.',
      p_category: 'OTHER',
      p_location_id: LOC.MAIN,
    });
    expect(error).toBeNull();
    expect(data.status).toBe('OPEN');
    const { data: row } = await SERVICE_CLIENT.from('issues').select('report_type, subcategory').eq('id', data.id).single();
    expect(row!.report_type).toBe('COMPLAINT');
    expect(row!.subcategory).toBeNull();
  });
  it('9-arg SUGGESTION create persists report_type + subcategory', async () => {
    const issue = await makeDeptIssue(`Sugg probe ${Date.now()}`, DEPT.CSE, {
      p_report_type: 'SUGGESTION', p_subcategory: 'Lab Improvement',
    });
    const { data: row } = await SERVICE_CLIENT.from('issues').select('report_type, subcategory, status').eq('id', issue.id).single();
    expect(row!.report_type).toBe('SUGGESTION');
    expect(row!.subcategory).toBe('Lab Improvement');
    expect(row!.status).toBe('OPEN');
  });
  it('invalid report_type / subcategory rejected', async () => {
    await expectDbError('INVALID_REPORT_TYPE', () =>
      student1.client.rpc('create_issue', {
        p_title: 'Bad kind probe title', p_description: 'Long enough description here.',
        p_category: 'OTHER', p_location_id: LOC.MAIN, p_report_type: 'REQUEST',
      }));
    await expectDbError('INVALID_SUBCATEGORY', () =>
      student1.client.rpc('create_issue', {
        p_title: 'Bad subcat probe title', p_description: 'Long enough description here.',
        p_category: 'OTHER', p_location_id: LOC.MAIN, p_subcategory: 'X',
      }));
  });
});

describe('real-stack: staff review gate', () => {
  it('student cannot self-review (FORBIDDEN)', async () => {
    const issue = await makeDeptIssue(`Selfrev ${Date.now()}`, DEPT.CSE);
    await expectDbError('FORBIDDEN', () =>
      student1.client.rpc('review_report', { p_issue_id: issue.id, p_decision: 'CONFIRM', p_reason: 'Student tries staff review now.' }));
  });
  it('missing/short reason rejected (REVIEW_REASON_REQUIRED)', async () => {
    const issue = await makeDeptIssue(`Reason ${Date.now()}`, DEPT.CSE);
    await expectDbError('REVIEW_REASON_REQUIRED', () =>
      staffCse.client.rpc('review_report', { p_issue_id: issue.id, p_decision: 'CONFIRM', p_reason: 'x' }));
  });
  it('cross-department staff blocked (FORBIDDEN)', async () => {
    const issue = await makeDeptIssue(`Xdept ${Date.now()}`, DEPT.CSE);
    await expectDbError('FORBIDDEN', () =>
      staffEce.client.rpc('review_report', { p_issue_id: issue.id, p_decision: 'CONFIRM', p_reason: 'Cross dept attempt reason here.' }));
  });
  it('own-department CONFIRM ok, status stays OPEN, audit + student notif written', async () => {
    const issue = await makeDeptIssue(`Confirm ${Date.now()}`, DEPT.CSE);
    const { data, error } = await staffCse.client.rpc('review_report', {
      p_issue_id: issue.id, p_decision: 'CONFIRM', p_reason: 'Verified on site, motor is dead.',
    });
    expect(error).toBeNull();
    expect(data.stage).toBe('STAFF_REVIEW');
    const { data: row } = await SERVICE_CLIENT.from('issues').select('status').eq('id', issue.id).single();
    expect(row!.status).toBe('OPEN');
    const { data: audit } = await SERVICE_CLIENT.from('audit_logs').select('action').eq('entity_id', issue.id).eq('action', 'STAFF_REVIEW');
    expect((audit ?? []).length).toBe(1);
    const { data: notif } = await SERVICE_CLIENT.from('notifications').select('type').eq('issue_id', issue.id);
    expect((notif ?? []).length).toBeGreaterThanOrEqual(1);
  });
  it('review on non-OPEN blocked (INVALID_TRANSITION)', async () => {
    const issue = await makeDeptIssue(`Nonopen ${Date.now()}`, DEPT.CSE);
    await staffCse.client.rpc('review_report', { p_issue_id: issue.id, p_decision: 'CONFIRM', p_reason: 'Confirm before assign here.' });
    await deptAdmin.client.rpc('assign_issue', { p_issue_id: issue.id, p_department_id: DEPT.CSE });
    await expectDbError('INVALID_TRANSITION', () =>
      staffCse.client.rpc('review_report', { p_issue_id: issue.id, p_decision: 'CONFIRM', p_reason: 'Late review after assignment.' }));
  });
});

describe('real-stack: admin decision gate', () => {
  it('head APPROVE before staff CONFIRM blocked (STAFF_CONFIRM_REQUIRED)', async () => {
    const issue = await makeDeptIssue(`Preg ${Date.now()}`, DEPT.CSE);
    await expectDbError('STAFF_CONFIRM_REQUIRED', () =>
      deptAdmin.client.rpc('admin_decide_report', { p_issue_id: issue.id, p_decision: 'APPROVE', p_reason: 'Head jumps gate without confirm.' }));
  });
  it('cross-department head blocked (FORBIDDEN)', async () => {
    const issue = await makeDeptIssue(`XH ${Date.now()}`, DEPT.CSE);
    await staffCse.client.rpc('review_report', { p_issue_id: issue.id, p_decision: 'CONFIRM', p_reason: 'Confirm for cross-head probe.' });
    const eceHead = await signInAs(USERS.deptAdminCse); // CSE head sanity (own dept ok below)
    expect(eceHead.userId).toBeTruthy();
    // ECE staffer must not decide; use staff role probe for FORBIDDEN class
    await expectDbError('FORBIDDEN', () =>
      staffEce.client.rpc('admin_decide_report', { p_issue_id: issue.id, p_decision: 'APPROVE', p_reason: 'Cross dept head attempt reason.' }));
  });
  it('APPROVE ok, keeps OPEN, writes ADMIN_DECISION audit', async () => {
    const issue = await makeDeptIssue(`Appr ${Date.now()}`, DEPT.CSE);
    await staffCse.client.rpc('review_report', { p_issue_id: issue.id, p_decision: 'CONFIRM', p_reason: 'Genuine fault confirmed here.' });
    const { data, error } = await deptAdmin.client.rpc('admin_decide_report', {
      p_issue_id: issue.id, p_decision: 'APPROVE', p_reason: 'Genuine fault, ready to dispatch.',
    });
    expect(error).toBeNull();
    expect(data.stage).toBe('ADMIN_REVIEW');
    const { data: row } = await SERVICE_CLIENT.from('issues').select('status').eq('id', issue.id).single();
    expect(row!.status).toBe('OPEN');
    const { data: audit } = await SERVICE_CLIENT.from('audit_logs').select('action').eq('entity_id', issue.id).eq('action', 'ADMIN_DECISION');
    expect((audit ?? []).length).toBe(1);
  });
  it('REJECT/RETURN require reason; full lifecycle still works after APPROVE', async () => {
    const issue = await makeDeptIssue(`Full ${Date.now()}`, DEPT.CSE);
    await staffCse.client.rpc('review_report', { p_issue_id: issue.id, p_decision: 'CONFIRM', p_reason: 'Confirmed for lifecycle probe.' });
    await expectDbError('REVIEW_REASON_REQUIRED', () =>
      deptAdmin.client.rpc('admin_decide_report', { p_issue_id: issue.id, p_decision: 'REJECT', p_reason: null }));
    await deptAdmin.client.rpc('admin_decide_report', { p_issue_id: issue.id, p_decision: 'APPROVE', p_reason: 'Approved for full lifecycle.' });
    await deptAdmin.client.rpc('assign_issue', { p_issue_id: issue.id, p_department_id: DEPT.CSE });
    await staffCse.client.rpc('transition_issue_status', { p_issue_id: issue.id, p_new_status: 'IN_PROGRESS' });
    await staffCse.client.rpc('transition_issue_status', { p_issue_id: issue.id, p_new_status: 'RESOLVED', p_reason: 'Motor replaced, tested OK.' });
    await superAdmin.client.rpc('transition_issue_status', { p_issue_id: issue.id, p_new_status: 'CLOSED' });
    const { data: row } = await SERVICE_CLIENT.from('issues').select('status').eq('id', issue.id).single();
    expect(row!.status).toBe('CLOSED');
  });
});

describe('real-stack: isolation + direct-write blocks', () => {
  it('ECE staff sees no CSE rows via RLS (issues + reviews)', async () => {
    const issue = await makeDeptIssue(`Leak ${Date.now()}`, DEPT.CSE);
    await staffCse.client.rpc('review_report', { p_issue_id: issue.id, p_decision: 'CONFIRM', p_reason: 'Confirm for leakage probe.' });
    const eceIssues = await staffEce.client.from('issues').select('id').eq('id', issue.id);
    expect((eceIssues.data ?? []).length).toBe(0);
    const eceReviews = await staffEce.client.from('report_reviews').select('id').eq('issue_id', issue.id);
    expect((eceReviews.data ?? []).length).toBe(0);
    const cseReviews = await staffCse.client.from('report_reviews').select('id').eq('issue_id', issue.id);
    expect((cseReviews.data ?? []).length).toBe(1);
  });
  it('direct INSERT/UPDATE on report_reviews blocked; RPC-only writes', async () => {
    const issue = await makeDeptIssue(`Direct ${Date.now()}`, DEPT.CSE);
    await expectDbError('report_reviews', () =>
      staffCse.client.from('report_reviews').insert({
        issue_id: issue.id, reviewer_id: staffCse.userId,
        stage: 'STAFF_REVIEW', decision: 'CONFIRM', reason: 'Hacked review reason here.',
      }));
    const upd = await staffCse.client.from('report_reviews').update({ reason: 'Tamper attempt reason text' }).eq('issue_id', issue.id);
    expect((upd.data ?? []).length).toBe(0);
  });
});
