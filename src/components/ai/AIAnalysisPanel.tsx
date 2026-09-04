import React from 'react';
import { AIAnalysis } from '@/types';
import { PriorityBadge } from '@/components/issues/PriorityBadge';
import { Badge } from '@/components/ui/Badge';
import { Sparkles, AlertCircle, Copy, CheckCircle, HelpCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface AIAnalysisPanelProps {
  analysis?: AIAnalysis;
  isLoading?: boolean;
  onApplyRecommendation?: (category: string, priority: string) => void;
  showAdminActions?: boolean;
}

export const AIAnalysisPanel: React.FC<AIAnalysisPanelProps> = ({
  analysis,
  isLoading = false,
  onApplyRecommendation,
  showAdminActions = false,
}) => {
  if (isLoading) {
    return (
      <div className="rounded-lg border border-ai-border bg-ai-surface p-4 text-xs">
        <div className="flex items-center gap-2 text-ai-text font-medium mb-2">
          <Sparkles className="w-4 h-4 animate-spin text-ai-500" />
          <span>Running Automated Campus Operational Triage...</span>
        </div>
        <p className="text-ink-muted">Comparing report semantics with Malda College historical incident telemetry.</p>
      </div>
    );
  }

  // Clean fallback state if AI is completely absent
  if (!analysis) {
    return (
      <div className="rounded-lg border border-warm-300 bg-warm-100 p-4">
        <div className="flex items-start gap-3">
          <HelpCircle className="w-4 h-4 text-ink-muted shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-semibold text-ink uppercase tracking-wider">Automated Triage Status</h4>
            <p className="text-xs text-ink-muted leading-relaxed">
              Automated analysis temporarily unavailable. You can continue processing this report manually.
            </p>
            <div className="pt-1">
              <span className="text-[11px] text-ink-muted italic">Core reporting workflows remain fully operational.</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const confidencePct = Math.round((analysis.confidence || 0) * 100);
  const isFallback = analysis.isFallback;

  return (
    <div className="rounded-lg border border-ai-border bg-ai-surface p-4 sm:p-5 relative overflow-hidden transition-all">
      {/* Subtle top indicator - NOT neon, restrained institutional violet */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-ai-400 via-ai-500 to-ai-400" />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-ai-border/60">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-ai-100 flex items-center justify-center text-ai-700">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-ai-text flex items-center gap-1.5">
              {isFallback ? 'Rule-Based Operational Triage' : 'AI Operational Assistant'}
              <span className={`text-[10px] font-normal lowercase tracking-normal px-1.5 py-0.5 rounded ${
                isFallback ? 'bg-warm-200 text-ink-muted' : 'bg-ai-100 text-ai-700'
              }`}>
                {isFallback ? 'deterministic fallback' : 'recommendation only'}
              </span>
            </h4>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-ai-text">
          <span className="text-ink-muted text-[11px]">System Confidence:</span>
          {isFallback ? (
            <span className="font-mono text-xs text-ink-muted bg-warm-200 px-1.5 py-0.5 rounded" title="Deterministic rule-based heuristics do not claim LLM confidence">
              0% (Heuristic)
            </span>
          ) : (
            <span className="font-semibold text-ai-800">{confidencePct}%</span>
          )}
        </div>
      </div>

      {/* Structured Recommendations Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 my-3.5">
        <div className="bg-white/80 rounded-md border border-ai-border/80 p-2.5">
          <span className="block text-[11px] text-ink-muted uppercase font-medium mb-1">
            Detected Category Recommendation
          </span>
          <div className="flex items-center gap-1.5">
            <Badge variant="ai" size="md">
              {analysis.detectedCategory.replace('_', ' ')}
            </Badge>
          </div>
        </div>

        <div className="bg-white/80 rounded-md border border-ai-border/80 p-2.5">
          <span className="block text-[11px] text-ink-muted uppercase font-medium mb-1">
            AI Suggested Priority
          </span>
          <div className="flex items-center gap-1.5">
            <PriorityBadge priority={analysis.suggestedPriority} size="md" prefix="AI Suggested: " />
          </div>
        </div>
      </div>

      {/* Summary */}
      {analysis.summary && (
        <div className="bg-white/90 rounded-md border border-ai-border/60 p-3 mb-3">
          <span className="block text-[11px] font-semibold text-ai-800 uppercase tracking-wider mb-1">
            Automated Synthesis
          </span>
          <p className="text-xs sm:text-sm text-ink leading-relaxed font-sans">{analysis.summary}</p>
        </div>
      )}

      {/* Urgency Factors */}
      {analysis.urgencyFactors && analysis.urgencyFactors.length > 0 && (
        <div className="mb-3">
          <span className="block text-[11px] font-medium text-ink-muted uppercase tracking-wider mb-1.5">
            Key Heuristic Indicators
          </span>
          <ul className="space-y-1 text-xs text-ink">
            {analysis.urgencyFactors.map((factor, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-ai-500 mt-1.5 shrink-0" />
                <span className="text-xs text-ink-muted">{factor}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Duplicate Detection Alert */}
      {analysis.possibleDuplicates && analysis.possibleDuplicates.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50/90 p-3 mb-3">
          <div className="flex items-center gap-1.5 text-amber-900 font-medium text-xs mb-1.5">
            <Copy className="w-3.5 h-3.5 text-amber-700" />
            <span>Possible Duplicate Reports Detected ({analysis.possibleDuplicates.length})</span>
          </div>
          <p className="text-[11px] text-amber-800/90 mb-2">
            The following existing tickets exhibit similar location or phrasing semantics. Please verify prior to dispatching duplicate staff.
          </p>
          <div className="space-y-1.5">
            {analysis.possibleDuplicates.map((dup) => (
              <div
                key={dup.id}
                className="flex items-center justify-between text-xs bg-white/80 px-2.5 py-1.5 rounded border border-amber-200"
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="font-mono font-semibold text-ink text-[11px]">{dup.ticketNumber}</span>
                  <span className="truncate text-ink-muted text-xs max-w-[200px]">{dup.title}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-amber-800 font-medium">
                    {Math.round(dup.similarityScore * 100)}% match
                  </span>
                  <Link
                    href={`/issues/${dup.id}`}
                    className="text-maroon-700 hover:text-maroon-900 font-medium text-xs flex items-center gap-0.5"
                  >
                    View <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendation Disclaimer & Admin Action */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-[11px] text-ink-muted border-t border-ai-border/60">
        <span className="italic">
          * AI recommendations are non-binding operational suggestions. Operations staff retains final assignment and priority determination.
        </span>
        {showAdminActions && onApplyRecommendation && (
          <button
            type="button"
            onClick={() => onApplyRecommendation(analysis.detectedCategory, analysis.suggestedPriority)}
            className="text-ai-700 hover:text-ai-900 font-semibold underline decoration-ai-300 underline-offset-2 flex items-center gap-1"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Apply AI Suggested Values
          </button>
        )}
      </div>
    </div>
  );
};
