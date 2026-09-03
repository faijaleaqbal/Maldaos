'use client';

import React from 'react';
import Link from 'next/link';
import { MOCK_INSIGHTS } from '@/services/mockData';
import { InsightItem } from '@/types';
import {
  Lightbulb,
  AlertTriangle,
  Flame,
  ArrowRight,
  TrendingUp,
  MapPin,
  CheckCircle,
  ExternalLink,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function InsightsPage() {
  const getSeverityBadge = (sev: InsightItem['severity']) => {
    switch (sev) {
      case 'CRITICAL':
        return (
          <span className="text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-900 border border-rose-300 px-2 py-0.5 rounded flex items-center gap-1">
            <Flame className="w-3 h-3 text-rose-600" />
            <span>Critical Intervention</span>
          </span>
        );
      case 'WARNING':
        return (
          <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-700" />
            <span>Recurring Warning</span>
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-bold uppercase tracking-wider bg-warm-200 text-ink border border-warm-300 px-2 py-0.5 rounded">
            System Notice
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="border-b border-warm-300 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <Lightbulb className="w-4 h-4 text-gold-600" />
          <span className="font-mono text-xs font-semibold text-maroon-900 uppercase tracking-wider">
            System Pattern Intelligence
          </span>
        </div>
        <h1 className="font-serif font-bold text-2xl sm:text-3xl text-ink">
          Operational Insights & Recurring Fault Clusters
        </h1>
        <p className="text-xs sm:text-sm text-ink-muted">
          Automated heuristics grounded strictly in registered Malda College incident telemetry
        </p>
      </div>

      {/* Principle Banner */}
      <div className="rounded-lg border border-warm-300 bg-white p-4 shadow-subtle flex items-start gap-3 text-xs text-ink-muted leading-relaxed">
        <Info className="w-4 h-4 text-maroon-700 shrink-0 mt-0.5" />
        <p>
          <strong className="text-ink font-semibold">Integrity Protocol:</strong> These insights are synthesized from frequency clusters across historical ticket logs (e.g. repeated projector ballast failures, pipe backflow). They highlight preventive maintenance opportunities to reduce overall student disruption.
        </p>
      </div>

      {/* Insights Cards Grid */}
      <div className="space-y-4">
        {MOCK_INSIGHTS.map((insight) => (
          <div
            key={insight.id}
            className="rounded-xl border border-warm-300 bg-white p-5 sm:p-6 shadow-card space-y-4 transition-all hover:border-maroon-300"
          >
            {/* Top Bar: Title & Severity */}
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-warm-200 pb-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] font-semibold text-maroon-900 bg-maroon-50 px-2 py-0.5 rounded border border-maroon-200">
                    {insight.type.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-ink-muted font-mono">{insight.detectedDate}</span>
                </div>
                <h3 className="font-serif font-bold text-base sm:text-lg text-ink">
                  {insight.title}
                </h3>
              </div>

              <div>{getSeverityBadge(insight.severity)}</div>
            </div>

            {/* Finding Description */}
            <p className="text-xs sm:text-sm text-ink-muted leading-relaxed font-sans">
              {insight.description}
            </p>

            {/* Affected Area & Impact */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-warm-50 rounded-lg border border-warm-200 text-xs">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-maroon-700 shrink-0" />
                <div>
                  <span className="text-[11px] text-ink-muted uppercase font-medium block">Affected Facility Zone</span>
                  <span className="font-semibold text-ink">{insight.affectedArea}</span>
                </div>
              </div>

              {insight.metricImpact && (
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-700 shrink-0" />
                  <div>
                    <span className="text-[11px] text-ink-muted uppercase font-medium block">Preventive Impact</span>
                    <span className="font-semibold text-emerald-800">{insight.metricImpact}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Actionable Recommendation */}
            <div className="p-3.5 bg-gold-50/60 rounded-lg border border-gold-200 text-xs space-y-1">
              <span className="font-bold text-gold-950 uppercase tracking-wider text-[11px] block">
                Recommended Duty Directive:
              </span>
              <p className="text-ink leading-relaxed font-sans">{insight.actionableRecommendation}</p>
            </div>

            {/* Linked Ticket Evidence Footnote */}
            <div className="pt-2 border-t border-warm-200 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
              <div className="flex items-center gap-2">
                <span className="font-medium text-ink">Underlying Evidence Tickets:</span>
                <div className="flex items-center gap-1.5 font-mono">
                  {insight.linkedTickets.map((t) => (
                    <Link
                      key={t}
                      href={`/issues?search=${t}`}
                      className="bg-warm-100 hover:bg-warm-200 px-2 py-0.5 rounded border border-warm-300 text-maroon-900 font-semibold transition-colors flex items-center gap-1"
                    >
                      <span>{t}</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </Link>
                  ))}
                </div>
              </div>

              <span className="text-[11px] italic">Verified by IQAC Infrastructure Governance</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
