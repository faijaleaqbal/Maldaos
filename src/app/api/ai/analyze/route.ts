import { NextRequest, NextResponse } from 'next/server';
import { AIService } from '@/services/ai.service';

// Server-side AI Gateway (never bundled to the client; provider keys stay server-only)
// Lazy-import the workspace package so the route stays callable even if the
// gateway dependency is absent (fallback keeps the workflow unblocked).
async function getGatewayFeatures() {
  try {
    const mod = await import('@campuspulse/ai-gateway');
    const gateway = mod.createGatewayFromEnv({ logger: mod.createConsoleLogger() });
    return { gateway, features: mod.Features as typeof import('@campuspulse/ai-gateway').Features };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, description, building } = body;

    if (!title || !description) {
      return NextResponse.json(
        { error: 'Missing title or description for AI analysis' },
        { status: 400 }
      );
    }

    // Prefer the real AI gateway (server-side; provider fallback chain ends in
    // deterministic mode — an explicit, labelled fallback, never silent mock).
    const gw = await getGatewayFeatures();
    if (gw) {
      const result = await gw.features.analyzeIssue(gw.gateway, {
        title,
        description,
        location: building || 'Campus Facility',
      });

      // Authentic enum mappings from AI Gateway contracts to MaldaOS domain model
      const mapPriority = (p?: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' => {
        switch (p) {
          case 'P1': return 'URGENT';
          case 'P2': return 'HIGH';
          case 'P3': return 'MEDIUM';
          case 'P4': return 'LOW';
          default: return 'MEDIUM';
        }
      };

      const mapSeverity = (s?: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' => {
        switch (s?.toLowerCase()) {
          case 'critical': return 'URGENT';
          case 'high': return 'HIGH';
          case 'medium': return 'MEDIUM';
          case 'low': return 'LOW';
          default: return 'MEDIUM';
        }
      };

      const mapCategory = (c?: string): 'INFRASTRUCTURE' | 'ACADEMICS' | 'HOSTEL' | 'CLEANLINESS' | 'SAFETY' | 'OTHER' => {
        const val = c?.toLowerCase() || '';
        if (val === 'infrastructure' || val === 'electrical' || val === 'plumbing') return 'INFRASTRUCTURE';
        if (val === 'academics' || val === 'academic' || val === 'it_network' || val === 'it') return 'ACADEMICS';
        if (val === 'hostel') return 'HOSTEL';
        if (val === 'cleanliness' || val === 'sanitation') return 'CLEANLINESS';
        if (val === 'safety' || val === 'security') return 'SAFETY';
        return 'OTHER';
      };

      return NextResponse.json({
        detectedCategory: mapCategory(result.analysis.category),
        suggestedSeverity: mapSeverity(result.analysis.severity),
        suggestedPriority: mapPriority(result.analysis.priority),
        confidence: result.analysis.confidence,
        summary: result.analysis.summary,
        reasoning: result.analysis.reasoning,
        gatewayProvider: result.provider,
        isFallback: result.fallback,
        analyzedAt: new Date().toISOString(),
      });
    }

    // Gateway unavailable — deterministic triage, explicitly labelled as heuristic
    const analysis = AIService.generateDeterministicTriage(
      title,
      description,
      building || 'Campus Facility',
      []
    );
    return NextResponse.json({ ...analysis, gatewayProvider: 'deterministic-heuristic', isFallback: true });
  } catch (error: any) {
    return NextResponse.json(
      AIService.getFallbackAnalysis('AI gateway error. Manual triage enabled.'),
      { status: 200 }
    );
  }
}
