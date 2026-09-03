/**
 * Seed script — creates auth users (via service-role admin API) and demo data.
 * Run: npm run seed   (requires .env with SUPABASE_SERVICE_ROLE_KEY)
 * All passwords are LOCAL TEST credentials (SEED_PASSWORD env, default TestPass123!).
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

// tiny .env loader (no dependency)
try { Object.assign(process.env, parseEnv(readFileSync('.env', 'utf8'))); } catch {}
function parseEnv(s: string) {
  const out: Record<string, string> = {};
  for (const line of s.split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

const URL = process.env.SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASS = process.env.SEED_PASSWORD || 'TestPass123!';
const db = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

async function upsertUser(email: string, fullName: string) {
  const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const found = list?.users?.find((u: { email?: string }) => u.email === email);
  if (found) return found.id;
  const { data: created, error } = await db.auth.admin.createUser({
    email,
    password: PASS,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) throw new Error(`seed: createUser ${email}: ${error.message}`);
  return created!.user!.id;
}

async function main() {
  console.log('Seeding CampusPulse local data...');

  // 1) college
  const { data: college, error: colErr } = await db.from('colleges').upsert({ name: 'Malda College' }, { onConflict: 'name' }).select().single();
  if (colErr) throw new Error('college upsert failed: ' + JSON.stringify(colErr));
  const collegeId = college!.id;

  // 2) departments
  const { data: depts } = await db
    .from('departments')
    .upsert(
      [
        { college_id: collegeId, name: 'Computer Science', code: 'CSE' },
        { college_id: collegeId, name: 'Electronics', code: 'ECE' },
        { college_id: collegeId, name: 'Facilities', code: 'FAC' },
      ],
      { onConflict: 'college_id,code' }
    )
    .select();
  const deptByCode = Object.fromEntries((depts ?? []).map((d: { code: string; id: string }) => [d.code, d.id]));

  // 3) locations
  const { data: locs } = await db
    .from('locations')
    .upsert(
      [
        { college_id: collegeId, name: 'Main Block', code: 'MAIN' },
        { college_id: collegeId, name: 'Library', code: 'LIB' },
        { college_id: collegeId, name: 'Hostel A', code: 'HOST-A' },
        { college_id: collegeId, name: 'Cafeteria', code: 'CAF' },
        { college_id: collegeId, name: 'Sports Ground', code: 'SPORT' },
      ],
      { onConflict: 'college_id,code' }
    )
    .select();
  const locByCode = Object.fromEntries((locs ?? []).map((l: { code: string; id: string }) => [l.code, l.id]));

  // 4) auth users (profile rows auto-created by trigger with role STUDENT)
  const student1 = await upsertUser('student1@campus.test', 'Aarav Student');
  const student2 = await upsertUser('student2@campus.test', 'Diya Student');
  const staffCse = await upsertUser('staff.cse@campus.test', 'Ravi Staff CSE');
  const staffEce = await upsertUser('staff.ece@campus.test', 'Meera Staff ECE');
  const staffFac = await upsertUser('staff.fac@campus.test', 'Kiran Staff FAC');
  const deptAdmin = await upsertUser('admin.cse@campus.test', 'Dr. Sen Dept Admin');
  const superAdmin = await upsertUser('super@campus.test', 'Principal Super');

  // 5) upsert ALL profile rows (trusted seed path — covers users created
  //    before a db reset, whose trigger-created profiles no longer exist)
  const { data: _roleRows, error: profErr } = await db
    .from('profiles')
    .upsert(
      [
        { id: student1, college_id: collegeId, department_id: null, role: 'STUDENT', full_name: 'Aarav Student' },
        { id: student2, college_id: collegeId, department_id: null, role: 'STUDENT', full_name: 'Diya Student' },
        { id: staffCse, college_id: collegeId, department_id: deptByCode.CSE, role: 'STAFF', full_name: 'Ravi Staff CSE' },
        { id: staffEce, college_id: collegeId, department_id: deptByCode.ECE, role: 'STAFF', full_name: 'Meera Staff ECE' },
        { id: staffFac, college_id: collegeId, department_id: deptByCode.FAC, role: 'STAFF', full_name: 'Kiran Staff FAC' },
        { id: deptAdmin, college_id: collegeId, department_id: deptByCode.CSE, role: 'DEPARTMENT_ADMIN', full_name: 'Dr. Sen Dept Admin' },
        { id: superAdmin, college_id: collegeId, department_id: null, role: 'SUPER_ADMIN', full_name: 'Principal Super' },
      ],
      { onConflict: 'id' }
    )
    .select();
  if (profErr) throw new Error('profiles upsert failed: ' + JSON.stringify(profErr));
  console.log('users + roles seeded');

  // 6) sample issues (direct insert via service key — trusted seed path;
  //    re-runnable: delete demo rows by fixed titles first)
  const demoTitles = [
    'Broken library chair',
    'Projector not working in Lab 2',
    'Water cooler leaking in Hostel A',
    'Cafeteria hygiene issue',
    'Flooded sports ground corner',
  ];
  const { data: old } = await db.from('issues').select('id').in('title', demoTitles);
  if (old && old.length) await db.from('issues').delete().in('id', old.map((r: { id: string }) => r.id));

  const { data: issues, error: insertErr } = await db
    .from('issues')
    .insert([
      {
        college_id: collegeId, student_id: student1, department_id: null, location_id: locByCode.LIB,
        title: 'Broken library chair', description: 'Chair on the second floor of the library has a broken backrest.',
        category: 'INFRASTRUCTURE', priority: 'MEDIUM', status: 'OPEN', is_anonymous: false,
      },
      {
        college_id: collegeId, student_id: student2, department_id: deptByCode.CSE, location_id: locByCode.MAIN,
        title: 'Projector not working in Lab 2', description: 'Ceiling projector in Computer Lab 2 flickers and shuts off.',
        category: 'ACADEMICS', priority: 'HIGH', status: 'ASSIGNED', is_anonymous: false,
      },
      {
        college_id: collegeId, student_id: student1, department_id: deptByCode.FAC, location_id: locByCode['HOST-A'],
        title: 'Water cooler leaking in Hostel A', description: 'The ground floor water cooler has been leaking for three days.',
        category: 'HOSTEL', priority: 'URGENT', status: 'IN_PROGRESS', is_anonymous: false,
      },
      {
        college_id: collegeId, student_id: student2, department_id: deptByCode.FAC, location_id: locByCode.CAF,
        title: 'Cafeteria hygiene issue', description: 'Tables near the counter are not being cleaned regularly.',
        category: 'CLEANLINESS', priority: 'MEDIUM', status: 'RESOLVED', is_anonymous: false,
        resolution_summary: 'Cleaning schedule enforced and extra bins added.', resolved_at: new Date(Date.now() - 3600_000 * 24).toISOString(),
      },
      {
        college_id: collegeId, student_id: student1, department_id: null, location_id: locByCode.SPORT,
        title: 'Flooded sports ground corner', description: 'The north-east corner of the ground stays waterlogged after rain.',
        category: 'INFRASTRUCTURE', priority: 'LOW', status: 'OPEN', is_anonymous: true,
      },
    ])
    .select();
  if (insertErr) throw new Error('issues insert failed: ' + JSON.stringify(insertErr));
  if (!issues || issues.length === 0) throw new Error('issues insert returned nothing');
  console.log(`issues seeded: ${issues.length}`);

  const assigned = issues!.find((i: { status: string }) => i.status === 'ASSIGNED');
  const inprog = issues!.find((i: { status: string }) => i.status === 'IN_PROGRESS');
  const resolved = issues!.find((i: { status: string }) => i.status === 'RESOLVED');

  // 7) assignments + history + votes + comments (trusted seed path)
  await db.from('issue_assignments').insert([
    { issue_id: assigned!.id, department_id: deptByCode.CSE, assigned_to: staffCse, assigned_by: deptAdmin, note: 'CSE lab equipment' },
    { issue_id: inprog!.id, department_id: deptByCode.FAC, assigned_to: staffFac, assigned_by: superAdmin, note: 'Plumbing' },
    { issue_id: resolved!.id, department_id: deptByCode.FAC, assigned_to: staffFac, assigned_by: superAdmin, note: 'Cleaning' },
  ]);
  await db.from('issue_status_history').insert([
    { issue_id: assigned!.id, old_status: 'OPEN', new_status: 'ASSIGNED', changed_by: deptAdmin, reason: 'Assigned to CSE' },
    { issue_id: inprog!.id, old_status: 'OPEN', new_status: 'ASSIGNED', changed_by: superAdmin, reason: 'Assigned to FAC' },
    { issue_id: inprog!.id, old_status: 'ASSIGNED', new_status: 'IN_PROGRESS', changed_by: staffFac, reason: 'Repair started' },
    { issue_id: resolved!.id, old_status: 'OPEN', new_status: 'ASSIGNED', changed_by: superAdmin, reason: 'Assigned to FAC' },
    { issue_id: resolved!.id, old_status: 'ASSIGNED', new_status: 'IN_PROGRESS', changed_by: staffFac, reason: 'Cleaning in progress' },
    { issue_id: resolved!.id, old_status: 'IN_PROGRESS', new_status: 'RESOLVED', changed_by: staffFac, reason: 'Cleaning schedule enforced' },
  ]);
  await db.from('issue_votes').insert([
    { issue_id: assigned!.id, voter_id: student1 },
    { issue_id: inprog!.id, voter_id: student2 },
  ]);
  await db.from('issue_comments').insert([
    { issue_id: assigned!.id, author_id: staffCse, body: 'We have ordered a replacement bulb.', is_internal: false },
    { issue_id: assigned!.id, author_id: staffCse, body: 'Vendor quote pending.', is_internal: true },
    { issue_id: inprog!.id, author_id: staffFac, body: 'Plumber visited, parts needed.', is_internal: false },
  ]);
  await db.from('notifications').insert([
    { user_id: student2, issue_id: assigned!.id, type: 'ISSUE_ASSIGNED', payload: { department: 'CSE' } },
    { user_id: student1, issue_id: inprog!.id, type: 'STATUS_CHANGED', payload: { status: 'IN_PROGRESS' } },
  ]);

  console.log('Seed complete.');
  console.log(`users: student1@campus.test, student2@campus.test, staff.cse@campus.test, staff.ece@campus.test, staff.fac@campus.test, admin.cse@campus.test (dept admin CSE), super@campus.test (super admin)`);
  console.log(`password for all: ${PASS}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
