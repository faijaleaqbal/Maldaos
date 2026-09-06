import React from 'react';
import { CampusHealthScore } from '@/types';
import { Activity, Info } from 'lucide-react';

interface HealthScoreCardProps {
  healthScore: CampusHealthScore;
}

export const HealthScoreCard: React.FC<HealthScoreCardProps> = ({ healthScore }) => {
  const {
    overall,
    resolutionPerformance,
    openIssueLoad,
    criticalSeverityIndex,
    recurringFaultIndex,
    statusLabel,
    trailingDays,
    disclaimer,
  } = healthScore;

  const getStatusBadge = () => {
    switch (statusLabel) {
      case 'OPTIMAL':
        return {
          label: 'Optimal Campus State',
          className: 'bg-emerald-50 text-emerald-800 border-emerald-300',
        };
      case 'STABLE':
        return {
          label: 'Operationally Stable',
          className: 'bg-gold-50 text-gold-900 border-gold-300',
        };
      case 'ATTENTION_NEEDED':
        return {
          label: 'Attention Needed',
          className: 'bg-amber-50 text-amber-900 border-amber-300',
        };
      case 'CRITICAL':
        return {
          label: 'Critical Backlog Alert',
          className: 'bg-rose-50 text-rose-900 border-rose-300',
        };
      case 'INSUFFICIENT_DATA':
      default:
        return {
          label: 'Insufficient Telemetry',
          className: 'bg-warm-100 text-ink-muted border-warm-300',
        };
    }
  };

  const badge = getStatusBadge();
  const isInsufficient = statusLabel === 'INSUFFICIENT_DATA';

  return (
    <div className="rounded-lg border border-warm-300 bg-white p-5 sm:p-6 shadow-card relative overflow-hidden">
      {/* Top institutional strip */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-maroon-700" />

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-warm-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-4 h-4 text-maroon-700" />
            <h3 className="font-serif font-semibold text-lg text-ink">Campus Health Score</h3>
          </div>
          <p className="text-xs text-ink-muted">
            Heuristic operational infrastructure stability metric based on live records
          </p>
        </div>

        <div className={`px-2.5 py-1 rounded-md border text-xs font-semibold uppercase tracking-wider ${badge.className}`}>
          {badge.label}
        </div>
      </div>

      {/* Main Score Display & Core Sub-metrics */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 py-5 items-center">
        {/* Large Score Dial / Number */}
        <div className="md:col-span-4 flex flex-col items-center justify-center p-4 bg-warm-100 rounded-lg border border-warm-200 text-center">
          <div className="flex items-baseline gap-1">
            <span className="font-serif text-5xl sm:text-6xl font-bold text-maroon-900 tracking-tight">
              {isInsufficient ? '—' : overall}
            </span>
            <span className="text-base sm:text-lg text-ink-muted font-medium">/ 100</span>
          </div>
          <span className="text-xs uppercase tracking-wider font-semibold text-maroon-800 mt-1">
            {isInsufficient ? 'No Live Incidents' : 'Composite Health Index'}
          </span>
          <div className="flex items-center gap-1 text-[11px] text-maroon-800 mt-2 font-mono">
            <span>{isInsufficient ? 'Awaiting incident telemetry' : `${resolutionPerformance}% overall resolution throughput`}</span>
          </div>
        </div>

        {/* Measurable Component Breakdown */}
        <div className="md:col-span-8 space-y-3.5">
          {/* Component 1: Resolution Velocity */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-medium text-ink">Resolution Velocity (Throughput)</span>
              <span className="font-mono font-semibold text-maroon-900">{resolutionPerformance}%</span>
            </div>
            <div className="h-2 w-full bg-warm-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-maroon-700 rounded-full transition-all duration-500"
                style={{ width: `${resolutionPerformance}%` }}
              />
            </div>
            <span className="text-[10px] text-ink-muted">Ratio of verified closures to total recorded tickets</span>
          </div>

          {/* Component 2: Open Issue Load */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-medium text-ink">Active Pipeline Capacity (Issue Load)</span>
              <span className="font-mono font-semibold text-maroon-900">{openIssueLoad}%</span>
            </div>
            <div className="h-2 w-full bg-warm-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gold-600 rounded-full transition-all duration-500"
                style={{ width: `${openIssueLoad}%` }}
              />
            </div>
            <span className="text-[10px] text-ink-muted">Weight of unassigned and in-flight ticket volume</span>
          </div>

          {/* Component 3: Critical Severity Index */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-medium text-ink">Critical Safety & Hazard Index</span>
              <span className="font-mono font-semibold text-maroon-900">{criticalSeverityIndex}%</span>
            </div>
            <div className="h-2 w-full bg-warm-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-700 rounded-full transition-all duration-500"
                style={{ width: `${criticalSeverityIndex}%` }}
              />
            </div>
            <span className="text-[10px] text-ink-muted">Inversion score of active lab safety/arcing threats</span>
          </div>

          {/* Component 4: Recurring Fault Index */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-medium text-ink">Recurring Fault Frequency Stability</span>
              <span className="font-mono font-semibold text-maroon-900">{recurringFaultIndex}%</span>
            </div>
            <div className="h-2 w-full bg-warm-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-warm-500 rounded-full transition-all duration-500"
                style={{ width: `${recurringFaultIndex}%` }}
              />
            </div>
            <span className="text-[10px] text-ink-muted">Absence of repeated hardware breakdown at identical location</span>
          </div>
        </div>
      </div>

      {/* Explicit Regulatory & Operational Disclaimer */}
      <div className="mt-2 pt-3 border-t border-warm-200 flex items-start gap-2 bg-warm-50 p-2.5 rounded text-[11px] text-ink-muted leading-relaxed">
        <Info className="w-3.5 h-3.5 text-maroon-700 shrink-0 mt-0.5" />
        <p>
          <strong className="text-ink font-semibold">Operational Indicator Notice:</strong> {disclaimer}
        </p>
      </div>
    </div>
  );
};
