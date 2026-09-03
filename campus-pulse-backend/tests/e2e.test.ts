/**
 * E2E journey — the Definition of Done:
 * Student → Login → Create Issue → Upload Photo → Track
 * Admin → Login → Assign → In Progress → Resolution Proof → Resolve → Audit History
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { USERS, SERVICE_CLIENT, signInAs, findIssueByTitle } from './helpers.js';

let student1: Awaited<ReturnType<typeof signInAs>>;
let staffFac: Awaited<ReturnType<typeof signInAs>>;
let deptAdmin: Awaited<ReturnType<typeof signInAs>>;
let superAdmin: Awaited<ReturnType<typeof signInAs>>;
let LOC: Record<string, string>;
let DEPT: Record<string, string>;

// a real 1x1 PNG
const PNG = Uint8Array.from(atob(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
), (c) => c.charCodeAt(0));

beforeAll(async () => {
  student1 = await signInAs(USERS.student1);
  staffFac = await signInAs(USERS.staffFac);
  deptAdmin = await signInAs(USERS.deptAdminCse);
  superAdmin = await signInAs(USERS.superAdmin);
  const { data: locs } = await SERVICE_CLIENT.from('locations').select('code, id');
  const { data: depts } = await SERVICE_CLIENT.from('departments').select('code, id');
  LOC = Object.fromEntries((locs ?? []).map((l: { code: string; id: string }) => [l.code, l.id]));
  DEPT = Object.fromEntries((depts ?? []).map((d: { code: string; id: string }) => [d.code, d.id]));
});

describe('Definition of Done journey', () => {
  it('walks the full lifecycle', async () => {
    // ---- STUDENT: create issue ----
    const runId = Date.now();
    const issueTitle = `E2E: Broken tube light in Library ${runId}`;
    const { data: issue, error: createErr } = await student1.client.rpc('create_issue', {
      p_title: issueTitle,
      p_description: 'Tube light on library ground floor does not work.',
      p_category: 'INFRASTRUCTURE',
      p_priority: 'HIGH',
      p_location_id: LOC.LIB,
    });
    expect(createErr).toBeNull();
    expect(issue.status).toBe('OPEN');
    const issueId = issue.id as string;

    // ---- STUDENT: upload evidence photo ----
    const fileName = `e2e-evidence-${Date.now()}.png`;
    const path = `${issueId}/${student1.userId}/${fileName}`;
    const { error: upErr } = await student1.client.storage
      .from('issue-photos')
      .upload(path, PNG, { contentType: 'image/png' });
    expect(upErr).toBeNull();

    const { data: img, error: regErr } = await student1.client.rpc('register_issue_image', {
      p_issue_id: issueId, p_kind: 'EVIDENCE',
      p_storage_path: path, p_file_size_bytes: PNG.length, p_content_type: 'image/png',
    });
    expect(regErr).toBeNull();
    expect(img.kind).toBe('EVIDENCE');

    // ---- STUDENT: vote + comment + track ----
    await student1.client.rpc('cast_vote', { p_issue_id: issueId }); // own issue: allowed or rejected, either is fine
    const { data: tracked } = await student1.client
      .from('issues')
      .select('id, status, issue_votes(count)')
      .eq('id', issueId)
      .single();
    expect(tracked!.status).toBe('OPEN');

    // ---- DEPT ADMIN (FAC? admin.cse is CSE — use super admin for FAC assignment? No:
    //      admin.cse can only assign CSE. Use SUPER ADMIN to assign to FAC.) ----
    // Simpler realistic flow: assign to CSE by its dept admin:
    const { error: assignErr } = await deptAdmin.client.rpc('assign_issue', {
      p_issue_id: issueId, p_department_id: DEPT.CSE,
      p_staff_id: null, p_note: 'Electrical maintenance',
    });
    expect(assignErr).toBeNull();
    const assigned = await findIssueByTitle(issueTitle);
    expect(assigned.status).toBe('ASSIGNED');
    expect(assigned.department_id).toBe(DEPT.CSE);

    // ---- STAFF (CSE): IN_PROGRESS ----
    const staffCse = await signInAs(USERS.staffCse);
    const { error: ipErr } = await staffCse.client.rpc('transition_issue_status', {
      p_issue_id: issueId, p_new_status: 'IN_PROGRESS',
    });
    expect(ipErr).toBeNull();

    // ---- STAFF: resolution proof upload ----
    const proofName = `e2e-proof-${Date.now()}.png`;
    const proofPath = `${issueId}/${staffCse.userId}/${proofName}`;
    const { error: pUpErr } = await staffCse.client.storage
      .from('resolution-proofs')
      .upload(proofPath, PNG, { contentType: 'image/png' });
    expect(pUpErr).toBeNull();
    const { error: pRegErr } = await staffCse.client.rpc('register_issue_image', {
      p_issue_id: issueId, p_kind: 'RESOLUTION_PROOF',
      p_storage_path: proofPath, p_file_size_bytes: PNG.length, p_content_type: 'image/png',
    });
    expect(pRegErr).toBeNull();

    // ---- STAFF: RESOLVE with reason ----
    const { error: resErr } = await staffCse.client.rpc('transition_issue_status', {
      p_issue_id: issueId, p_new_status: 'RESOLVED', p_reason: 'Tube light replaced with new fitting.',
    });
    expect(resErr).toBeNull();
    const resolved = await findIssueByTitle(issueTitle);
    expect(resolved.status).toBe('RESOLVED');

    // ---- SUPER ADMIN: CLOSE ----
    const { error: closeErr } = await superAdmin.client.rpc('transition_issue_status', {
      p_issue_id: issueId, p_new_status: 'CLOSED',
    });
    expect(closeErr).toBeNull();

    // ---- STUDENT: reopen RESOLVED (owner within 7 days) — issue is CLOSED now;
    //      CLOSED->OPEN is super-admin only, so reopen path tested at RESOLVED state:
    //      create second quick lifecycle for reopen assertion
    const reopenTitle = `E2E: Reopen check desk wobble ${runId}`;
    const { data: reopenIssue } = await student1.client.rpc('create_issue', {
      p_title: reopenTitle,
      p_description: 'Desk in reading hall wobbles badly.',
      p_category: 'INFRASTRUCTURE', p_location_id: LOC.LIB,
    });
    await superAdmin.client.rpc('assign_issue', { p_issue_id: reopenIssue.id, p_department_id: DEPT.CSE });
    await staffCse.client.rpc('transition_issue_status', { p_issue_id: reopenIssue.id, p_new_status: 'IN_PROGRESS' });
    await staffCse.client.rpc('transition_issue_status', { p_issue_id: reopenIssue.id, p_new_status: 'RESOLVED', p_reason: 'Desk leg fixed.' });
    const { error: reopenErr } = await student1.client.rpc('transition_issue_status', {
      p_issue_id: reopenIssue.id, p_new_status: 'OPEN', p_reason: 'Still wobbles when writing.',
    });
    expect(reopenErr).toBeNull();
    const reopened = await findIssueByTitle(reopenTitle);
    expect(reopened.status).toBe('OPEN');

    // ---- SUPER ADMIN: audit history present ----
    const { data: audit } = await superAdmin.client
      .from('audit_logs')
      .select('action, entity_id, new_values')
      .eq('entity', 'issues')
      .eq('entity_id', issueId)
      .order('created_at', { ascending: true });
    expect((audit ?? []).length).toBeGreaterThanOrEqual(3); // assigned + in_progress + resolved + closed
    const actions = (audit ?? []).map((a: { action: string }) => a.action);
    expect(actions).toContain('ISSUE_ASSIGNED');
    expect(actions).toContain('STATUS_CHANGED');

    // ---- STATUS HISTORY ordered ----
    const { data: hist } = await superAdmin.client
      .from('issue_status_history')
      .select('old_status, new_status')
      .eq('issue_id', issueId)
      .order('created_at', { ascending: true });
    const seq = (hist ?? []).map((h: { new_status: string }) => h.new_status);
    expect(seq).toEqual(['ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']);

    // ---- notifications reached the student ----
    const { data: notifs } = await student1.client
      .from('notifications')
      .select('type')
      .eq('issue_id', issueId);
    const types = (notifs ?? []).map((n: { type: string }) => n.type);
    expect(types).toContain('ISSUE_ASSIGNED');
    expect(types).toContain('RESOLVED');

    console.log('E2E JOURNEY: PASS — full lifecycle + audit + notifications verified');
  });
});
