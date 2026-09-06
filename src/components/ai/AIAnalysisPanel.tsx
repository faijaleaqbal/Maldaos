import React from 'react';
import { AIAnalysis } from '@/types';
import { PriorityBadge } from '@/components/issues/PriorityBadge';
import { Badge } from '@/components/ui/Badge';
import { Activity, Copy, CheckCircle, HelpCircle, ArrowRight } from 'lucide-react';
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
      <div className="rounded-md border border-warm-300 bg-warm-50 p-4 text-xs">
        <div className="flex items-center gap-2 text-ink font-medium mb-1.5">
          <Activity className="w-3.5 h-3.5 text-maroon-700 animate-pulse" />
          <span>Evaluating incident semantics and facility history...</span>
        </div>
        <p className="text-ink-muted">Comparing report details with Malda College historical maintenance records.</p>
      </div>
    );
  }

  // Clean fallback state if AI is completely absent
  if (!analysis) {
    return (
      <div className="rounded-md border border-warm-300 bg-warm-100 p-4">
        <div className="flex items-start gap-3">
          <HelpCircle className="w-4 h-4 text-ink-muted shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-semibold text-ink uppercase tracking-wider">Technical Diagnostic Status</h4>
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
    <div className="rounded-md border border-warm-300 bg-white p-4 sm:p-5 relative transition-all shadow-subtle">
      {/* Top subtle rule */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-maroon-700" />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-warm-200">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-warm-100 border border-warm-200 flex items-center justify-center text-maroon-800">
            <Activity className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-ink flex items-center gap-1.5">
              {isFallback ? 'Rule-Based Operational Triage' : 'Technical Diagnostic Advisory'}
              <span className={`text-[10px] font-mono lowercase tracking-normal px-1.5 py-0.2 rounded border ${
                isFallback ? 'bg-warm-100 text-ink-muted border-warm-200' : 'bg-warm-50 text-ink-muted border-warm-200'
              }`}>
                {isFallback ? 'deterministic fallback' : 'non-binding advisory'}
              </span>
            </h4>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-ink">
          <span className="text-ink-muted text-[11px]">Confidence Metric:</span>
          {isFallback ? (
            <span className="font-mono text-xs text-ink-muted bg-warm-100 px-1.5 py-0.5 rounded border border-warm-200" title="Deterministic rule-based heuristics do not claim LLM confidence">
              Heuristic Ruleset
            </span>
          ) : (
            <span className="font-mono font-semibold text-ink">{confidencePct}%</span>
          )}
        </div>
      </div>

      {/* Structured Recommendations Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 my-3.5">
        <div className="bg-warm-50 rounded border border-warm-200 p-2.5">
          <span className="block text-[11px] text-ink-muted uppercase font-medium mb-1">
            Assessed Category
          </span>
          <div className="flex items-center gap-1.5">
            <Badge variant="default" size="md">
              {analysis.detectedCategory.replace('_', ' ')}
            </Badge>
          </div>
        </div>

        <div className="bg-warm-50 rounded border border-warm-200 p-2.5">
          <span className="block text-[11px] text-ink-muted uppercase font-medium mb-1">
            Suggested Priority Level
          </span>
          <div className="flex items-center gap-1.5">
            <PriorityBadge priority={analysis.suggestedPriority} size="md" prefix="Advisory: " />
          </div>
        </div>
      </div>


      {/* Summary */}
      {analysis.summary && (
        <div className="bg-warm-50 rounded border border-warm-200 p-3 mb-3">
          <span className="block text-[11px] font-semibold text-ink uppercase tracking-wider mb-1">
            Technical Assessment Note
          </span>
          <p className="text-xs text-ink leading-relaxed font-sans">{analysis.summary}</p>
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
                <span className="w-1.5 h-1.5 rounded-full bg-maroon-700 mt-1.5 shrink-0" />
                <span className="text-xs text-ink-muted">{factor}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Duplicate Detection Alert */}
      {analysis.possibleDuplicates && analysis.possibleDuplicates.length > 0 && (
        <div className="rounded border border-amber-300 bg-amber-50/80 p-3 mb-3">
          <div className="flex items-center gap-1.5 text-amber-950 font-semibold text-xs mb-1.5">
            <Copy className="w-3.5 h-3.5 text-amber-800" />
            <span>Correlated / Duplicate Reports Identified ({analysis.possibleDuplicates.length})</span>
          </div>
          <p className="text-[11px] text-amber-900 mb-2">
            The following existing tickets exhibit similar location or phrasing semantics. Please verify prior to dispatching duplicate staff.
          </p>
          <div className="space-y-1.5">
            {analysis.possibleDuplicates.map((dup) => (
              <div
                key={dup.id}
                className="flex items-center justify-between text-xs bg-white px-2.5 py-1.5 rounded border border-amber-200"
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="font-mono font-semibold text-ink text-[11px]">{dup.ticketNumber}</span>
                  <span className="truncate text-ink-muted text-xs max-w-[200px]">{dup.title}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-amber-900 font-mono font-semibold">
                    {Math.round(dup.similarityScore * 100)}% match
                  </span>
                  <Link
                    href={`/issues/${dup.id}`}
                    className="text-maroon-800 hover:text-maroon-950 font-medium text-xs flex items-center gap-0.5"
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
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-[11px] text-ink-muted border-t border-warm-200">
        <span className="italic">
          * Automated assessments are operational advisories. Authorized maintenance officers make all final triage and staff dispatch decisions.
        </span>
        {showAdminActions && onApplyRecommendation && (
          <button
            type="button"
            onClick={() => onApplyRecommendation(analysis.detectedCategory, analysis.suggestedPriority)}
            className="text-maroon-800 hover:text-maroon-950 font-semibold underline underline-offset-2 flex items-center gap-1 cursor-pointer"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Apply Advisory Parameters
          </button>
        )}
      </div>
    </div>
  );
};

