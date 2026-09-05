'use client';

import React from 'react';
import Link from 'next/link';
import { useIssues } from '@/context/IssuesContext';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { IssueCard } from '@/components/issues/IssueCard';
import { IssueStatusBadge } from '@/components/issues/IssueStatusBadge';
import { PriorityBadge } from '@/components/issues/PriorityBadge';
import { CampusMap } from '@/components/map/CampusMap';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import {
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  ArrowRight,
  Bell,
  Activity,
  Layers,
  ShieldAlert,
  ChevronRight,
} from 'lucide-react';

export default function StudentDashboardPage() {
  const { issues, summary, loading, error, refreshIssues } = useIssues();
  const { user } = useAuth();

  // Filter issues reported by current user or student persona
  const myReports = issues.filter(
    (i) => i.reporter.id === user.id || i.reporter.name === user.name
  );

  // General campus active issues
  const campusActiveIssues = issues.filter(
    (i) => i.status !== 'RESOLVED' && i.status !== 'CLOSED'
  );

  const myActiveCount = myReports.filter(
    (i) => i.status !== 'RESOLVED' && i.status !== 'CLOSED'
  ).length;
  const myResolvedCount = myReports.filter(
    (i) => i.status === 'RESOLVED' || i.status === 'CLOSED'
  ).length;

  const criticalCampusIncident = campusActiveIssues.find((i) => i.priority === 'URGENT');

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <LoadingState message="Loading campus dashboard and active tickets..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <ErrorState message={error} onRetry={refreshIssues} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6 pb-20 sm:pb-8">
      {/* Institutional Student / Operator Header */}
      <div className="rounded-lg border border-warm-300 bg-white p-3.5 sm:p-5 shadow-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="space-y-0.5 sm:space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] sm:text-[11px] font-mono font-semibold uppercase tracking-wider text-maroon-900 bg-maroon-50 px-2 py-0.5 rounded border border-maroon-200">
              MaldaOS Portal
            </span>
            <span className="text-[11px] sm:text-xs text-ink-muted">Malda College Academic Session 2026–27</span>
          </div>
          <h1 className="font-serif font-bold text-lg sm:text-2xl text-ink">
            Incident Operations Desk: {user.name}
          </h1>
          <p className="text-xs text-ink-muted">
            {user.department || 'General Academic Wing'} • {user.studentId || user.staffId || 'MC-2024-REG-042'} • Role: {user.role}
          </p>
        </div>

        {/* Primary Action Button */}
        <div className="flex items-center gap-2.5 shrink-0">
          <Link href="/report">
            <Button size="md" variant="primary" leftIcon={<PlusCircle className="w-4 h-4 text-gold-400" />}>
              Lodge New Report
            </Button>
          </Link>
        </div>
      </div>

      {/* PRIORITY 1: WHAT NEEDS ATTENTION? */}
      <section aria-labelledby="attention-heading" className="space-y-1.5 sm:space-y-2">
        <h2 id="attention-heading" className="text-xs font-semibold uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-maroon-700" />
          <span>Priority 1: Immediate Attention & Safety Notices</span>
        </h2>

        {criticalCampusIncident ? (
          <div className="rounded border border-rose-300 bg-rose-50 p-4 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-rose-900">
                  Campus Hazard Alert: {criticalCampusIncident.title}
                </h3>
                <span className="text-[11px] font-mono font-semibold text-rose-800">
                  {criticalCampusIncident.ticketNumber}
                </span>
              </div>
              <p className="text-xs text-rose-800 leading-relaxed">
                Caution advised near {criticalCampusIncident.location.building} ({criticalCampusIncident.location.roomOrLandmark}). Campus technical crew deployed on site.
              </p>
              <div className="pt-1">
                <Link
                  href={`/issues/${criticalCampusIncident.id}`}
                  className="text-xs font-semibold text-rose-900 hover:underline inline-flex items-center gap-1"
                >
                  <span>Inspect Hazard Status & Dispatch</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </div>
        ) : myActiveCount > 0 ? (
          <div className="rounded border border-amber-300 bg-amber-50/80 p-3.5 flex items-center justify-between text-xs text-amber-950">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                You have <strong>{myActiveCount} active work order(s)</strong> currently under investigation or repair by campus technical cells.
              </span>
            </div>
            <Link
              href="#my-status-section"
              className="text-xs font-semibold text-amber-900 hover:underline flex items-center gap-1 shrink-0"
            >
              <span>View Status</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : (
          <div className="rounded border border-warm-200 bg-warm-50 p-3 flex items-center justify-between text-xs text-ink-muted">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>No immediate hazards or pending actions required for your account. Campus facilities operating normally.</span>
            </div>
            <span className="text-[11px] font-mono text-ink-muted">Status: Nominal</span>
          </div>
        )}
      </section>

      {/* PRIORITY 2: CURRENT ISSUE STATUS */}
      <section id="my-status-section" aria-labelledby="status-heading" className="space-y-3">
        <div className="flex items-center justify-between border-b border-warm-300 pb-2">
          <div>
            <h2 id="status-heading" className="font-serif font-bold text-lg text-ink">
              Priority 2: Current Work Order Status ({myReports.length})
            </h2>
            <p className="text-xs text-ink-muted">
              Live lifecycle status of maintenance requests submitted by your account
            </p>
          </div>
          <Link
            href="/issues"
            className="text-xs font-semibold text-maroon-800 hover:text-maroon-950 flex items-center gap-1"
          >
            <span>All Issues ({issues.length})</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {myReports.length > 0 ? (
          <div className="rounded-lg border border-warm-300 bg-white shadow-subtle overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-warm-200 bg-warm-100/80 text-ink-muted text-[11px] font-semibold uppercase tracking-wider">
                    <th className="py-2.5 px-3.5">Ticket ID</th>
                    <th className="py-2.5 px-3.5">Incident Subject</th>
                    <th className="py-2.5 px-3.5 hidden sm:table-cell">Location</th>
                    <th className="py-2.5 px-3.5">Priority</th>
                    <th className="py-2.5 px-3.5">Status</th>
                    <th className="py-2.5 px-3.5 hidden md:table-cell">Assigned Cell</th>
                    <th className="py-2.5 px-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-warm-200">
                  {myReports.map((issue) => (
                    <tr key={issue.id} className="hover:bg-warm-50/70 transition-colors">
                      <td className="py-3 px-3.5 font-mono text-xs font-semibold text-maroon-900 whitespace-nowrap">
                        <Link href={`/issues/${issue.id}`} className="hover:underline">
                          {issue.ticketNumber}
                        </Link>
                      </td>
                      <td className="py-3 px-3.5 max-w-[240px]">
                        <Link href={`/issues/${issue.id}`} className="font-medium text-ink hover:text-maroon-800 line-clamp-1">
                          {issue.title}
                        </Link>
                        <span className="text-[11px] text-ink-muted block">{issue.category.replace('_', ' ')}</span>
                      </td>
                      <td className="py-3 px-3.5 hidden sm:table-cell text-xs text-ink-muted">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-maroon-700 shrink-0" />
                          <span className="truncate max-w-[160px]">{issue.location.building.split('(')[0]} • {issue.location.roomOrLandmark}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <PriorityBadge priority={issue.priority} />
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <IssueStatusBadge status={issue.status} />
                      </td>
                      <td className="py-3 px-3.5 hidden md:table-cell text-xs text-ink-muted whitespace-nowrap">
                        {issue.department || 'Awaiting Dispatch'}
                      </td>
                      <td className="py-3 px-3.5 text-right whitespace-nowrap">
                        <Link
                          href={`/issues/${issue.id}`}
                          className="text-xs font-semibold text-maroon-800 hover:text-maroon-950 inline-flex items-center gap-0.5"
                        >
                          <span>Track</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <EmptyState
            title="No Maintenance Reports Lodged Yet"
            description="Notice broken classroom benches, electrical sparks, or plumbing issues? Lodge a report to alert Malda College maintenance cells."
            actionLabel="Lodge Your First Report"
            actionHref="/report"
          />
        )}
      </section>

      {/* PRIORITY 3: RECENT ACTIVITY & CAMPUS STATUS */}
      <section aria-labelledby="activity-heading" className="space-y-2 sm:space-y-3">
        <div className="flex items-center justify-between border-b border-warm-300 pb-1.5 sm:pb-2">
          <div>
            <h2 id="activity-heading" className="font-serif font-bold text-base sm:text-lg text-ink">
              Priority 3: Recent Campus Activity & Maintenance Highlights
            </h2>
            <p className="text-xs text-ink-muted">
              Live operational work orders across Malda College academic and administrative blocks
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-4">
          {campusActiveIssues.slice(0, 3).map((iss) => (
            <div key={iss.id} className="rounded border border-warm-300 bg-white p-3 sm:p-4 shadow-subtle space-y-1.5 sm:space-y-2">
              <div className="flex items-center justify-between gap-1 text-xs">
                <span className="font-mono font-semibold text-maroon-900 bg-warm-100 px-1.5 py-0.2 rounded">
                  {iss.ticketNumber}
                </span>
                <PriorityBadge priority={iss.priority} />
              </div>
              <Link href={`/issues/${iss.id}`}>
                <h3 className="font-serif font-semibold text-sm text-ink hover:text-maroon-800 line-clamp-1">
                  {iss.title}
                </h3>
              </Link>
              <div className="flex items-center justify-between text-[11px] text-ink-muted pt-1 border-t border-warm-200">
                <span className="truncate max-w-[140px]">{iss.location.building.split('(')[0]}</span>
                <IssueStatusBadge status={iss.status} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PRIORITY 4: IMPORTANT ACTIONS */}
      <section aria-labelledby="actions-heading" className="space-y-2 sm:space-y-3">
        <h2 id="actions-heading" className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
          Priority 4: Operational Actions & Tools
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
          <Link
            href="/report"
            className="p-3 sm:p-4 rounded border border-warm-300 bg-white hover:bg-warm-50 transition-colors shadow-subtle flex items-start gap-2.5 sm:gap-3"
          >
            <div className="w-8 h-8 rounded bg-maroon-100 text-maroon-800 flex items-center justify-center shrink-0">
              <PlusCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif font-semibold text-sm text-ink">Lodge Issue Report</h3>
              <p className="text-xs text-ink-muted mt-0.5">Submit photo evidence and request campus repairs.</p>
            </div>
          </Link>

          <Link
            href="/admin/map"
            className="p-3 sm:p-4 rounded border border-warm-300 bg-white hover:bg-warm-50 transition-colors shadow-subtle flex items-start gap-2.5 sm:gap-3"
          >
            <div className="w-8 h-8 rounded bg-warm-100 text-maroon-800 flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif font-semibold text-sm text-ink">Campus Facility Map</h3>
              <p className="text-xs text-ink-muted mt-0.5">Inspect incident distribution across college blocks.</p>
            </div>
          </Link>

          <Link
            href="/issues"
            className="p-3 sm:p-4 rounded border border-warm-300 bg-white hover:bg-warm-50 transition-colors shadow-subtle flex items-start gap-2.5 sm:gap-3"
          >
            <div className="w-8 h-8 rounded bg-warm-100 text-maroon-800 flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif font-semibold text-sm text-ink">Search Campus Work Orders</h3>
              <p className="text-xs text-ink-muted mt-0.5">Filter all reports by department, block, or status.</p>
            </div>
          </Link>
        </div>
      </section>

      {/* PRIORITY 5: SUPPORTING STATISTICS (Administrative Telemetry, No Gamification) */}
      <section aria-labelledby="stats-heading" className="space-y-2 sm:space-y-3">
        <h2 id="stats-heading" className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
          Priority 5: Supporting Telemetry & Resolution Metrics
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <div className="p-2.5 sm:p-3 bg-white rounded border border-warm-300 shadow-subtle">
            <span className="text-[11px] text-ink-muted block uppercase font-medium">My Logged Tickets</span>
            <span className="font-mono text-xl font-bold text-ink">{myReports.length}</span>
            <span className="text-[10px] text-ink-muted block mt-0.5">Registered to your ID</span>
          </div>

          <div className="p-3 bg-white rounded border border-warm-300 shadow-subtle">
            <span className="text-[11px] text-ink-muted block uppercase font-medium">Active In Progress</span>
            <span className="font-mono text-xl font-bold text-maroon-800">{myActiveCount}</span>
            <span className="text-[10px] text-ink-muted block mt-0.5">Field crew assigned</span>
          </div>

          <div className="p-3 bg-white rounded border border-warm-300 shadow-subtle">
            <span className="text-[11px] text-ink-muted block uppercase font-medium">Verified Resolved</span>
            <span className="font-mono text-xl font-bold text-emerald-700">{myResolvedCount}</span>
            <span className="text-[10px] text-ink-muted block mt-0.5">Closed & signed off</span>
          </div>

          <div className="p-3 bg-white rounded border border-warm-300 shadow-subtle">
            <span className="text-[11px] text-ink-muted block uppercase font-medium">Campus Resolution Rate</span>
            <span className="font-mono text-xl font-bold text-ink">
              {summary.resolutionRate}%
            </span>
            <span className="text-[10px] text-ink-muted block mt-0.5">{summary.openIssues} active across college</span>
          </div>
        </div>
      </section>
    </div>
  );
}

