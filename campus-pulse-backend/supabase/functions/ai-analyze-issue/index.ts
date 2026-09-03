// Edge function: ai-analyze-issue
// Returns AI recommendations (category, priority, severity, summary, confidence)
// for an existing issue. AI is ALWAYS a recommendation: this function NEVER
// mutates the issue row, never closes, never assigns.
//
// Auth: bearer token required; RLS on ai_analysis/issue controls access.
// Failure: returns 200 with { aiUnavailable: true, summary: "AI analysis unavailable." }
// so the issue workflow can continue.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
function err(code: string, message: string, status: number, details?: unknown) {
  return json({ error: { code, message, ...(details ? { details } : {}) } }, status);
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return err('INVALID_METHOD', 'Use POST', 405);
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return err('AUTH_REQUIRED', 'Missing bearer token', 401);

  let body: { issue_id?: string };
  try { body = await req.json(); } catch { return err('INVALID_BODY', 'Body must be JSON', 400); }
  const issueId = body.issue_id?.trim();
  if (!issueId) return err('INVALID_INPUT', 'issue_id is required', 400);

  const supabase = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  // Load the issue (RLS enforces visibility).
  const { data: issue, error: ie } = await supabase
    .from('issues')
    .select('id, college_id, title, description, category, priority, status, locations(name)')
    .eq('id', issueId)
    .maybeSingle();
  if (ie) return err('INTERNAL', ie.message, 500);
  if (!issue) return err('NOT_FOUND', 'issue not found', 404);

  // Re-run analysis server-side: this edge function is the integration
  // point, but the actual AI call must be initiated from the Node backend
  // because the AI provider SDK requires Node APIs and the service-role
  // key never leaves the server. The frontend should call the Node
  // service's createIssueWithAI() instead, or use the latest_ai_analysis
  // RPC to read an already-persisted analysis.
  //
  // To keep the surface minimal and prevent the browser from making
  // direct provider calls, this function only RE-READS the latest
  // stored analysis; the AI is invoked at create-time by the backend.
  const { data: ai, error: ae } = await supabase.rpc('latest_ai_analysis', { p_issue_id: issueId });
  if (ae) return err('INTERNAL', ae.message, 500);

  if (!ai) {
    return json({
      issue_id: issueId,
      aiUnavailable: true,
      summary: 'AI analysis unavailable.',
      reason: 'no analysis on record; create the issue via the backend to trigger AI',
    });
  }
  return json({
    issue_id: issueId,
    aiUnavailable: ai.status === 'fallback',
    category: ai.category_recommended,
    severity: ai.severity_recommended,
    priority: ai.priority_recommended,
    summary: ai.summary,
    confidence: ai.confidence,
    reasoning: ai.reasoning,
    provider: ai.provider,
    model: ai.model,
    status: ai.status,
    latency_ms: ai.latency_ms,
    created_at: ai.created_at,
  });
});
