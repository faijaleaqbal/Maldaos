/**
 * Client-side AI service. The browser calls our own /api/ai/* route;
 * the route server-side calls the AI gateway. The browser NEVER sees
 * provider API keys.
 *
 * AI output integrity:
 *   - When the gateway says status='REAL_PROVIDER', we present the
 *     provider's confidence (whatever it actually returned, 0..1).
 *   - When the gateway says status='RULE_BASED_FALLBACK', we set
 *     confidence=0, isFallback=true, and label the source as
 *     "Deterministic triage (offline)".
 *
 * The legacy keyword engine is REMOVED. It is no longer imported
 * anywhere; if all providers are down, the user sees a clear
 * "AI analysis unavailable" message.
 */
import { AIAnalysis, Issue } from '@/types';

export interface AIServiceRequest {
  title: string;
  description: string;
  building?: string;
  existingIssues?: Issue[];
  /** Optional. If provided, the server persists the result. */
  issueId?: string;
}

export interface AIServiceResponse {
  ok: boolean;
  analysis: AIAnalysis;
  /** Surface errors without throwing so the report flow can continue. */
  error?: string;
}

const UNFALLBACK_SUMMARY = 'AI analysis unavailable. Manual triage will be used.';

export const AIService = {
  /**
   * Call the server AI route. Never throws. If the request fails
   * for any reason, returns a clearly-labelled fallback.
   */
  async analyzeIssue(
    title: string,
    description: string,
    building: string,
    existingIssues: Issue[] = [],
    context: { issueId?: string } = {}
  ): Promise<AIAnalysis> {
    const r = await this.request({ title, description, building, existingIssues, ...context });
    return r.analysis;
  },

  async request(req: AIServiceRequest): Promise<AIServiceResponse> {
    try {
      const resp = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: req.title,
          description: req.description,
          locationName: req.building,
          issueId: req.issueId,
        }),
      });
      if (!resp.ok) {
        return { ok: false, analysis: this.fallback(req.title ?? '', req.description ?? '', req.building ?? '', 'gateway error'), error: `HTTP ${resp.status}` };
      }
      const data = await resp.json();
      return { ok: true, analysis: toAIAnalysisShape(data, req) };
    } catch (e: any) {
      return { ok: false, analysis: this.fallback(req.title ?? '', req.description ?? '', req.building ?? '', e?.message ?? 'network error'), error: e?.message };
    }
  },

  /**
   * Clear, honest fallback. confidence=0, isFallback=true, source clearly
   * labelled so the UI can NEVER present this as "real AI".
   */
  fallback(title: string, description: string, building: string, reason = UNFALLBACK_SUMMARY): AIAnalysis {
    return {
      detectedCategory: 'OTHER',
      suggestedSeverity: 'MEDIUM',
      suggestedPriority: 'MEDIUM',
      confidence: 0,
      summary: reason,
      suggestedDepartment: 'Campus Infrastructure Helpdesk',
      possibleDuplicates: [],
      urgencyFactors: ['Manual admin review required'],
      isFallback: true,
      analyzedAt: new Date().toISOString(),
      gatewayProvider: 'Deterministic triage (offline) — no provider responded',
    };
  },

  getFallbackAnalysis(reason: string = UNFALLBACK_SUMMARY): AIAnalysis {
    return this.fallback('', '', '', reason);
  },
};

/** Map the server's structured response to the AIAnalysis product type. */
function toAIAnalysisShape(
  data: any,
  req: AIServiceRequest
): AIAnalysis {
  const isReal = data?.status === 'REAL_PROVIDER';
  const rec = data?.recommendation ?? {};
  // possibleDuplicates from server (if any) — note: the analyze endpoint
  // returns an empty array; duplicates are computed in a separate call
  // for performance. The Issue detail page joins them later.
  const duplicates = (data?.possibleDuplicates ?? []).map((d: any) => ({
    id: d.existingIssueId,
    ticketNumber: d.existingIssueId.slice(0, 8),
    title: d.reason,
    similarityScore: 0, // NEVER fabricated
    status: 'REPORTED' as const,
  }));

  return {
    detectedCategory: rec.category ?? 'OTHER',
    suggestedSeverity: rec.severity ?? rec.priority ?? 'MEDIUM',
    suggestedPriority: rec.priority ?? 'MEDIUM',
    confidence: isReal && typeof rec.confidence === 'number' ? Math.max(0, Math.min(1, rec.confidence)) : 0,
    summary: isReal
      ? (rec.summary ?? UNFALLBACK_SUMMARY)
      : (data?.isFallback ? UNFALLBACK_SUMMARY : UNFALLBACK_SUMMARY),
    suggestedDepartment: departmentForCategory(rec.category ?? 'OTHER'),
    possibleDuplicates: duplicates,
    urgencyFactors: data?.urgencyFactors ?? [],
    isFallback: !isReal,
    analyzedAt: data?.analyzedAt ?? new Date().toISOString(),
    gatewayProvider: isReal
      ? `${data?.provider} / ${data?.model}`
      : 'Deterministic triage (offline) — no provider responded',
  };
}

function departmentForCategory(c: string): string {
  switch (c) {
    case 'ELECTRICAL': return 'Electrical & Facility Operations';
    case 'PLUMBING': return 'Civil Works & Plumbing';
    case 'IT_NETWORK': return 'IT & Network Cell';
    case 'FACILITY_CLASSROOM': return 'Academic Infrastructure & IQAC';
    case 'LAB_EQUIPMENT': return 'IT & Network Cell';
    case 'SANITATION': return 'Civil Works & Sanitation';
    case 'SAFETY_SECURITY': return 'Campus Security & Estate Office';
    case 'HOSTEL': return 'Hostel Superintendent Office';
    default: return 'Campus Infrastructure Helpdesk';
  }
}
