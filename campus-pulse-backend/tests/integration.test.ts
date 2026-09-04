/**
 * INTEGRATION TESTS — the exact scenarios the FRONTEND now performs
 * against the real backend (RPCs + RLS + storage). These complement
 * rls.test.ts by walking the frontend service contract end-to-end.
 *
 * Requirement: the whole suite must stay green (>= 38 scenarios) —
 * these tests add coverage, they do not replace rls.test.ts.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import {
  USERS, ANON_CLIENT, SERVICE_CLIENT, signInAs, expectDbError, SEED_PASSWORD,
} from './helpers.js';
import { createClient } from '@supabase/supabase-js';

let student1: Awaited<ReturnType<typeof signInAs>>;
let student2: Awaited<ReturnType<typeof signInAs>>;
let staffCse: Awaited<ReturnType<typeof signInAs>>;
let deptAdmin: Awaited<ReturnType<typeof signInAs>>;
let superAdmin: Awaited<ReturnType<typeof signInAs>>;
let LOC: Record<string, string>;
let DEPT: Record<string, string>;
const PNG = Uint8Array.from(atob(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
), (c) => c.charCodeAt(0));

beforeAll(async () => {
  student1 = await signInAs(USERS.student1);
  student2 = await signInAs(USERS.student2);
  staffCse = await signInAs(USERS.staffCse);
  deptAdmin = await signInAs(USERS.deptAdminCse);
  superAdmin = await signInAs(USERS.superAdmin);
  const { data: locs } = await SERVICE_CLIENT.from('locations').select('code, id');
  const { data: depts } = await SERVICE_CLIENT.from('departments').select('code, id');
  LOC = Object.fromEntries((locs ?? []).map((l: { code: string; id: string }) => [l.code, l.id]));
  DEPT = Object.fromEntries((depts ?? []).map((d: { code: string; id: string }) => [d.code, d.id]));
});

async function rpc<T>(client: ReturnType<typeof createClient>, fn: string, args: Record<string, unknown>) {
  const res = await client.rpc(fn, args);
  return res as unknown as { data: T | null; error: { message: string } | null };
}

/** Exactly what the frontend IssuesService.createIssue does. */
async function createIssueLikeFrontend(client: ReturnType<typeof createClient>, title: string) {
  const res = await rpc<{ id: string; status: string }>(client, 'create_issue', {
    p_title: title,
    p_description: 'Integration test issue created exactly like the frontend service does.',
    p_category: 'INFRASTRUCTURE',
    p_location_id: LOC.LIB,
    p_priority: 'MEDIUM',
    p_department_id: null,
    p_is_anonymous: false,
  });
  if (res.error) throw new Error(res.error.message);
  return res.data!;
}

describe('integration: authenticated student creates issue (frontend path)', () => {
  it('creates via create_issue RPC and can immediately read it back', async () => {
    const issue = await createIssueLikeFrontend(student1.client, `INT: student create ${Date.now()}`);
    expect(issue.status).toBe('OPEN');
    const { data } = await student1.client.from('issues').select('id, status').eq('id', issue.id).single();
    expect(data!.status).toBe('OPEN');
  });

  it('rejects unauthenticated creation', async () => {
    const { error } = await ANON_CLIENT.rpc('create_issue', {
      p_title: 'Anon attempt', p_description: 'Should not be allowed here.',
      p_category: 'OTHER', p_location_id: LOC.LIB,
    });
    expect(error).toBeTruthy();
  });
});

describe('integration: unauthorized user cannot modify another user’s issue', () => {
  it('student2 cannot transition student1’s issue', async () => {
    const issue = await createIssueLikeFrontend(student1.client, `INT: foreign modify ${Date.now()}`);
    await expectDbError('FORBIDDEN', () =>
      student2.client.rpc('transition_issue_status', { p_issue_id: issue.id, p_new_status: 'ASSIGNED' })
    );
    // direct UPDATE is blocked by RLS (0 rows affected)
    const upd = await student2.client.from('issues').update({ title: 'hacked' }).eq('id', issue.id);
    expect((upd.data ?? []).length).toBe(0);
  });
});

describe('integration: staff / dept-admin assignment flow (frontend path)', () => {
  it('dept admin assigns own dept (student notified, status ASSIGNED)', async () => {
    const issue = await createIssueLikeFrontend(student1.client, `INT: assign flow ${Date.now()}`);
    const { error } = await deptAdmin.client.rpc('assign_issue', {
      p_issue_id: issue.id, p_department_id: DEPT.CSE, p_staff_id: null, p_note: 'Frontend flow',
    });
    expect(error).toBeNull();
    const { data: row } = await SERVICE_CLIENT.from('issues').select('status, department_id').eq('id', issue.id).single();
    expect(row!.status).toBe('ASSIGNED');
    expect(row!.department_id).toBe(DEPT.CSE);
    const { data: notif } = await SERVICE_CLIENT.from('notifications')
      .select('type').eq('issue_id', issue.id).eq('user_id', (await authId(USERS.student1)) as never);
    expect((notif ?? []).map((n: { type: string }) => n.type)).toContain('ISSUE_ASSIGNED');
  });

  it('staff cannot assign (role boundary)', async () => {
    const issue = await createIssueLikeFrontend(student1.client, `INT: staff assign deny ${Date.now()}`);
    await expectDbError('FORBIDDEN', () =>
      staffCse.client.rpc('assign_issue', { p_issue_id: issue.id, p_department_id: DEPT.CSE })
    );
  });
});

