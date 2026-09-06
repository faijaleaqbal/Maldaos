'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useIssues } from '@/context/IssuesContext';
import { IssueCategory, IssuePriority } from '@/types';
import {
  Lightbulb,
  AlertTriangle,
  Flame,
  TrendingUp,
  MapPin,
  ExternalLink,
  Info,
} from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';

interface DynamicInsight {
  id: string;
  type: string;
  title: string;
  description: string;
  severity: 'CRITICAL' | 'WARNING' | 'NOTICE';
  affectedArea: string;
  metricImpact?: string;
  actionableRecommendation: string;
  linkedTickets: string[];
}

export default function InsightsPage() {
  const { issues, summary } = useIssues();

  const insights: DynamicInsight[] = useMemo(() => {
    const list: DynamicInsight[] = [];

    // 1. Critical / Urgent Issues Cluster
    const urgentOpen = issues.filter(
      (i) => i.priority === 'URGENT' && i.status !== 'RESOLVED' && i.status !== 'CLOSED'
    );
    if (urgentOpen.length > 0) {
      list.push({
        id: 'cluster-urgent',
        type: 'HAZARD_ALERT',
        title: `${urgentOpen.length} High-Priority Safety / Operational Incidents Open`,
        description: `Currently ${urgentOpen.length} incident(s) flagged with URGENT priority are active and pending complete resolution.`,
        severity: 'CRITICAL',
        affectedArea: urgentOpen.map((i) => i.location?.building || 'Campus').slice(0, 3).join(', '),
        metricImpact: `Affects ${urgentOpen.length} critical work order(s)`,
        actionableRecommendation: 'Expedite technical crew dispatch and ensure resolution summaries are documented upon closure.',
        linkedTickets: urgentOpen.map((i) => i.ticketNumber || i.id.slice(0, 8)).slice(0, 5),
      });
    }

    // 2. Department Workload Concentration
    const deptCounts: Record<string, { open: number; total: number; tickets: string[] }> = {};
    issues.forEach((i) => {
      const dept = i.department || 'Unassigned Department';
      if (!deptCounts[dept]) deptCounts[dept] = { open: 0, total: 0, tickets: [] };
      deptCounts[dept].total++;
      if (i.status !== 'RESOLVED' && i.status !== 'CLOSED') {
        deptCounts[dept].open++;
        if (i.ticketNumber) deptCounts[dept].tickets.push(i.ticketNumber);
      }
    });

    const topDept = Object.entries(deptCounts)
      .filter(([_, d]) => d.open > 0)
      .sort((a, b) => b[1].open - a[1].open)[0];

    if (topDept && topDept[1].open >= 2) {
      list.push({
        id: 'cluster-dept-load',
        type: 'WORKLOAD_SKEW',
        title: `Maintenance Concentration: ${topDept[0]}`,
        description: `${topDept[0]} has the highest active workload on campus with ${topDept[1].open} unresolved incident(s).`,
        severity: topDept[1].open >= 5 ? 'WARNING' : 'NOTICE',
        affectedArea: topDept[0],
        metricImpact: `${topDept[1].open} open work orders in queue`,
        actionableRecommendation: `Review technician allocation for ${topDept[0]} to reduce MTTR and balance inter-department response times.`,
        linkedTickets: topDept[1].tickets.slice(0, 5),
      });
    }

    // 3. Category Cluster
    const catCounts: Record<string, { count: number; tickets: string[] }> = {};
    issues.forEach((i) => {
      const cat = i.category;
      if (!catCounts[cat]) catCounts[cat] = { count: 0, tickets: [] };
      catCounts[cat].count++;
      if (i.ticketNumber) catCounts[cat].tickets.push(i.ticketNumber);
    });

    const topCat = Object.entries(catCounts).sort((a, b) => b[1].count - a[1].count)[0];
    if (topCat && topCat[1].count >= 2) {
      const catName = topCat[0].replace('_', ' ');
      list.push({
        id: 'cluster-category',
        type: 'RECURRING_CATEGORY',
        title: `Dominant Incident Category: ${catName}`,
        description: `${catName} accounts for ${Math.round((topCat[1].count / Math.max(1, issues.length)) * 100)}% of total complaints registered on campus (${topCat[1].count} reports).`,
        severity: 'NOTICE',
        affectedArea: 'Campus-wide facilities',
        metricImpact: `${topCat[1].count} lifetime reports in ${catName}`,
        actionableRecommendation: `Perform proactive inspections on ${catName.toLowerCase()} assets to prevent recurring failures.`,
        linkedTickets: topCat[1].tickets.slice(0, 5),
      });
    }

    // 4. Unassigned Triage Queue
    const unassigned = issues.filter((i) => i.status === 'OPEN');
    if (unassigned.length > 0) {
      list.push({
        id: 'cluster-unassigned',
        type: 'TRIAGE_QUEUE',
        title: `${unassigned.length} Newly Reported Ticket(s) Awaiting Assignment`,
        description: `New reports lodged by students are in OPEN status and need department assignment by administrative officers.`,
        severity: unassigned.length > 3 ? 'WARNING' : 'NOTICE',
        affectedArea: 'Administrative Dispatch Desk',
        metricImpact: `${unassigned.length} tickets pending dispatch`,
        actionableRecommendation: 'Assign tickets to appropriate technical departments from the Command Center.',
        linkedTickets: unassigned.map((i) => i.ticketNumber || i.id.slice(0, 8)).slice(0, 5),
      });
    }

    return list;
  }, [issues]);

  const getSeverityBadge = (sev: DynamicInsight['severity']) => {
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
            Operational Pattern
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
            Operational Intelligence
          </span>
        </div>
        <h1 className="font-serif font-bold text-2xl sm:text-3xl text-ink">
          Operational Insights & Recurring Fault Clusters
        </h1>
        <p className="text-xs sm:text-sm text-ink-muted">
          Pattern detection synthesized dynamically from verified Malda College incident records
        </p>
      </div>

      {/* Principle Banner */}
      <div className="rounded-lg border border-warm-300 bg-white p-4 shadow-subtle flex items-start gap-3 text-xs text-ink-muted leading-relaxed">
        <Info className="w-4 h-4 text-maroon-700 shrink-0 mt-0.5" />
        <p>
          <strong className="text-ink font-semibold">Integrity Protocol:</strong> These insights are synthesized strictly from live database incident records. They highlight workload concentration, response velocity, and recurring maintenance bottlenecks to support evidence-based decisions.
        </p>
      </div>

      {/* Insights Cards Grid */}
      {insights.length === 0 ? (
        <EmptyState
          title="No Operational Fault Clusters Detected"
          description="No recurring fault clusters are currently detected. Patterns are automatically computed as incident telemetry is registered across campus facilities."
        />
      ) : (
        <div className="space-y-4">
          {insights.map((insight) => (
            <div
              key={insight.id}
              className="rounded-xl border border-warm-300 bg-white p-5 sm:p-6 shadow-card space-y-4 transition-all hover:border-maroon-300"
            >
              {/* Top Bar: Title & Severity */}
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-warm-200 pb-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-semibold text-maroon-900 bg-maroon-50 px-2 py-0.5 rounded border border-maroon-200">
                      {insight.type.replace(/_/g, ' ')}
                    </span>
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
                      <span className="text-[11px] text-ink-muted uppercase font-medium block">Telemetry Metric</span>
                      <span className="font-semibold text-emerald-800">{insight.metricImpact}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Actionable Recommendation */}
              <div className="p-3.5 bg-gold-50/60 rounded-lg border border-gold-200 text-xs space-y-1">
                <span className="font-bold text-gold-950 uppercase tracking-wider text-[11px] block">
                  Recommended Action:
                </span>
                <p className="text-ink leading-relaxed font-sans">{insight.actionableRecommendation}</p>
              </div>

              {/* Linked Ticket Evidence Footnote */}
              {insight.linkedTickets.length > 0 && (
                <div className="pt-2 border-t border-warm-200 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink">Underlying Incident Records:</span>
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

                  <span className="text-[11px] italic text-ink-muted">Sourced from live database telemetry</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
