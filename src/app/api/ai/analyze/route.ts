import { NextRequest, NextResponse } from 'next/server';
import { AIService } from '@/services/ai.service';
import { MOCK_BUILDINGS } from '@/services/mockData';

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

    // Call deterministic triage engine
    const analysis = AIService.generateDeterministicTriage(
      title,
      description,
      building || MOCK_BUILDINGS[0].name,
      []
    );

    return NextResponse.json(analysis);
  } catch (error: any) {
    return NextResponse.json(
      AIService.getFallbackAnalysis('AI gateway error. Manual triage enabled.'),
      { status: 200 }
    );
  }
}
