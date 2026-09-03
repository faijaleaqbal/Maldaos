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
import {
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Sparkles,
  ArrowRight,
  Bell,
  Activity,
  Layers,
  ShieldAlert,
  ChevronRight,
} from 'lucide-react';

export default function StudentDashboardPage() {
  const { issues, summary, loading } = useIssues();
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

  const criticalCampusIncident = campusActiveIssues.find((i) => i.priority === 'CRITICAL');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      {/* 1. Welcome & Primary Report CTA Header */}
      <div className="rounded-xl border border-warm-300 bg-white p-5 sm:p-6 shadow-card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-maroon-900 bg-maroon-50 px-2 py-0.5 rounded border border-maroon-200">
                Student Portal
              </span>
              <span className="text-xs text-ink-muted">Malda College Session 2026-27</span>
            </div>
            <h1 className="font-serif font-bold text-2xl sm:text-3xl text-ink">
              Namaste, {user.name.split(' ')[0]}
            </h1>
            <p className="text-xs sm:text-sm text-ink-muted">
              {user.department || 'Department of Computer Science'} • {user.studentId || 'ID: MC-2024-CS-042'}
            </p>
          </div>

          {/* Core Action: Report an Issue CTA */}
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/report">
              <Button size="lg" variant="primary" leftIcon={<PlusCircle className="w-5 h-5 text-gold-400" />}>
                Report an Issue
              </Button>
            </Link>
          </div>
        </div>

        {/* Personal Statistics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-warm-200">
          <div className="p-3 bg-warm-100/80 rounded-md border border-warm-200">
            <span className="text-xs text-ink-muted block font-medium">My Total Reports</span>
            <span className="font-mono text-xl font-bold text-ink">{myReports.length}</span>
          </div>
          <div className="p-3 bg-warm-100/80 rounded-md border border-warm-200">
            <span className="text-xs text-ink-muted block font-medium">In Progress / Dispatched</span>
            <span className="font-mono text-xl font-bold text-maroon-800">{myActiveCount}</span>
          </div>
          <div className="p-3 bg-warm-100/80 rounded-md border border-warm-200">
            <span className="text-xs text-ink-muted block font-medium">Verified Resolved</span>
            <span className="font-mono text-xl font-bold text-emerald-700">{myResolvedCount}</span>
          </div>
          <div className="p-3 bg-warm-100/80 rounded-md border border-warm-200">
            <span className="text-xs text-ink-muted block font-medium">Campus Impact Points</span>
            <span className="font-mono text-xl font-bold text-gold-900">
              {myReports.length * 25 + myResolvedCount * 50} pts
            </span>
          </div>
        </div>
      </div>

      {/* Critical Alert Notice if campus hazard exists */}
      {criticalCampusIncident && (
        <div className="rounded-lg border border-rose-300 bg-rose-50 p-4 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
          <div className="space-y-1 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-rose-900">
                Active Campus Hazard: {criticalCampusIncident.title}
              </h4>
              <span className="text-[11px] font-mono font-semibold text-rose-800">
                {criticalCampusIncident.ticketNumber}
              </span>
            </div>
            <p className="text-xs text-rose-800 leading-relaxed">
              Caution advised near {criticalCampusIncident.location.building} ({criticalCampusIncident.location.roomOrLandmark}). Electrical / facility maintenance crew currently on site.
            </p>
          </div>
        </div>
      )}

      {/* Main Grid: My Reports (Left) & Campus Highlights + Map (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT: 1. What did I report? & 2. What is happening with my reports? */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between border-b border-warm-300 pb-2">
            <div>
              <h2 className="font-serif font-bold text-lg sm:text-xl text-ink">My Reports & Status</h2>
              <p className="text-xs text-ink-muted">Track the resolution progress of issues you lodged</p>
            </div>
            <Link
              href="/issues"
              className="text-xs font-semibold text-maroon-800 hover:text-maroon-950 flex items-center gap-1"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {myReports.length > 0 ? (
            <div className="space-y-3">
              {myReports.map((issue) => (
                <div
                  key={issue.id}
                  className="rounded-lg border border-warm-300 bg-white p-4 transition-all hover:border-maroon-300 shadow-subtle"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-maroon-900 bg-maroon-50 px-2 py-0.5 rounded border border-maroon-200">
                        {issue.ticketNumber}
                      </span>
                      <span className="text-[11px] text-ink-muted">{issue.category.replace('_', ' ')}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <PriorityBadge priority={issue.priority} />
                      <IssueStatusBadge status={issue.status} />
                    </div>
                  </div>

                  <Link href={`/issues/${issue.id}`}>
                    <h3 className="font-serif font-semibold text-sm sm:text-base text-ink hover:text-maroon-800 line-clamp-1 mb-1.5">
                      {issue.title}
                    </h3>
                  </Link>

                  <div className="flex items-center gap-1.5 text-xs text-ink-muted mb-3">
                    <MapPin className="w-3 h-3 text-maroon-700 shrink-0" />
                    <span className="truncate">
                      {issue.location.building.split('(')[0]} • {issue.location.roomOrLandmark}
                    </span>
                  </div>

                  {/* Stage Timeline Preview for My Report */}
                  <div className="pt-2.5 border-t border-warm-200 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-maroon-700" />
                      <span className="text-ink font-medium">
                        {issue.timeline && issue.timeline.length > 0
                          ? issue.timeline[issue.timeline.length - 1].label
                          : 'Report Lodged'}
                      </span>
                    </div>

                    <Link
                      href={`/issues/${issue.id}`}
                      className="text-xs font-semibold text-maroon-800 hover:text-maroon-950 flex items-center gap-1"
                    >
                      <span>Track Lifecycle</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="You haven't reported any campus issues yet"
              description="Notice something broken in classrooms, labs, or corridors? Report it to help keep Malda College functioning smoothly."
              actionLabel="Report Your First Issue"
              actionHref="/report"
            />
          )}
        </div>

        {/* RIGHT: 3. Is anything important happening around campus? & Mini Map */}
        <div className="lg:col-span-5 space-y-6">
          {/* Mini Campus Map Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="font-serif font-bold text-base sm:text-lg text-ink flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-maroon-700" />
                <span>Malda College Campus Map</span>
              </h2>
              <Link
                href="/admin/map"
                className="text-xs font-semibold text-maroon-800 hover:text-maroon-950 flex items-center gap-0.5"
              >
                <span>Full Map</span>
                <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <CampusMap
              issues={issues}
              height="260px"
              zoom={17}
              highlightCritical={true}
            />
          </div>

          {/* Campus Issue Highlights (What's happening across college) */}
          <div className="rounded-lg border border-warm-300 bg-white p-4 shadow-subtle space-y-3">
            <div className="flex items-center justify-between border-b border-warm-200 pb-2">
              <h3 className="font-serif font-semibold text-sm text-ink flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-maroon-700" />
                <span>Campus Issue Highlights</span>
              </h3>
              <span className="text-[11px] text-ink-muted">
                {campusActiveIssues.length} active in college
              </span>
            </div>

            <div className="space-y-2.5">
              {campusActiveIssues.slice(0, 3).map((iss) => (
                <Link
                  key={iss.id}
                  href={`/issues/${iss.id}`}
                  className="block p-2 rounded hover:bg-warm-100 transition-colors border border-warm-200/60"
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-xs font-semibold text-ink line-clamp-1">{iss.title}</span>
                    <PriorityBadge priority={iss.priority} />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-ink-muted">
                    <span>{iss.location.building.split('(')[0]}</span>
                    <span>{iss.status.replace('_', ' ')}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
