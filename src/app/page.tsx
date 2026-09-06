'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useIssues } from '@/context/IssuesContext';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { IssueCard } from '@/components/issues/IssueCard';
import { PriorityBadge } from '@/components/issues/PriorityBadge';
import { IssueStatusBadge } from '@/components/issues/IssueStatusBadge';
import { isDevSeedLoginAvailable } from '@/services/devSeedAccounts';
import {
  PlusCircle,
  CheckCircle2,
  ArrowRight,
  ChevronRight,
  GraduationCap,
  Building2,
  Compass,
} from 'lucide-react';

// Dynamically load the Devini-grade 3D Campus Experience to ensure white-screen protection and fast startup
const CampusHeroScene = dynamic(
  () => import('@/components/3d/CampusHeroScene').then((mod) => mod.CampusHeroScene),
  {
    ssr: false,
    loading: () => (
      <div className="w-full min-h-[580px] lg:min-h-[720px] bg-paper-100 flex flex-col items-center justify-center gap-3 p-6 text-center animate-pulse border-b border-warm-300">
        <Compass className="w-10 h-10 text-maroon-800 animate-spin" />
        <span className="font-serif font-bold text-lg text-maroon-950">
          Malda College Digital Campus
        </span>
        <span className="text-xs text-ink-muted">
          Initializing 3D spatial environment & architectural geometries...
        </span>
      </div>
    ),
  }
);

