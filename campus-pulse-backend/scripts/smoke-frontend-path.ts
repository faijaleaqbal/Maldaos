/**
 * SMOKE — the exact end-to-end path the frontend now performs in LIVE mode:
 * student login → create_issue → evidence upload (storage) → register metadata
 * → track → dept-admin assign_issue → staff IN_PROGRESS → resolution proof
 * upload+register → RESOLVED with reason → super-admin CLOSED.
 *
 * Uses ONLY anon-key clients with user JWTs (like the browser) — proves the
 * whole chain works without service-role exposure.
 *
 * Run: cd campus-pulse-backend && npx tsx scripts/smoke-frontend-path.ts
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

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
const ANON = process.env.SUPABASE_ANON_KEY!;
const PASS = process.env.SEED_PASSWORD || 'TestPass123!';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) { console.error(`FAIL: ${msg}`); process.exit(1); }
  console.log(`PASS: ${msg}`);
}

async function login(email: string) {
  const boot = createClient(URL, ANON);
  const { data, error } = await boot.auth.signInWithPassword({ email, password: PASS });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return createClient(URL, ANON, {
    global: { headers: { Authorization: `Bearer ${data.session!.access_token}` } },
    auth: { persistSession: false },
  });
}

const PNG = Uint8Array.from(atob(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
), (c) => c.charCodeAt(0));

async function main() {
  console.log('=== SMOKE: frontend live-mode path (anon key + user JWTs only) ===');
  const student = await login('student1@campus.test');
  const deptAdmin = await login('admin.cse@campus.test');
  const staff = await login('staff.cse@campus.test');
  const superAdmin = await login('super@campus.test');

  // locations/departments (frontend fetches these for pickers)
  const { data: locs } = await student.from('locations').select('id, name, code');
  const { data: depts } = await student.from('departments').select('id, name, code');
  assert(locs && locs.length > 0, 'student can list locations');
  assert(depts && depts.length > 0, 'student can list departments');
  const loc = locs![0].id;
  const cse = depts!.find((d: { code: string }) => d.code === 'CSE')!.id;

  // student: create issue (frontend createIssue → RPC)
  const { data: issue, error: cErr } = await student.rpc('create_issue', {
    p_title: `SMOKE: fan not working in reading room ${Date.now()}`,
    p_description: 'Ceiling fan above the reading desk is not spinning.',
    p_category: 'INFRASTRUCTURE', p_priority: 'HIGH',
    p_location_id: loc, p_department_id: null, p_is_anonymous: false,
  });
  assert(!cErr && issue, 'student create_issue RPC ok');
  const issueId = (issue as { id: string }).id;

  // student: upload evidence (storage + register metadata — exactly like ImageUploader path)
  const path = `${issueId}/${(await student.auth.getUser()).data.user!.id}/evidence-${Date.now()}.png`;
  const up = await student.storage.from('issue-photos').upload(path, PNG, { contentType: 'image/png' });
  assert(!up.error, 'student evidence upload to private issue-photos bucket');
  const reg = await student.rpc('register_issue_image', {
    p_issue_id: issueId, p_kind: 'EVIDENCE', p_storage_path: path,
    p_file_size_bytes: PNG.length, p_content_type: 'image/png',
  });
  assert(!reg.error, 'register_issue_image (EVIDENCE) ok');

  // student: track (getIssueById)
  const { data: tracked } = await student.from('issues').select('id, status, priority').eq('id', issueId).single();
  assert(tracked?.status === 'OPEN', 'student tracks issue (OPEN)');

  // dept admin: assign (assign_issue RPC)
  const { error: aErr } = await deptAdmin.rpc('assign_issue', {
    p_issue_id: issueId, p_department_id: cse, p_staff_id: null, p_note: 'Handle fan repair',
  });
  assert(!aErr, 'dept-admin assign_issue ok');

  // staff: IN_PROGRESS
  const { error: ipErr } = await staff.rpc('transition_issue_status', { p_issue_id: issueId, p_new_status: 'IN_PROGRESS' });
  assert(!ipErr, 'staff IN_PROGRESS transition ok');

  // staff: resolution proof upload + register
  const staffId = (await staff.auth.getUser()).data.user!.id;
  const proofPath = `${issueId}/${staffId}/proof-${Date.now()}.png`;
  const pUp = await staff.storage.from('resolution-proofs').upload(proofPath, PNG, { contentType: 'image/png' });
  assert(!pUp.error, 'staff resolution-proof upload ok');
  const pReg = await staff.rpc('register_issue_image', {
    p_issue_id: issueId, p_kind: 'RESOLUTION_PROOF', p_storage_path: proofPath,
    p_file_size_bytes: PNG.length, p_content_type: 'image/png',
  });
  assert(!pReg.error, 'register_issue_image (RESOLUTION_PROOF) ok');

  // staff: RESOLVED with reason
  const { error: rErr } = await staff.rpc('transition_issue_status', {
    p_issue_id: issueId, p_new_status: 'RESOLVED', p_reason: 'Fan motor replaced and tested.',
  });
  assert(!rErr, 'staff RESOLVED with reason ok');

  // super admin: CLOSED
  const { error: clErr } = await superAdmin.rpc('transition_issue_status', { p_issue_id: issueId, p_new_status: 'CLOSED' });
  assert(!clErr, 'super-admin CLOSED ok');

  // audit history (super admin view — frontend admin pages)
  const { data: audit } = await superAdmin.from('audit_logs').select('action').eq('entity_id', issueId);
  const actions = (audit ?? []).map((a: { action: string }) => a.action);
  assert(actions.includes('ISSUE_ASSIGNED') && actions.includes('STATUS_CHANGED'), 'audit history present');

  const { data: hist } = await superAdmin.from('issue_status_history')
    .select('new_status').eq('issue_id', issueId).order('created_at');
  const seq = (hist ?? []).map((h: { new_status: string }) => h.new_status);
  assert(JSON.stringify(seq) === JSON.stringify(['ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']), `status history ordered: ${seq.join(' → ')}`);

  console.log('\n=== SMOKE COMPLETE: full live-mode path verified ===');
}

main().catch((e) => { console.error('SMOKE FAILED:', e); process.exit(1); });
