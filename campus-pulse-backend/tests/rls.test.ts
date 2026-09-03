/**
 * RLS + permission test suite — the 12 mandated security areas.
 * Runs against the LOCAL Supabase stack with real user JWTs (RLS fully active).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import {
  USERS, ANON_CLIENT, SERVICE_CLIENT, signInAs, expectDbError,
  findIssueByTitle, SEED_PASSWORD,
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

// ---------- 1. STUDENT PERMISSIONS ----------
describe('1. student permissions', () => {
  it('student can create an issue', async () => {
    const { data, error } = await student1.client.rpc('create_issue', {
      p_title: 'Test fan noise in class',
      p_description: 'Ceiling fan makes loud noise during lectures.',
      p_category: 'INFRASTRUCTURE',
      p_location_id: LOC.MAIN,
    });
    expect(error).toBeNull();
    expect(data.status).toBe('OPEN');
  });

  it('student sees own anonymous issue; other students cannot', async () => {
    const anon = await findIssueByTitle('Flooded sports ground corner');
    const mine = await student1.client.from('issues').select('id').eq('id', anon.id);
    expect((mine.data ?? []).length).toBe(1);
    const other = await student2.client.from('issues').select('id').eq('id', anon.id);
    expect((other.data ?? []).length).toBe(0);
  });

  it('student can edit own OPEN issue title; cannot edit after assignment', async () => {
    const created = await unwrap(await student1.client.rpc('create_issue', {
      p_title: 'Leaking tap in corridor', p_description: 'Tap near room 12 keeps dripping.',
      p_category: 'INFRASTRUCTURE', p_location_id: LOC.MAIN,
    }));
    // edit while OPEN is allowed
    const upd = await student1.client
      .from('issues')
      .update({ title: 'Leaking tap in corridor (updated)' })
      .eq('id', created.id);
    expect(upd.error).toBeNull();
    await deptAdmin.client.rpc('assign_issue', { p_issue_id: created.id, p_department_id: DEPT.CSE });
    const upd2 = await student1.client.from('issues').update({ title: 'Leaking tap in corridor x' }).eq('id', created.id);
    // RLS hides the row from the owner once status != OPEN: 0 rows updated, no error.
    // Verify the title did NOT change:
    const after = await SERVICE_CLIENT.from('issues').select('title').eq('id', created.id).single();
    expect(after.data!.title).toBe('Leaking tap in corridor (updated)');
    expect((upd2.data ?? []).length).toBe(0);
  });
});

// ---------- 2. STAFF PERMISSIONS ----------
describe('2. staff permissions', () => {
  it('staff sees own-department issues, not other departments', async () => {
    const cse = await staffCse.client.from('issues').select('id, title').eq('department_id', DEPT.CSE);
    expect((cse.data ?? []).length).toBeGreaterThan(0);
    const eceIssue = await findIssueByTitle('Projector not working in Lab 2');
    // staff ECE tries to read the CSE-assigned issue
    const ece = await staffEce.client.from('issues').select('id').eq('id', eceIssue.id);
    expect((ece.data ?? []).length).toBe(0);
  });

  it('staff can transition own-dept ASSIGNED -> IN_PROGRESS', async () => {
    const issue = await findIssueByTitle('Projector not working in Lab 2');
    const { error } = await staffCse.client.rpc('transition_issue_status', {
      p_issue_id: issue.id, p_new_status: 'IN_PROGRESS',
    });
    expect(error).toBeNull();
    // restore
    await SERVICE_CLIENT.from('issues').update({ status: 'ASSIGNED' }).eq('id', issue.id);
  });

  it('staff cannot assign issues', async () => {
    const issue = await findIssueByTitle('Broken library chair');
    await expectDbError('FORBIDDEN', () =>
      staffCse.client.rpc('assign_issue', { p_issue_id: issue.id, p_department_id: DEPT.CSE })
    );
  });

  it('staff cannot resolve without reason', async () => {
    const created = await unwrap(await student2.client.rpc('create_issue', {
      p_title: 'Cracked bench outside lab', p_description: 'Bench near lab block is cracked.',
      p_category: 'INFRASTRUCTURE', p_location_id: LOC.MAIN,
    }));
    await deptAdmin.client.rpc('assign_issue', { p_issue_id: created.id, p_department_id: DEPT.CSE });
    await staffCse.client.rpc('transition_issue_status', { p_issue_id: created.id, p_new_status: 'IN_PROGRESS' });
    await expectDbError('RESOLUTION_REASON_REQUIRED', () =>
      staffCse.client.rpc('transition_issue_status', { p_issue_id: created.id, p_new_status: 'RESOLVED' })
    );
  });
});

// ---------- 3. DEPARTMENT ADMIN PERMISSIONS ----------
describe('3. department admin permissions', () => {
  it('dept admin can assign to own department', async () => {
    const issue = await findIssueByTitle('Broken library chair');
    const { error } = await deptAdmin.client.rpc('assign_issue', {
      p_issue_id: issue.id, p_department_id: DEPT.CSE,
      p_staff_id: null, p_note: 'Handle chair repair',
    });
    expect(error).toBeNull();
    // restore for later suites
    await SERVICE_CLIENT.from('issues').update({ status: 'OPEN', department_id: null }).eq('id', issue.id);
    await SERVICE_CLIENT.from('issue_assignments').delete().eq('issue_id', issue.id);
  });

  it('dept admin cannot assign to another department', async () => {
    const issue = await findIssueByTitle('Broken library chair');
    await expectDbError('FORBIDDEN', () =>
      deptAdmin.client.rpc('assign_issue', { p_issue_id: issue.id, p_department_id: DEPT.ECE })
    );
  });
});

// ---------- 4. SUPER ADMIN PERMISSIONS ----------
describe('4. super admin permissions', () => {
  it('sees all issues incl. anonymous', async () => {
    const { count } = await superAdmin.client.from('issues').select('id', { count: 'exact', head: true });
    expect(count!).toBeGreaterThan(4);
  });

  it('can close a resolved issue (RESOLVED -> CLOSED)', async () => {
    const issue = await findIssueByTitle('Cafeteria hygiene issue');
    const { error } = await superAdmin.client.rpc('transition_issue_status', {
      p_issue_id: issue.id, p_new_status: 'CLOSED',
    });
    expect(error).toBeNull();
    // restore
    await SERVICE_CLIENT.from('issues').update({ status: 'RESOLVED' }).eq('id', issue.id);
  });

  it('can change profile roles (audited)', async () => {
    const { data: p } = await SERVICE_CLIENT.from('profiles').select('id').eq('id', (await authId(USERS.student2)) as any).single();
    const { error } = await superAdmin.client.rpc('change_profile_role', {
      p_profile_id: p!.id, p_role: 'STUDENT',
    });
    expect(error).toBeNull();
  });
});

// ---------- 5. RLS BYPASS ATTEMPTS ----------
describe('5. RLS bypass attempts', () => {
  it('anon key sees nothing', async () => {
    const { count } = await ANON_CLIENT.from('issues').select('id', { count: 'exact', head: true });
    expect(count).toBe(0);
  });

  it('anon cannot insert issues', async () => {
    const { error } = await ANON_CLIENT.from('issues').insert({
      college_id: '00000000-0000-0000-0000-000000000000',
      student_id: '00000000-0000-0000-0000-000000000000',
      location_id: LOC.MAIN,
      title: 'Anon hack attempt', description: 'Should never insert',
      category: 'OTHER',
    });
    expect(error).toBeTruthy();
  });

  it('student cannot directly UPDATE issues SET status', async () => {
    const issue = await findIssueByTitle('Broken library chair');
    const { error } = await student1.client
      .from('issues')
      .update({ status: 'CLOSED' })
      .eq('id', issue.id);
    expect(error).toBeTruthy();
  });

  it('student cannot INSERT into audit_logs', async () => {
    const { error } = await student1.client.from('audit_logs').insert({
      action: 'HACK', entity: 'issues',
    });
    expect(error).toBeTruthy();
  });

  it('student cannot INSERT into issue_assignments', async () => {
    const issue = await findIssueByTitle('Broken library chair');
    const { error } = await student1.client.from('issue_assignments').insert({
      issue_id: issue.id, department_id: DEPT.CSE, assigned_by: student1.userId,
    });
    expect(error).toBeTruthy();
  });

  it('unauthenticated RPC call fails', async () => {
    const { error } = await ANON_CLIENT.rpc('cast_vote', {
      p_issue_id: (await findIssueByTitle('Projector not working in Lab 2')).id,
    });
    expect(error).toBeTruthy();
  });
});

// ---------- 6. INVALID STATUS TRANSITIONS ----------
describe('6. invalid status transitions', () => {
  it('OPEN -> CLOSED is illegal', async () => {
    const issue = await findIssueByTitle('Broken library chair');
    await expectDbError('INVALID_TRANSITION', () =>
      superAdmin.client.rpc('transition_issue_status', { p_issue_id: issue.id, p_new_status: 'CLOSED' })
    );
  });
  it('OPEN -> RESOLVED is illegal', async () => {
    const issue = await findIssueByTitle('Broken library chair');
    await expectDbError('INVALID_TRANSITION', () =>
      superAdmin.client.rpc('transition_issue_status', { p_issue_id: issue.id, p_new_status: 'RESOLVED' })
    );
  });
  it('CLOSED -> IN_PROGRESS is illegal', async () => {
    // build a closed issue via admin path
    const created = await unwrap(await student1.client.rpc('create_issue', {
      p_title: 'Old banner torn', p_description: 'Banner at gate torn since fest.',
      p_category: 'OTHER', p_location_id: LOC.MAIN,
    }));
    await superAdmin.client.rpc('assign_issue', { p_issue_id: created.id, p_department_id: DEPT.FAC });
    await superAdmin.client.rpc('transition_issue_status', { p_issue_id: created.id, p_new_status: 'IN_PROGRESS' });
    await superAdmin.client.rpc('transition_issue_status', { p_issue_id: created.id, p_new_status: 'RESOLVED', p_reason: 'Replaced banner' });
    await superAdmin.client.rpc('transition_issue_status', { p_issue_id: created.id, p_new_status: 'CLOSED' });
    await expectDbError('INVALID_TRANSITION', () =>
      superAdmin.client.rpc('transition_issue_status', { p_issue_id: created.id, p_new_status: 'IN_PROGRESS' })
    );
  });
});

// ---------- 7. UNAUTHORIZED ASSIGNMENT CHANGES ----------
describe('7. unauthorized assignment changes', () => {
  it('student cannot call assign_issue', async () => {
    const issue = await findIssueByTitle('Broken library chair');
    await expectDbError('FORBIDDEN', () =>
      student1.client.rpc('assign_issue', { p_issue_id: issue.id, p_department_id: DEPT.CSE })
    );
  });
  it('staff cannot call assign_issue', async () => {
    const issue = await findIssueByTitle('Broken library chair');
    await expectDbError('FORBIDDEN', () =>
      staffCse.client.rpc('assign_issue', { p_issue_id: issue.id, p_department_id: DEPT.CSE })
    );
  });
  it('direct UPDATE of issues.department_id blocked', async () => {
    const issue = await findIssueByTitle('Projector not working in Lab 2');
    const { error } = await staffCse.client.from('issues').update({ department_id: DEPT.ECE }).eq('id', issue.id);
    expect(error).toBeTruthy();
  });
});

// ---------- 8. UNAUTHORIZED FILE ACCESS ----------
describe('8. unauthorized file access', () => {
  it('student cannot read another user’s resolution-proof metadata', async () => {
    const resolved = await findIssueByTitle('Cafeteria hygiene issue');
    // register a proof as staff (trusted path via service for fixture)
    const { data: staffProfile } = await SERVICE_CLIENT.from('profiles').select('id').eq('id', (await authId(USERS.staffFac)) as any).single();
    const path = `${resolved.id}/${staffProfile!.id}/proof-123.png`;
    await SERVICE_CLIENT.from('issue_images').insert({
      issue_id: resolved.id, uploaded_by: staffProfile!.id, kind: 'RESOLUTION_PROOF',
      storage_path: path, file_size_bytes: 1024, content_type: 'image/png',
    });
    // student (not owner? issue owner is student2) — student1 must NOT see it
    const { data } = await student1.client.from('issue_images').select('id').eq('issue_id', resolved.id).eq('kind', 'RESOLUTION_PROOF');
    expect((data ?? []).length).toBe(0);
    // owner student2 CAN see the row (metadata) but policy gates storage read for staff+ only
    const mine = await student2.client.from('issue_images').select('id').eq('issue_id', resolved.id).eq('kind', 'RESOLUTION_PROOF');
    expect((mine.data ?? []).length).toBe(1);
  });

  it('anon cannot list storage objects', async () => {
    const { data } = await ANON_CLIENT.storage.from('issue-photos').list();
    expect((data ?? []).length).toBe(0);
  });
});

// ---------- 9. DUPLICATE VOTES ----------
describe('9. duplicate votes', () => {
  it('cast_vote is idempotent (raw inserts blocked by RLS)', async () => {
    const issue = await findIssueByTitle('Projector not working in Lab 2');
    const r1 = await student1.client.rpc('cast_vote', { p_issue_id: issue.id });
    const r2 = await student1.client.rpc('cast_vote', { p_issue_id: issue.id });
    expect(r1.error).toBeNull();
    expect(r2.error).toBeNull();
    expect(r2.data).toBe(r1.data); // no double-count
    const { count } = await SERVICE_CLIENT.from('issue_votes').select('id', { count: 'exact', head: true }).eq('issue_id', issue.id).eq('voter_id', (await authId(USERS.student1)) as any);
    expect(count).toBe(1);
  });

  it('unique constraint prevents duplicate raw rows', async () => {
    const issue = await findIssueByTitle('Projector not working in Lab 2');
    const uid = await authId(USERS.student1);
    const { error } = await SERVICE_CLIENT.from('issue_votes').insert({ issue_id: issue.id, voter_id: uid });
    expect(error).toBeTruthy();
    expect(/duplicate key|unique/i.test(error!.message)).toBe(true);
  });
});

// ---------- 10. INVALID / MISSING ISSUE DATA ----------
describe('10. invalid issue data', () => {
  it('rejects short title', async () => {
    await expectDbError('INVALID_TITLE', () =>
      student1.client.rpc('create_issue', {
        p_title: 'abc', p_description: 'This is a valid description length.',
        p_category: 'OTHER', p_location_id: LOC.MAIN,
      })
    );
  });
  it('rejects short description', async () => {
    await expectDbError('INVALID_DESCRIPTION', () =>
      student1.client.rpc('create_issue', {
        p_title: 'Valid title here', p_description: 'short',
        p_category: 'OTHER', p_location_id: LOC.MAIN,
      })
    );
  });
  it('rejects bad location (different college FK exists, wrong id => not found)', async () => {
    await expectDbError('INVALID_LOCATION', () =>
      student1.client.rpc('create_issue', {
        p_title: 'Valid title here', p_description: 'Valid description here.',
        p_category: 'OTHER', p_location_id: '00000000-0000-0000-0000-000000000000',
      })
    );
  });
});

// ---------- 11. DATABASE CONSTRAINT FAILURES ----------
describe('11. constraint failures', () => {
  it('rejects invalid enum value (via direct insert, CHECK/enum violation)', async () => {
    const { data: prof } = await SERVICE_CLIENT.from('profiles').select('id, college_id').eq('id', (await authId(USERS.student1)) as any).single();
    const { error } = await SERVICE_CLIENT.from('issues').insert({
      college_id: prof!.college_id, student_id: prof!.id, location_id: LOC.MAIN,
      title: 'Constraint test issue', description: 'Testing enum constraint.',
      category: 'NOT_A_CATEGORY',
    });
    expect(error).toBeTruthy();
  });
  it('rejects NULL title (NOT NULL violation)', async () => {
    const { data: prof } = await SERVICE_CLIENT.from('profiles').select('id, college_id').eq('id', (await authId(USERS.student1)) as any).single();
    const { error } = await SERVICE_CLIENT.from('issues').insert({
      college_id: prof!.college_id, student_id: prof!.id, location_id: LOC.MAIN,
      title: null as unknown as string, description: 'Testing not-null constraint.',
      category: 'OTHER',
    });
    expect(error).toBeTruthy();
  });
  it('rejects oversized image metadata (CHECK violation)', async () => {
    const issue = await findIssueByTitle('Broken library chair');
    await expectDbError('INVALID_FILE_SIZE', () =>
      student1.client.rpc('register_issue_image', {
        p_issue_id: issue.id, p_kind: 'EVIDENCE',
        p_storage_path: `${issue.id}/${student1.userId}/big.png`,
        p_file_size_bytes: 6000000, p_content_type: 'image/png',
      })
    );
  });
  it('rejects bad content type', async () => {
    const issue = await findIssueByTitle('Broken library chair');
    await expectDbError('INVALID_CONTENT_TYPE', () =>
      student1.client.rpc('register_issue_image', {
        p_issue_id: issue.id, p_kind: 'EVIDENCE',
        p_storage_path: `${issue.id}/${student1.userId}/doc.pdf`,
        p_file_size_bytes: 2048, p_content_type: 'application/pdf',
      })
    );
  });
});

// ---------- 12. CONCURRENCY ----------
describe('12. concurrency', () => {
  it('10 parallel votes by same user -> single row', async () => {
    const issue = await findIssueByTitle('Projector not working in Lab 2');
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => student1.client.rpc('cast_vote', { p_issue_id: issue.id }))
    );
    const okCount = results.filter((r) => r.status === 'fulfilled').length;
    expect(okCount).toBe(10); // all idempotent successes
    const { count } = await SERVICE_CLIENT
      .from('issue_votes').select('id', { count: 'exact', head: true })
      .eq('issue_id', issue.id).eq('voter_id', (await authId(USERS.student1)) as any);
    expect(count).toBe(1);
  });

  it('racing identical transitions -> exactly one wins', async () => {
    const created = await unwrap(await student1.client.rpc('create_issue', {
      p_title: `Race condition test ${Date.now()}`, p_description: 'Two transitions race on this issue.',
      p_category: 'OTHER', p_location_id: LOC.MAIN,
    }));
    await superAdmin.client.rpc('assign_issue', { p_issue_id: created.id, p_department_id: DEPT.CSE });
    // two identical ASSIGNED -> IN_PROGRESS transitions race:
    // row lock (FOR UPDATE) serializes them; the loser re-reads the row,
    // sees IN_PROGRESS, and IN_PROGRESS -> IN_PROGRESS is not in the graph
    const [r1, r2] = await Promise.allSettled([
      superAdmin.client.rpc('transition_issue_status', { p_issue_id: created.id, p_new_status: 'IN_PROGRESS' }),
      superAdmin.client.rpc('transition_issue_status', { p_issue_id: created.id, p_new_status: 'IN_PROGRESS' }),
    ]);
    const okCount = [r1, r2].filter((r) => r.status === 'fulfilled' && (r.value as { success?: boolean }).success === true).length;
    expect(okCount).toBe(1);
    const { data: finalRow } = await SERVICE_CLIENT.from('issues').select('status').eq('id', created.id).single();
    expect(finalRow!.status).toBe('IN_PROGRESS');
    // history contains exactly one ASSIGNED -> IN_PROGRESS entry
    const { data: hist } = await SERVICE_CLIENT
      .from('issue_status_history')
      .select('old_status, new_status')
      .eq('issue_id', created.id);
    const steps = (hist ?? []).map((h: { new_status: string }) => h.new_status);
    expect(steps.filter((s) => s === 'IN_PROGRESS').length).toBe(1);
  });
});

// unwrap supabase-js rpc() result: { data, error } -> data (throws on error)
async function unwrap<T>(res: { data: T | null; error: { message: string } | null }): Promise<T> {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

// helper: auth id by email
async function authId(email: string): Promise<string> {
  const { data } = await SERVICE_CLIENT.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const u = data!.users.find((x: { email?: string }) => x.email === email);
  if (!u) throw new Error(`user not found: ${email}`);
  return u.id;
}
