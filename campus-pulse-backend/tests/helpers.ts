import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

/** Load .env (test root is project root). */
try { Object.assign(process.env, parseEnv(readFileSync('.env', 'utf8'))); } catch {}
function parseEnv(s: string) {
  const out: Record<string, string> = {};
  for (const line of s.split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

export const URL = process.env.SUPABASE_URL!;
export const ANON = process.env.SUPABASE_ANON_KEY!;
export const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
export const SEED_PASSWORD = process.env.SEED_PASSWORD || 'TestPass123!';

export const SERVICE_CLIENT = createClient(URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export const ANON_CLIENT = createClient(URL, ANON);

export interface Session { client: SupabaseClient; userId: string; token: string; }

/** Sign in as a seeded user and return a client bound to their JWT. */
export async function signInAs(email: string): Promise<Session> {
  const boot = createClient(URL, ANON);
  const { data, error } = await boot.auth.signInWithPassword({ email, password: SEED_PASSWORD });
  if (error) throw new Error(`signInAs(${email}) failed: ${error.message}`);
  const token = data.session!.access_token;
  const client = createClient(URL, ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  return { client, userId: data.user!.id, token };
}

export const USERS = {
  student1: 'student1@campus.test',
  student2: 'student2@campus.test',
  staffCse: 'staff.cse@campus.test',
  staffEce: 'staff.ece@campus.test',
  staffFac: 'staff.fac@campus.test',
  deptAdminCse: 'admin.cse@campus.test',
  superAdmin: 'super@campus.test',
};

/** Expect a Supabase call whose result contains an error with the code prefix.
 *  Handles both supabase-js ({data, error} results) and thrown exceptions. */
export async function expectDbError(code: string, fn: () => PromiseLike<unknown> | unknown): Promise<string> {
  let res: unknown;
  try {
    res = await fn();
  } catch (e) {
    const msg = (e as { message?: string })?.message ?? String(e);
    if (!msg.includes(code)) throw new Error(`expected error containing "${code}", got: ${msg}`);
    return msg;
  }
  // supabase-js resolves with { data, error } instead of throwing
  const err = (res as { error?: { message?: string } | null })?.error;
  if (!err) throw new Error(`expected error containing "${code}", but call succeeded`);
  const msg = err.message ?? String(err);
  if (!msg.includes(code)) throw new Error(`expected error containing "${code}", got: ${msg}`);
  return msg;
}

/** Find a seeded demo row. */
export async function findIssueByTitle(title: string) {
  const { data } = await SERVICE_CLIENT.from('issues').select('*').eq('title', title).maybeSingle();
  if (!data) throw new Error(`seed issue not found: ${title}`);
  return data as { id: string; status: string; student_id: string; department_id: string | null; is_anonymous: boolean };
}

export async function idOf(email: string): Promise<string> {
  const { data } = await SERVICE_CLIENT.from('profiles').select('id').eq('id', (await emailToAuthId(email)) as any).maybeSingle();
  return data!.id;
}
async function emailToAuthId(email: string): Promise<string> {
  const { data } = await SERVICE_CLIENT.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const u = data!.users.find((x: { email?: string }) => x.email === email);
  if (!u) throw new Error(`user not found: ${email}`);
  return u.id;
}