export default function HomePage() {
  const router = useRouter();
  const { issues, summary } = useIssues();
  const { user, role, switchRole } = useAuth();
  const [searchTicket, setSearchTicket] = useState('');

  const handleTicketSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTicket.trim()) return;
    const clean = searchTicket.trim();
    const found = issues.find(
      (i) => i.ticketNumber.toLowerCase() === clean.toLowerCase() || i.id === clean
    );
    if (found) {
      router.push(`/issues/${found.id}`);
    } else {
      router.push(`/issues?search=${encodeURIComponent(clean)}`);
    }
  };

  const recentIssues = issues.slice(0, 3);
  const criticalIssue = issues.find(
    (i) => i.priority === 'URGENT' && i.status !== 'RESOLVED' && i.status !== 'CLOSED'
  );

  return (
    <div className="space-y-8 pb-16">
      {/* Top Urgent Incident Banner (if any critical issues active) */}
      {criticalIssue && (
        <div className="bg-rose-900 text-white px-4 py-2.5 text-xs border-b border-rose-800">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
              <span className="font-semibold uppercase tracking-wider text-rose-200">
                Active Campus Hazard Alert:
              </span>
              <span className="font-medium text-white">{criticalIssue.title}</span>
              <span className="text-rose-200 hidden md:inline">
                ({criticalIssue.location.building})
              </span>
            </div>
            <Link
              href={`/issues/${criticalIssue.id}`}
              className="text-gold-300 hover:text-gold-200 underline font-semibold flex items-center gap-1"
            >
              <span>Inspect Work Order</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}

      {/* DEVINI-GRADE FULL 3D HERO EXPERIENCE WITH SCROLL STORYTELLING */}
      <section className="relative w-full">
        <CampusHeroScene />
      </section>

      {/* Institutional Operational Command Bar & Ticket Search */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center bg-white p-5 rounded-lg border border-warm-300 shadow-subtle">
          {/* Fast Ticket Lookup Form */}
          <div className="lg:col-span-6 space-y-1.5">
            <label
              htmlFor="hp-ticket-search"
              className="block text-[11px] font-semibold text-ink-muted uppercase tracking-wider"
            >
              Track Ticket Status by Reference ID
            </label>
            <form onSubmit={handleTicketSearch} className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  id="hp-ticket-search"
                  type="text"
                  placeholder="e.g. MC-2027-0104"
                  value={searchTicket}
                  onChange={(e) => setSearchTicket(e.target.value)}
                  className="w-full rounded-md border border-warm-300 bg-warm-50/50 hover:bg-white px-3.5 py-2 text-xs sm:text-sm text-ink pr-10 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] focus:bg-white focus:outline-none focus:border-maroon-700 focus:ring-1 focus:ring-maroon-700 font-mono transition-colors"
                />
              </div>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                className="min-h-[38px] px-4 font-semibold shrink-0"
              >
                Track
              </Button>
            </form>
          </div>

          {/* Quick Spatial GIS Link & Health Meter */}
          <div className="lg:col-span-6 flex flex-wrap items-center justify-between sm:justify-end gap-4 border-t lg:border-t-0 border-warm-200 pt-4 lg:pt-0">
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="block text-[10px] uppercase font-mono font-semibold text-ink-muted">
                  Campus Health Index
                </span>
                <span className="font-mono text-xl font-bold text-maroon-900">
                  {summary.campusHealth.statusLabel === 'INSUFFICIENT_DATA'
                    ? '—'
                    : `${summary.campusHealth.overall} / 100`}
                </span>
              </div>
              <div className="h-8 w-px bg-warm-200" />
              <div className="text-right">
                <span className="block text-[10px] uppercase font-mono font-semibold text-ink-muted">
                  Open Orders
                </span>
                <span className="font-mono text-xl font-bold text-ink">
                  {summary.openIssues}
                </span>
              </div>
            </div>

            <Link href="/map">
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Compass className="w-3.5 h-3.5 text-maroon-800" />}
                className="text-maroon-900 font-semibold"
              >
                Full 3D GIS Map
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Role Switcher Sandbox (Evaluation only) */}
      {isDevSeedLoginAvailable() && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-warm-50/70 border border-warm-300 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-ink">Evaluation Persona:</span>
              <span className="font-mono font-bold text-maroon-900">
                {user.name} ({role})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={role === 'STUDENT' ? 'primary' : 'secondary'}
                onClick={() => switchRole('STUDENT')}
                leftIcon={<GraduationCap className="w-3.5 h-3.5" />}
                className="h-8 py-1 px-3 text-xs"
              >
                Student View
              </Button>
              <Button
                size="sm"
                variant={role === 'SUPER_ADMIN' ? 'primary' : 'secondary'}
                onClick={() => switchRole('SUPER_ADMIN')}
                leftIcon={<Building2 className="w-3.5 h-3.5" />}
                className="h-8 py-1 px-3 text-xs"
              >
                Admin Console
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Main Content: Recent Active Issues & SOP Protocol */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Section 1: Recent Campus Maintenance Queue */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-warm-300 pb-2">
            <div>
              <h2 className="font-serif font-bold text-lg sm:text-xl text-ink">
                Active Campus Maintenance Queue
              </h2>
              <p className="text-xs text-ink-muted">
                Public bulletin of verified physical repairs and maintenance across Malda College
              </p>
            </div>
            <Link
              href="/issues"
              className="text-xs font-semibold text-maroon-800 hover:text-maroon-950 flex items-center gap-1"
            >
              <span>View All Campus Issues ({issues.length})</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {recentIssues.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {recentIssues.map((issue) => (
                <IssueCard key={issue.id} issue={issue} />
              ))}
            </div>
          ) : (
            <div className="p-6 rounded-lg border border-warm-300 bg-white text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-700 mx-auto" aria-hidden="true" />
              <h3 className="font-serif font-semibold text-base text-ink">
                All Campus Infrastructure Nominal
              </h3>
              <p className="text-xs text-ink-muted max-w-md mx-auto">
                No active work orders currently require public notice. Students and faculty who observe damaged fixtures or safety hazards can lodge an immediate requisition.
              </p>
              <div className="pt-2">
                <Link href="/report">
                  <Button
                    size="sm"
                    variant="primary"
                    leftIcon={<PlusCircle className="w-3.5 h-3.5 text-gold-400" />}
                  >
                    Lodge Campus Requisition
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Standard Operating Procedure (SOP) */}
        <div className="rounded-lg border border-warm-300 bg-white p-5 sm:p-6 shadow-subtle">
          <div className="border-b border-warm-200 pb-3 mb-5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-maroon-800 block">
              Institutional Protocol
            </span>
            <h2 className="font-serif font-bold text-lg sm:text-xl text-ink">
              Malda College Incident Lifecycle (SOP)
            </h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Approved maintenance resolution workflow under the Internal Quality Assurance Cell (IQAC)
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-3.5 rounded bg-warm-50 border border-warm-200 space-y-1.5">
              <span className="font-mono font-bold text-xs text-maroon-800 bg-white px-2 py-0.5 rounded border border-warm-200 inline-block">
                01. Intake
              </span>
              <h3 className="font-serif font-semibold text-sm text-ink">Incident Lodge</h3>
              <p className="text-xs text-ink-muted leading-relaxed">
                Students and faculty submit photographic evidence and designate exact classroom or lab coordinates.
              </p>
            </div>

            <div className="p-3.5 rounded bg-warm-50 border border-warm-200 space-y-1.5">
              <span className="font-mono font-bold text-xs text-maroon-800 bg-white px-2 py-0.5 rounded border border-warm-200 inline-block">
                02. Triage
              </span>
              <h3 className="font-serif font-semibold text-sm text-ink">Urgency Assessment</h3>
              <p className="text-xs text-ink-muted leading-relaxed">
                Automated triage checks hazard severity, flags life-safety threats, and recommends departmental routing.
              </p>
            </div>

            <div className="p-3.5 rounded bg-warm-50 border border-warm-200 space-y-1.5">
              <span className="font-mono font-bold text-xs text-maroon-800 bg-white px-2 py-0.5 rounded border border-warm-200 inline-block">
                03. Dispatch
              </span>
              <h3 className="font-serif font-semibold text-sm text-ink">Work Dispatch</h3>
              <p className="text-xs text-ink-muted leading-relaxed">
                Duty officer confirms work order and dispatches licensed campus technicians (Electrical, Plumbing, IT).
              </p>
            </div>

            <div className="p-3.5 rounded bg-warm-50 border border-warm-200 space-y-1.5">
              <span className="font-mono font-bold text-xs text-emerald-800 bg-white px-2 py-0.5 rounded border border-emerald-200 inline-block">
                04. Verification
              </span>
              <h3 className="font-serif font-semibold text-sm text-ink">Verified Closure</h3>
              <p className="text-xs text-ink-muted leading-relaxed">
                Field completion proof logged, resolution note signed off, and student notified upon completion.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
