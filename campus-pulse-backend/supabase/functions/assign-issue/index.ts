// Edge function: assign-issue
// Thin, JWT-verified wrapper around the assign_issue() SECURITY DEFINER RPC.
// Deploy: supabase functions deploy assign-issue
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

function json(code: string, message: string, status: number, details?: unknown) {
  return new Response(JSON.stringify({ error: { code, message, ...(details ? { details } : {}) } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json('INVALID_METHOD', 'Use POST', 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json('AUTH_REQUIRED', 'Missing bearer token', 401);

  let body: { issue_id?: string; department_id?: string; staff_id?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return json('INVALID_BODY', 'Body must be JSON', 400);
  }
  const issueId = body.issue_id?.trim();
  const departmentId = body.department_id?.trim();
  if (!issueId || !departmentId) return json('INVALID_INPUT', 'issue_id and department_id are required', 400);

  // Act as the CALLING USER — all permission checks happen in the DB (RPC + RLS)
  const supabase = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { error } = await supabase.rpc('assign_issue', {
    p_issue_id: issueId,
    p_department_id: departmentId,
    p_staff_id: body.staff_id ?? null,
    p_note: body.note ?? null,
  });

  if (error) {
    const m = error.message.match(/^([A-Z_]+):\s*(.*)$/);
    const code = m ? m[1] : 'INTERNAL';
    const msg = m ? m[2] : error.message;
    const status = code === 'FORBIDDEN' ? 403 : code === 'NOT_FOUND' ? 404 : code.startsWith('INVALID') ? 400 : 500;
    return json(code, msg, status);
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
});
