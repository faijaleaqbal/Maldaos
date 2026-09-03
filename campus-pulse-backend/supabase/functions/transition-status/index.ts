// Edge function: transition-status
// Thin, JWT-verified wrapper around transition_issue_status() SECURITY DEFINER RPC.
// Deploy: supabase functions deploy transition-status
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

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

  let body: { issue_id?: string; new_status?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return json('INVALID_BODY', 'Body must be JSON', 400);
  }
  const issueId = body.issue_id?.trim();
  const newStatus = body.new_status?.trim();
  if (!issueId) return json('INVALID_INPUT', 'issue_id is required', 400);
  if (!newStatus || !STATUSES.includes(newStatus)) {
    return json('INVALID_INPUT', `new_status must be one of: ${STATUSES.join(', ')}`, 400);
  }

  const supabase = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { error } = await supabase.rpc('transition_issue_status', {
    p_issue_id: issueId,
    p_new_status: newStatus,
    p_reason: body.reason ?? null,
  });

  if (error) {
    const m = error.message.match(/^([A-Z_]+):\s*(.*)$/);
    const code = m ? m[1] : 'INTERNAL';
    const msg = m ? m[2] : error.message;
    const status =
      code === 'FORBIDDEN' || code === 'REOPEN_WINDOW_EXPIRED' ? 403
      : code === 'NOT_FOUND' ? 404
      : code === 'INVALID_TRANSITION' || code === 'RESOLUTION_REASON_REQUIRED' || code.startsWith('INVALID') ? 400
      : 500;
    return json(code, msg, status);
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
});
