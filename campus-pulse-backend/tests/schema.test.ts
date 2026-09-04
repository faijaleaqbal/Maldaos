/**
 * SCHEMA VERIFICATION — self-check that the database under test actually
 * matches the migrations this package ships:
 *   1. all expected tables exist (12)
 *   2. enums carry EXACTLY the contract values (no drift)
 *   3. every user table has RLS enabled (no silently unprotected tables)
 *   4. all guarded RPCs exist and are SECURITY DEFINER
 *   5. storage buckets are private
 *   6. protected-column guard triggers exist
 *   7. issue_images CHECK constraints intact (mime/size)
 * Fails loudly on any drift — protects against "tests pass against a
 * stale/foreign database" false confidence.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { SERVICE } from './helpers.js';

try { Object.assign(process.env, parseEnv(readFileSync('.env', 'utf8'))); } catch {}
function parseEnv(s: string) {
  const out: Record<string, string> = {};
  for (const line of s.split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
let pool: pg.Pool;

beforeAll(() => { pool = new pg.Pool({ connectionString: DB_URL }); });
afterAllClose();
function afterAllClose() { /* closed in afterAll below */ }
import { afterAll } from 'vitest';
afterAll(async () => { await pool?.end(); });

const TABLES = ['colleges','departments','locations','profiles','issues','issue_images',
  'issue_votes','issue_assignments','issue_status_history','issue_comments',
  'notifications','audit_logs'];

const EXPECTED_ENUMS: Record<string, string[]> = {
  user_role: ['STUDENT','STAFF','DEPARTMENT_ADMIN','SUPER_ADMIN'],
  issue_status: ['OPEN','ASSIGNED','IN_PROGRESS','RESOLVED','CLOSED'],
  issue_category: ['INFRASTRUCTURE','ACADEMICS','HOSTEL','CLEANLINESS','SAFETY','OTHER'],
  priority: ['LOW','MEDIUM','HIGH','URGENT'],
  image_kind: ['EVIDENCE','RESOLUTION_PROOF'],
};

const EXPECTED_RPCS = ['create_issue','assign_issue','transition_issue_status','cast_vote',
  'add_comment','register_issue_image','read_notification','change_profile_role','admin_stats'];

const GUARD_TRIGGERS = ['trg_issues_guard','trg_issue_votes_guard','trg_issue_images_guard','trg_profiles_guard'];

describe('schema verification: migrations applied exactly', () => {
  it('all 12 tables exist', async () => {
    const { rows } = await pool.query(
      `select table_name from information_schema.tables
       where table_schema='public' and table_type='BASE TABLE'`);
    const names = rows.map((r: { table_name: string }) => r.table_name);
    for (const t of TABLES) expect(names).toContain(t);
  });

  it('enum values match the contract exactly (no drift)', async () => {
    const { rows } = await pool.query(
      `select t.typname, array_agg(e.enumlabel order by e.enumsortorder) as vals
       from pg_type t join pg_enum e on e.enumtypid = t.oid
       where t.typname = any($1) group by t.typname`,
      [Object.keys(EXPECTED_ENUMS)]);
    const got: Record<string, string[]> = {};
    for (const r of rows as { typname: string; vals: string[] | string }[]) {
      const v = r.vals;
      got[r.typname] = Array.isArray(v) ? v : String(v).replace(/^\{|\}$/g, '').split(',');
    }
    for (const [name, vals] of Object.entries(EXPECTED_ENUMS)) {
      expect(got[name], `enum ${name} missing — migration drift`).toBeDefined();
      expect(got[name]).toEqual(vals);
    }
  });

  it('RLS is ENABLED on every user table', async () => {
    const { rows } = await pool.query(
      `select tablename from pg_tables where schemaname='public' and rowsecurity = false`);
    const unprotected = rows.map((r: { tablename: string }) => r.tablename);
    for (const t of TABLES) {
      expect(unprotected, `RLS disabled on ${t}`).not.toContain(t);
    }
  });

  it('all guarded RPCs exist as SECURITY DEFINER', async () => {
    const { rows } = await pool.query(
      `select p.proname, p.prosecdef from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       where n.nspname='public' and p.proname = any($1)`,
      [EXPECTED_RPCS]);
    const got = new Set((rows as { proname: string; prosecdef: boolean }[]).map(r => r.proname));
    for (const fn of EXPECTED_RPCS) expect(got.has(fn), `RPC missing: ${fn}`).toBe(true);
    for (const r of rows as { proname: string; prosecdef: boolean }[]) {
      expect(r.prosecdef, `RPC ${r.proname} is not SECURITY DEFINER`).toBe(true);
    }
  });

  it('storage buckets are private', async () => {
    const { rows } = await pool.query(
      `select id, public from storage.buckets where id in ('issue-photos','resolution-proofs')`);
    expect(rows.length).toBe(2);
    for (const r of rows as { id: string; public: boolean }[]) {
      expect(r.public, `bucket ${r.id} must be private`).toBe(false);
    }
  });

  it('guard triggers exist on protected tables', async () => {
    const { rows } = await pool.query(
      `select t.tgname from pg_trigger t
       join pg_class c on c.oid = t.tgrelid
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname='public' and not t.tgisinternal`);
    const names = new Set((rows as { tgname: string }[]).map(r => r.tgname));
    for (const tg of GUARD_TRIGGERS) expect(names.has(tg), `trigger missing: ${tg}`).toBe(true);
  });

  it('issue_images CHECK constraints (mime allowlist, 5MB cap) present', async () => {
    const { rows } = await pool.query(
      `select conname, pg_get_constraintdef(oid) as def
       from pg_constraint where conrelid = 'public.issue_images'::regclass and contype='c'`);
    const defs = (rows as { def: string }[]).map(r => r.def).join(' ');
    expect(defs).toMatch(/image\/jpeg/);
    expect(defs).toMatch(/5242880/);
  });
});
