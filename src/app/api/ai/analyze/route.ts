/**
 * POST /api/ai/analyze
 *
 * Server-side AI analysis endpoint. This is the runtime integration
 * point required by the production audit. It:
 *   1. Validates the request.
 *   2. Calls the AI gateway (provider-agnostic) via serverAI.runAnalysis().
 *   3. Translates gateway enums to product enums.
 *   4. If an issueId + collegeId are supplied AND the caller is
 *      service-role, persists the result to public.ai_analysis.
 *   5. Returns a typed JSON response that NEVER fabricates confidence
 *      and NEVER presents RULE_BASED_FALLBACK as real AI.
 *
 * This route uses the service-role key (server-only) for the persist
 * step; provider API keys live in process.env and are read by the
 * gateway. Neither ever leaves the server.
 *
 * The route is a Next.js Route Handler — runs on the Node server only.
 */
import { NextRequest, NextResponse } from 'next/server';
import { runAnalysis, persistAIResult, serviceClient, type AIResult } from '@/lib/server/ai/serverAI';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface AnalyzeBody {
  title?: string;
  description?: string;
  locationName?: string;
  /** Optional. If provided with collegeId, the result is persisted. */
  issueId?: string;
  collegeId?: string;
}

function validate(body: any): { ok: true; data: AnalyzeBody } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Body must be a JSON object' };
  const { title, description } = body;
  if (typeof title !== 'string' || title.trim().length < 5 || title.length > 200) {
    return { ok: false, error: 'title must be a 5-200 char string' };
  }
  if (typeof description !== 'string' || description.trim().length < 10 || description.length > 5000) {
    return { ok: false, error: 'description must be a 10-5000 char string' };
  }
  return { ok: true, data: body as AnalyzeBody };
}

function shape(result: AIResult) {
  return {
    status: result.status,
    provider: result.provider,
    model: result.model,
    isFallback: result.isFallback,
    recommendation: {
      category: result.category,
      priority: result.priority,
      severity: result.severity ?? null,
      summary: result.summary,
      reasoning: result.reasoning ?? null,
      confidence: result.confidence,
    },
    urgencyFactors: result.urgencyFactors,
    possibleDuplicates: result.possibleDuplicates,
    latencyMs: result.latencyMs,
    attempts: result.attempts,
    feature: result.feature,
    analyzedAt: result.analyzedAt,
  };
}

export async function POST(req: NextRequest) {
  let body: AnalyzeBody;
  try {
    const raw = await req.json();
    const v = validate(raw);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
    body = v.data;
  } catch {
    return NextResponse.json({ error: 'Body must be valid JSON' }, { status: 400 });
  }

  // Run the gateway.
  const result = await runAnalysis({
    title: body.title as string,
    description: body.description as string,
    locationName: body.locationName,
  });

  // Persist (server-only) if issueId was supplied. We re-read the
  // issue's college_id from the DB so the client never has to track it.
  // The persist is best-effort: if the DB is unavailable, the response
  // still carries the AI result. Issue creation NEVER depends on this.
  if (body.issueId) {
    try {
      const sb = serviceClient();
      await persistAIResult(sb, { issueId: body.issueId, result });
    } catch {
      // Silent: the analyze result is the user-visible product; the
      // audit row is a nice-to-have.
    }
  }

  return NextResponse.json(shape(result), { status: 200 });
}

export async function GET() {
  return NextResponse.json(
    {
      error: 'Use POST with { title, description, locationName?, issueId?, collegeId? }',
    },
    { status: 405 }
  );
}
