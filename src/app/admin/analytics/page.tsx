'use client';

import React from 'react';
import { useIssues } from '@/context/IssuesContext';
import { AnalyticsCharts } from '@/components/analytics/AnalyticsCharts';
import { BarChart3, TrendingUp, CheckCircle, Clock, ShieldCheck, Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function AnalyticsPage() {
  const { summary } = useIssues();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-warm-300 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-4 h-4 text-maroon-700" />
            <span className="font-mono text-xs font-semibold text-maroon-900 uppercase tracking-wider">
              Telemetry & Quantitative Analytics
            </span>
          </div>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl text-ink">
            Campus Infrastructure Analytics
          </h1>
          <p className="text-xs sm:text-sm text-ink-muted">
            Quantitative velocity, mean time to resolution, department workload, and recurring fault trends
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => window.print()}
            leftIcon={<Download className="w-3.5 h-3.5" />}
          >
            Export PDF Report
          </Button>
        </div>
      </div>

      {/* Primary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-warm-300 shadow-card">
          <span className="text-xs text-ink-muted uppercase font-semibold block mb-1">Total Lifetime Tickets</span>
          <span className="font-mono text-2xl font-bold text-ink">{summary.totalIssues}</span>
          <span className="text-[11px] text-ink-muted block mt-1">Computed from the live issues list</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-warm-300 shadow-card">
          <span className="text-xs text-ink-muted uppercase font-semibold block mb-1">Resolution Efficiency</span>
          <span className="font-mono text-2xl font-bold text-emerald-700">{summary.resolutionRate}%</span>
          <span className="text-[11px] text-ink-muted block mt-1">
            Resolved + closed / total issues (live)
          </span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-warm-300 shadow-card">
          <span className="text-xs text-ink-muted uppercase font-semibold block mb-1">Mean Time to Resolve (MTTR)</span>
          <span className="font-mono text-2xl font-bold text-maroon-800">
            {summary.averageResolutionHours > 0 ? `${summary.averageResolutionHours.toFixed(1)} Hours` : '—'}
          </span>
          <span className="text-[11px] text-ink-muted block mt-1">From lodge to verified closure</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-warm-300 shadow-card">
          <span className="text-xs text-ink-muted uppercase font-semibold block mb-1">Composite Health Index</span>
          <span className="font-mono text-2xl font-bold text-gold-900">{summary.campusHealth.overall} / 100</span>
          <span className="text-[11px] text-ink-muted block mt-1">{summary.campusHealth.trailingDays}-day trailing stability indicator</span>
        </div>
      </div>

      {/* Main Recharts Analytics Component */}
      <AnalyticsCharts summary={summary} />
    </div>
  );
}