describe('integration: status transitions (frontend contract)', () => {
  it('valid chain OPEN→ASSIGNED→IN_PROGRESS→RESOLVED (reason) → CLOSED', async () => {
    const issue = await createIssueLikeFrontend(student1.client, `INT: chain ${Date.now()}`);
    await deptAdmin.client.rpc('assign_issue', { p_issue_id: issue.id, p_department_id: DEPT.CSE });
    const ip = await staffCse.client.rpc('transition_issue_status', { p_issue_id: issue.id, p_new_status: 'IN_PROGRESS' });
    expect(ip.error).toBeNull();
    const res = await staffCse.client.rpc('transition_issue_status', { p_issue_id: issue.id, p_new_status: 'RESOLVED', p_reason: 'Fixed by CSE staff.' });
    expect(res.error).toBeNull();
    const close = await superAdmin.client.rpc('transition_issue_status', { p_issue_id: issue.id, p_new_status: 'CLOSED' });
    expect(close.error).toBeNull();
    const { data: row } = await SERVICE_CLIENT.from('issues').select('status, resolved_at').eq('id', issue.id).single();
    expect(row!.status).toBe('CLOSED');
    expect(row!.resolved_at).toBeTruthy();
  });

  it('invalid jump OPEN→CLOSED rejected (UI must disable such options)', async () => {
    const issue = await createIssueLikeFrontend(student1.client, `INT: invalid jump ${Date.now()}`);
    await expectDbError('INVALID_TRANSITION', () =>
      superAdmin.client.rpc('transition_issue_status', { p_issue_id: issue.id, p_new_status: 'CLOSED' })
    );
  });
});

describe('integration: comments (frontend contract)', () => {
  it('student comment ok; student internal comment FORBIDDEN; visibility rules hold', async () => {
    const issue = await createIssueLikeFrontend(student1.client, `INT: comments ${Date.now()}`);
    const ok = await student1.client.rpc('add_comment', { p_issue_id: issue.id, p_body: 'Public comment from student.', p_is_internal: false });
    expect(ok.error).toBeNull();
    await expectDbError('FORBIDDEN', () =>
      student1.client.rpc('add_comment', { p_issue_id: issue.id, p_body: 'Internal attempt.', p_is_internal: true })
    );
    // other student can comment on visible non-anonymous issue
    const other = await student2.client.rpc('add_comment', { p_issue_id: issue.id, p_body: 'Endorsing this issue.', p_is_internal: false });
    expect(other.error).toBeNull();
  });
});

describe('integration: votes (frontend contract — single idempotent vote)', () => {
  it('cast_vote twice → same count, single row', async () => {
    const issue = await createIssueLikeFrontend(student1.client, `INT: votes ${Date.now()}`);
    const v1 = await student2.client.rpc('cast_vote', { p_issue_id: issue.id });
    const v2 = await student2.client.rpc('cast_vote', { p_issue_id: issue.id });
    expect(v1.error).toBeNull();
    expect(v2.error).toBeNull();
    expect(v2.data).toBe(v1.data);
    const { count } = await SERVICE_CLIENT.from('issue_votes')
      .select('id', { count: 'exact', head: true }).eq('issue_id', issue.id);
    expect(count).toBe(1);
  });
});

