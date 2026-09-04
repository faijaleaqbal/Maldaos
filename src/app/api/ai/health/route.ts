/**
 * GET /api/ai/health
 *
 * Returns real provider activity (replacing the hardcoded
 * "GATEWAY ACTIVE" badge in the admin settings page). Pulls the last
 * 24 hours from public.ai_analysis via the ai_health_snapshot() RPC.
 */
import { NextRequest, NextResponse } from 'next/server';
import { readAIHealth, serviceClient } from '@/lib/server/ai/serverAI';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: NextRequest) {
  let snapshot: any[] = [];
  try {
    snapshot = await readAIHealth(serviceClient());
  } catch {
    snapshot = [];
  }
  // Derive a simple status from snapshot.
  const hasRecent = snapshot.length > 0;
  const realProviderSeen = snapshot.some(s => s.status === 'REAL_PROVIDER');
  return NextResponse.json({
    active: hasRecent,
    realProviderSeen,
    snapshot,
    fetchedAt: new Date().toISOString(),
  });
}
