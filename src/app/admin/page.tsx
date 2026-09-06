'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useIssues } from '@/context/IssuesContext';
import { useAuth } from '@/context/AuthContext';
import { Issue } from '@/types';
import { HealthScoreCard } from '@/components/admin/HealthScoreCard';
import { CampusMap } from '@/components/map/CampusMap';
import { IssueStatusBadge } from '@/components/issues/IssueStatusBadge';
import { PriorityBadge } from '@/components/issues/PriorityBadge';
import { AssignmentDrawer } from '@/components/admin/AssignmentDrawer';
import { Button } from '@/components/ui/Button';
import {
  ShieldAlert,
  Flame,
  Activity,
  ArrowRight,
  UserCheck,
  Compass,
  Clock,
  CheckCircle2,
  Layers,
} from 'lucide-react';

export default function AdminDashboardPage() {
  const { issues, summary, loading } = useIssues();
  const { user } = useAuth();

  const [activeDrawerIssue, setActiveDrawerIssue] = useState<Issue | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const criticalIssues = issues.filter(
    (i) => i.priority === 'URGENT' && i.status !== 'RESOLVED' && i.status !== 'CLOSED'
  );
  const inProgressIssues = issues.filter(
    (i) => i.status === 'IN_PROGRESS' || i.status === 'ASSIGNED'
  );
  const unassignedIssues = issues.filter(
    (i) => !i.assignedTo && i.status !== 'RESOLVED' && i.status !== 'CLOSED'
  );
  const resolvedIssues = issues.filter(
    (i) => i.status === 'RESOLVED' || i.status === 'CLOSED'
  );

  const openDrawer = (issue: Issue) => {
    setActiveDrawerIssue(issue);
    setIsDrawerOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Executive Command Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-warm-300 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 ring-2 ring-emerald-600/20 shrink-0" aria-hidden="true" />
            <span className="font-mono text-xs font-bold text-maroon-900 uppercase tracking-widest">
              Malda College Central Infrastructure Console
            </span>
          </div>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl text-ink">
            Campus Operations Command Center
          </h1>
          <p className="text-xs sm:text-sm text-ink-muted">
            Duty Officer: <strong>{user.name}</strong> • Role: {user.role} • Shift: Daytime Operations
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/map">
            <Button size="sm" variant="secondary" leftIcon={<Compass className="w-3.5 h-3.5" />}>
              Open Full Campus Map
            </Button>
          </Link>
          <Link href="/admin/issues">
            <Button size="sm" variant="primary" leftIcon={<Layers className="w-3.5 h-3.5" />}>
              Open Issue Queue ({summary.openIssues})
            </Button>
          </Link>
        </div>
      </div>

      {/* 1. Campus Health Score Card */}
      <HealthScoreCard healthScore={summary.campusHealth} />

      {/* 2. Intelligent Asymmetrical Operational Grid (NOT 4 identical cards!) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Box 1: Open Pipeline & Priority Breakdown (4 cols) */}
        <div className="lg:col-span-4 rounded-xl border border-warm-300 bg-white p-5 shadow-card space-y-4">
          <div className="flex items-center justify-between border-b border-warm-200 pb-3">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted block">
                Active Incident Backlog
              </span>
              <h3 className="font-serif font-bold text-lg text-ink">Open Work Orders</h3>
            </div>
            <span className="font-mono text-3xl font-bold text-maroon-900">{summary.openIssues}</span>
          </div>

          {/* Breakdown bars */}
          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-rose-800 font-medium">
                <Flame className="w-3.5 h-3.5 text-rose-600" />
                Critical Hazards
              </span>
              <span className="font-mono font-bold text-rose-900">{criticalIssues.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-amber-800 font-medium">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                High Urgency
              </span>
              <span className="font-mono font-bold text-amber-900">
                {issues.filter((i) => i.priority === 'HIGH' && i.status !== 'RESOLVED').length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-ink-muted">
                <Clock className="w-3.5 h-3.5 text-gold-700" />
                Medium / Routine
              </span>
              <span className="font-mono font-semibold text-ink">
                {issues.filter((i) => i.priority === 'MEDIUM' && i.status !== 'RESOLVED').length}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-warm-200">
            <Link href="/admin/issues?status=UNASSIGNED">
              <Button size="sm" variant="outline" className="w-full text-xs" leftIcon={<UserCheck className="w-3.5 h-3.5" />}>
                Triage Unassigned Tickets ({unassignedIssues.length})
              </Button>
            </Link>
          </div>
        </div>

        {/* Box 2: Immediate Critical Escalation Box (4 cols) */}
        <div className={`lg:col-span-4 rounded-xl border p-5 shadow-card space-y-3 ${
          criticalIssues.length > 0 ? 'bg-rose-50/70 border-rose-300' : 'bg-white border-warm-300'
        }`}>
          <div className="flex items-center justify-between border-b border-warm-200/60 pb-2">
            <div className="flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-rose-600" />
              <h3 className="font-serif font-bold text-base text-rose-950">
                Critical Safety Queue
              </h3>
            </div>
            <span className="text-[10px] font-mono uppercase bg-rose-200/80 text-rose-900 px-2 py-0.5 rounded font-bold">
              {criticalIssues.length} Immediate
            </span>
          </div>

          {criticalIssues.length > 0 ? (
            <div className="space-y-2.5">
              {criticalIssues.map((crit) => (
                <div
                  key={crit.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open work order ${crit.ticketNumber}: ${crit.title}`}
                  onClick={() => openDrawer(crit)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openDrawer(crit);
                    }
                  }}
                  className="p-3 bg-white rounded-lg border border-rose-200 shadow-subtle hover:border-rose-400 cursor-pointer space-y-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-700"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-rose-900">{crit.ticketNumber}</span>
                    <span className="text-[10px] text-rose-700 font-semibold">{crit.category}</span>
                  </div>
                  <h4 className="font-serif text-xs font-semibold text-ink line-clamp-1">{crit.title}</h4>
                  <p className="text-[11px] text-ink-muted truncate">📍 {crit.location.building} • {crit.location.roomOrLandmark}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-ink-muted">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
              <p className="font-medium text-ink">No active life-safety incidents</p>
              <span className="text-[11px] text-ink-muted">All physical lab and electrical boards nominal.</span>
            </div>
          )}
        </div>

        {/* Box 3: Resolution Velocity & Staff Load (4 cols) */}
        <div className="lg:col-span-4 rounded-xl border border-warm-300 bg-white p-5 shadow-card space-y-4">
          <div className="flex items-center justify-between border-b border-warm-200 pb-3">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted block">
                Turnaround Performance
              </span>
              <h3 className="font-serif font-bold text-lg text-ink">Velocity & MTTR</h3>
            </div>
            <span className="font-mono text-3xl font-bold text-emerald-800">{summary.resolutionRate}%</span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <div className="flex items-center justify-between mb-1 text-ink">
                <span>Average Mean Time to Resolution</span>
                <span className="font-mono font-bold text-maroon-900">{summary.averageResolutionHours} Hours</span>
              </div>
              <div className="h-2 w-full bg-warm-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, summary.resolutionRate))}%` }}
                />
              </div>
            </div>

            <div className="pt-2 border-t border-warm-200 space-y-1">
              <span className="text-[11px] font-medium text-ink-muted block">Active Field Deployments:</span>
              <div className="flex items-center justify-between text-ink">
                <span>Technicians in Field</span>
                <span className="font-mono font-semibold">{inProgressIssues.length} assigned</span>
              </div>
              <div className="flex items-center justify-between text-ink">
                <span>Verified Closures to Date</span>
                <span className="font-mono font-semibold text-emerald-700">{resolvedIssues.length} completed</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-warm-200">
            <Link href="/admin/analytics">
              <Button size="sm" variant="secondary" className="w-full text-xs" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                Deep Performance Analytics
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* 3. Live Campus Map Section & Priority Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Operational Campus Map */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-serif font-bold text-lg text-ink flex items-center gap-2">
              <Compass className="w-4 h-4 text-maroon-700" />
              <span>Campus Geographic Command Map</span>
            </h3>
            <span className="text-xs text-ink-muted">Malda College Landmarking</span>
          </div>

          <CampusMap issues={issues} height="360px" zoom={17} highlightCritical={true} />
        </div>

        {/* Right: Priority Triage Feed */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-serif font-bold text-lg text-ink flex items-center gap-2">
              <Activity className="w-4 h-4 text-maroon-700" />
              <span>Priority Action Dispatch</span>
            </h3>
            <Link href="/admin/issues" className="text-xs text-maroon-800 font-semibold hover:underline">
              All ({issues.length})
            </Link>
          </div>

          <div className="rounded-xl border border-warm-300 bg-white divide-y divide-warm-200 overflow-hidden shadow-subtle max-h-[360px] overflow-y-auto">
            {issues.slice(0, 5).map((iss) => (
              <div
                key={iss.id}
                role="button"
                tabIndex={0}
                aria-label={`Inspect ticket ${iss.ticketNumber}: ${iss.title}`}
                onClick={() => openDrawer(iss)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openDrawer(iss);
                  }
                }}
                className="p-3.5 hover:bg-warm-50 transition-colors cursor-pointer space-y-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon-700"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-mono text-xs font-semibold text-maroon-900 bg-maroon-50 px-1.5 py-0.2 rounded">
                    {iss.ticketNumber}
                  </span>
                  <div className="flex items-center gap-1">
                    <PriorityBadge priority={iss.priority} />
                    <IssueStatusBadge status={iss.status} />
                  </div>
                </div>

                <h4 className="font-serif font-semibold text-xs text-ink line-clamp-1">
                  {iss.title}
                </h4>

                <div className="flex items-center justify-between text-[11px] text-ink-muted pt-1">
                  <span className="truncate max-w-[200px]">{iss.location.building.split('(')[0]}</span>
                  <span className="text-maroon-800 font-semibold flex items-center gap-0.5">
                    Inspect <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Assignment & Inspection Slide-over Drawer */}
      <AssignmentDrawer
        issue={activeDrawerIssue}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </div>
  );
}