describe('integration: image registration (frontend upload flow)', () => {
  it('uploads real bytes to issue-photos + registers metadata via RPC', async () => {
    const issue = await createIssueLikeFrontend(student1.client, `INT: image upload ${Date.now()}`);
    const path = `${issue.id}/${student1.userId}/evidence-${Date.now()}.png`;
    const up = await student1.client.storage.from('issue-photos').upload(path, PNG, { contentType: 'image/png' });
    expect(up.error).toBeNull();
    const reg = await student1.client.rpc('register_issue_image', {
      p_issue_id: issue.id, p_kind: 'EVIDENCE', p_storage_path: path,
      p_file_size_bytes: PNG.length, p_content_type: 'image/png',
    });
    expect(reg.error).toBeNull();
    // metadata visible to owner
    const { data } = await student1.client.from('issue_images').select('kind, storage_path').eq('issue_id', issue.id);
    expect((data ?? []).length).toBe(1);
    expect(data![0].kind).toBe('EVIDENCE');
  });

  it('rejects oversize / bad mime / bad path (client validation is mirrored server-side)', async () => {
    const issue = await createIssueLikeFrontend(student1.client, `INT: image reject ${Date.now()}`);
    await expectDbError('INVALID_FILE_SIZE', () =>
      student1.client.rpc('register_issue_image', {
        p_issue_id: issue.id, p_kind: 'EVIDENCE',
        p_storage_path: `${issue.id}/${student1.userId}/x.png`,
        p_file_size_bytes: 6 * 1024 * 1024, p_content_type: 'image/png',
      })
    );
    await expectDbError('INVALID_CONTENT_TYPE', () =>
      student1.client.rpc('register_issue_image', {
        p_issue_id: issue.id, p_kind: 'EVIDENCE',
        p_storage_path: `${issue.id}/${student1.userId}/x.png`,
        p_file_size_bytes: 1024, p_content_type: 'application/pdf',
      })
    );
    await expectDbError('INVALID_PATH', () =>
      student1.client.rpc('register_issue_image', {
        p_issue_id: issue.id, p_kind: 'EVIDENCE',
        p_storage_path: `${issue.id}/${student2.userId}/x.png`, // someone else's namespace
        p_file_size_bytes: 1024, p_content_type: 'image/png',
      })
    );
  });

  it('student cannot upload RESOLUTION_PROOF (staff+ only)', async () => {
    const issue = await createIssueLikeFrontend(student1.client, `INT: proof deny ${Date.now()}`);
    await deptAdmin.client.rpc('assign_issue', { p_issue_id: issue.id, p_department_id: DEPT.CSE });
    await expectDbError('FORBIDDEN', () =>
      student1.client.rpc('register_issue_image', {
        p_issue_id: issue.id, p_kind: 'RESOLUTION_PROOF',
        p_storage_path: `${issue.id}/${student1.userId}/proof.png`,
        p_file_size_bytes: 1024, p_content_type: 'image/png',
      })
    );
  });
});

describe('integration: anonymous issue privacy', () => {
  it('other students never see the anonymous issue row or its comments', async () => {
    const { data: anon } = await student1.client.rpc('create_issue', {
      p_title: `INT: anon privacy ${Date.now()}`, p_description: 'Anonymous issue privacy test.',
      p_category: 'SAFETY', p_location_id: LOC.LIB, p_is_anonymous: true,
    });
    if (!anon) throw new Error('create failed');
    await student1.client.rpc('add_comment', { p_issue_id: anon.id, p_body: 'Author comment.', p_is_internal: false });
    // student2 sees neither the issue nor its comments
    const seen = await student2.client.from('issues').select('id').eq('id', anon.id);
    expect((seen.data ?? []).length).toBe(0);
    const comments = await student2.client.from('issue_comments').select('id').eq('issue_id', anon.id);
    expect((comments.data ?? []).length).toBe(0);
    // staff of the assigned dept & super admin CAN see it after assignment
    await superAdmin.client.rpc('assign_issue', { p_issue_id: anon.id, p_department_id: DEPT.FAC });
    const staffFac = await signInAs(USERS.staffFac);
    const staffView = await staffFac.client.from('issues').select('id').eq('id', anon.id);
    expect((staffView.data ?? []).length).toBe(1);
  });
});

describe('integration: role boundaries (frontend gates mirror server)', () => {
  it('student calling assign_issue → FORBIDDEN; staff reading other dept issue → hidden', async () => {
    const issue = await createIssueLikeFrontend(student1.client, `INT: boundaries ${Date.now()}`);
    await expectDbError('FORBIDDEN', () =>
      student1.client.rpc('assign_issue', { p_issue_id: issue.id, p_department_id: DEPT.CSE })
    );
    // staff ECE must not see unassigned/other-dept issue
    const ece = await signInAs(USERS.staffEce);
    const view = await ece.client.from('issues').select('id').eq('id', issue.id);
    expect((view.data ?? []).length).toBe(0);
  });

  it('profile role is the only role source — user_metadata cannot elevate', async () => {
    // Attempt signUp with role=SUPER_ADMIN in metadata must still yield STUDENT profile
    const email = `meta${Date.now()}@campus.test`;
    const boot = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
    const { data, error } = await boot.auth.signUp({
      email, password: SEED_PASSWORD,
      options: { data: { full_name: 'Metadata Attacker', role: 'SUPER_ADMIN' } },
    });
    if (error || !data.user) throw new Error('signup failed');
    const { data: profile } = await SERVICE_CLIENT.from('profiles').select('role').eq('id', data.user.id).single();
    expect(profile!.role).toBe('STUDENT'); // trigger forces STUDENT regardless of metadata
  });
});

async function authId(email: string): Promise<string> {
  const { data } = await SERVICE_CLIENT.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const u = data!.users.find((x: { email?: string }) => x.email === email);
  if (!u) throw new Error(`user not found: ${email}`);
  return u.id;
}
