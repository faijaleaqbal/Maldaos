/**
 * GET /api/ai/latest?issueId=...
 *
 * Reads the latest persisted AI analysis for an issue. Used by the
 * issue detail page to populate the AI panel from real DB data.
 */
import { NextRequest, NextResponse } from 'next/server';
import { readLatestAI, dbRowToAIResult, serviceClient } from '@/lib/server/ai/serverAI';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const issueId = url.searchParams.get('issueId');
  if (!issueId) return NextResponse.json({ error: 'issueId is required' }, { status: 400 });
  const result = await readLatestAI(serviceClient(), issueId);
  if (!result) return NextResponse.json({ found: false }, { status: 200 });
  return NextResponse.json({ found: true, result });
}
