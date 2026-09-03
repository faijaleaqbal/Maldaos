'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useIssues } from '@/context/IssuesContext';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { IssueCard } from '@/components/issues/IssueCard';
import { PriorityBadge } from '@/components/issues/PriorityBadge';
import { IssueStatusBadge } from '@/components/issues/IssueStatusBadge';
import {
  PlusCircle,
  Search,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Cpu,
  ArrowRight,
  Sparkles,
  MapPin,
  Activity,
  ChevronRight,
  GraduationCap,
  Building2,
} from 'lucide-react';

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
  const criticalIssue = issues.find((i) => i.priority === 'URGENT' && i.status !== 'RESOLVED' && i.status !== 'CLOSED');

  return (
    <div className="space-y-10 pb-12">
      {/* Top Urgent Incident Banner (if any critical issues active) */}
      {criticalIssue && (
        <div className="bg-rose-900 text-white px-4 py-2.5 text-xs">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
              <span className="font-semibold uppercase tracking-wider text-rose-200">
                Active Campus Safety Notice:
              </span>
              <span className="font-medium text-white">{criticalIssue.title}</span>
              <span className="text-rose-200 hidden md:inline">({criticalIssue.location.building})</span>
            </div>
            <Link
              href={`/issues/${criticalIssue.id}`}
              className="text-gold-300 hover:text-gold-200 underline font-semibold flex items-center gap-1"
            >
              <span>View Safety Status</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-warm-200/80 via-warm-100 to-warm-100 border-b border-warm-300 py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Narrative */}
            <div className="lg:col-span-7 space-y-5">
              <div className="inline-flex items-center gap-2 bg-maroon-50 border border-maroon-200 text-maroon-900 px-3 py-1 rounded-md text-xs font-semibold uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-maroon-700" />
                <span>Malda College Digital Infrastructure</span>
              </div>

              <h1 className="font-serif font-bold text-3xl sm:text-5xl text-maroon-950 tracking-tight leading-[1.15]">
                Responsive Campus Operations, Assisted by AI.
              </h1>

              <p className="text-sm sm:text-base text-ink-muted max-w-xl leading-relaxed font-sans">
                Malda College’s institutional platform for rapid issue reporting, physical facility diagnostics, and operational resolution. AI prioritizes and routes requests while campus duty officers take action.
              </p>

              {/* Action Buttons & Fast Ticket Search */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <Link href="/report">
                  <Button size="lg" variant="primary" leftIcon={<PlusCircle className="w-5 h-5 text-gold-400" />}>
                    Report Campus Issue
                  </Button>
                </Link>

                <Link href="/dashboard">
                  <Button size="lg" variant="secondary" rightIcon={<ArrowRight className="w-4 h-4" />}>
                    Open Student Dashboard
                  </Button>
                </Link>
              </div>

              {/* Fast Ticket Lookup Bar */}
              <form onSubmit={handleTicketSearch} className="pt-2 max-w-md">
                <div className="relative flex items-center">
                  <input
                    type="text"
                    placeholder="Enter Ticket ID (e.g. MC-2027-0104) to track status..."
                    value={searchTicket}
                    onChange={(e) => setSearchTicket(e.target.value)}
                    className="w-full rounded-md border border-warm-300 bg-white px-3.5 py-2 text-xs sm:text-sm text-ink pr-24 focus:outline-none focus:border-maroon-700 focus:ring-1 focus:ring-maroon-700 shadow-sm"
                  />
                  <button
                    type="submit"
                    className="absolute right-1 px-3 py-1 bg-maroon-700 hover:bg-maroon-800 text-white rounded text-xs font-medium cursor-pointer"
                  >
                    Track
                  </button>
                </div>
              </form>
            </div>

            {/* Right Operational Summary Card */}
            <div className="lg:col-span-5">
              <div className="rounded-xl border border-warm-300 bg-white p-5 sm:p-6 shadow-card space-y-4 relative">
                <div className="flex items-center justify-between border-b border-warm-200 pb-3">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-maroon-900 block">
                      Campus Operational Health
                    </span>
                    <h3 className="font-serif font-bold text-xl text-ink">Malda College Core Status</h3>
                  </div>
                  <div className="text-right">
                    <span className="font-serif text-3xl font-bold text-maroon-900">
                      {summary.campusHealth.overall}
                    </span>
                    <span className="text-xs text-ink-muted block">/ 100 Score</span>
                  </div>
                </div>

                {/* KPI Metrics Strip */}
                <div className="grid grid-cols-3 gap-2 py-1 text-center">
                  <div className="p-2.5 rounded bg-warm-100 border border-warm-200">
                    <span className="block font-mono text-lg font-bold text-ink">
                      {summary.openIssues}
                    </span>
                    <span className="text-[11px] text-ink-muted">Open Tickets</span>
                  </div>
                  <div className="p-2.5 rounded bg-warm-100 border border-warm-200">
                    <span className="block font-mono text-lg font-bold text-emerald-700">
                      {summary.resolutionRate}%
                    </span>
                    <span className="text-[11px] text-ink-muted">Resolution Rate</span>
                  </div>
                  <div className="p-2.5 rounded bg-warm-100 border border-warm-200">
                    <span className="block font-mono text-lg font-bold text-maroon-800">
                      {summary.averageResolutionHours}h
                    </span>
                    <span className="text-[11px] text-ink-muted">Avg MTTR</span>
                  </div>
                </div>

                {/* AI Triage Explainer Callout */}
                <div className="rounded-lg border border-ai-border bg-ai-surface p-3 text-xs text-ai-text flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-ai-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-semibold">AI Operational Triage Gateway</strong>
                    <p className="text-ink-muted mt-0.5 leading-relaxed">
                      Incident reports are automatically categorized, similarity-scored, and suggested for priority. Maintenance assignments remain human-verified.
                    </p>
                  </div>
                </div>

                {/* Role Switching Shortcut for Judges */}
                <div className="pt-2 border-t border-warm-200">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="text-ink-muted font-medium">Evaluate Experience As:</span>
                    <span className="text-maroon-800 font-semibold">{user.name} ({role})</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => switchRole('STUDENT')}
                      className={`p-2 rounded border text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                        role === 'STUDENT'
                          ? 'bg-maroon-700 text-white border-maroon-800'
                          : 'bg-warm-100 hover:bg-warm-200 border-warm-300 text-ink'
                      }`}
                    >
                      <GraduationCap className="w-3.5 h-3.5" />
                      <span>Student View</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => switchRole('SUPER_ADMIN')}
                      className={`p-2 rounded border text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                        role === 'SUPER_ADMIN'
                          ? 'bg-maroon-700 text-white border-maroon-800'
                          : 'bg-warm-100 hover:bg-warm-200 border-warm-300 text-ink'
                      }`}
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      <span>Admin Console</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Grid: Recent Issues & Operating Architecture */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Section 1: Recent Campus Activity */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-warm-300 pb-2">
            <div>
              <h2 className="font-serif font-bold text-xl text-ink">Active Campus Incident Reports</h2>
              <p className="text-xs text-ink-muted">
                Real-time visibility into Malda College facility maintenance
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recentIssues.map((issue) => (
              <IssueCard key={issue.id} issue={issue} />
            ))}
          </div>
        </div>

        {/* Section 2: How CampusPulse Works (Institutional Lifecycle) */}
        <div className="rounded-xl border border-warm-300 bg-white p-6 sm:p-8 shadow-card">
          <div className="text-center max-w-xl mx-auto mb-8 space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-maroon-800">
              Institutional Methodology
            </span>
            <h2 className="font-serif font-bold text-2xl text-ink">
              From Student Report to Verified Resolution
            </h2>
            <p className="text-xs sm:text-sm text-ink-muted">
              CampusPulse connects students directly with facility management cells through structured telemetry.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-4 rounded-lg bg-warm-50 border border-warm-200 space-y-2">
              <div className="w-8 h-8 rounded bg-maroon-100 text-maroon-800 font-mono font-bold flex items-center justify-center text-sm">
                01
              </div>
              <h3 className="font-serif font-semibold text-base text-ink">Lodge Report</h3>
              <p className="text-xs text-ink-muted leading-relaxed">
                Student captures photos, selects campus block, and describes classroom or lab faults.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-ai-surface border border-ai-border space-y-2">
              <div className="w-8 h-8 rounded bg-ai-100 text-ai-700 font-mono font-bold flex items-center justify-center text-sm">
                02
              </div>
              <h3 className="font-serif font-semibold text-base text-ink flex items-center gap-1.5">
                <span>AI Triage</span>
                <Sparkles className="w-3.5 h-3.5 text-ai-600" />
              </h3>
              <p className="text-xs text-ink-muted leading-relaxed">
                CampusPulse compares incident semantics, assesses hazard urgency, and suggests initial routing.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-warm-50 border border-warm-200 space-y-2">
              <div className="w-8 h-8 rounded bg-maroon-100 text-maroon-800 font-mono font-bold flex items-center justify-center text-sm">
                03
              </div>
              <h3 className="font-serif font-semibold text-base text-ink">Dispatch & Work</h3>
              <p className="text-xs text-ink-muted leading-relaxed">
                Duty officer confirms assignment and deploys skilled technicians (Electrical, Plumbing, IT Cell).
              </p>
            </div>

            <div className="p-4 rounded-lg bg-warm-50 border border-warm-200 space-y-2">
              <div className="w-8 h-8 rounded bg-emerald-100 text-emerald-800 font-mono font-bold flex items-center justify-center text-sm">
                04
              </div>
              <h3 className="font-serif font-semibold text-base text-ink">Verified Closure</h3>
              <p className="text-xs text-ink-muted leading-relaxed">
                Field completion proof logged, reporter notified, and telemetry indexed in Campus Health metrics.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Institutional Footer */}
      <footer className="border-t border-warm-300 bg-white pt-8 pb-12 mt-12 text-xs text-ink-muted">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-maroon-700 text-gold-400 font-serif font-bold text-xs flex items-center justify-center">
                MC
              </div>
              <span className="font-serif font-bold text-ink">MALDA COLLEGE</span>
            </div>
            <p className="leading-relaxed">
              Rabindra Avenue, Malda, West Bengal 732101.<br />
              Affiliated with University of Gour Banga. Established in 1944.
            </p>
          </div>

          <div className="space-y-1">
            <span className="font-semibold text-ink uppercase tracking-wider text-[11px] block">
              Emergency Maintenance Contacts
            </span>
            <p>Electrical Control Room: Ext 204 (+91 94340 77189)</p>
            <p>Sanitation & Estate: Ext 108</p>
            <p>IT & Campus Fiber Cell: Ext 314</p>
          </div>

          <div className="space-y-1">
            <span className="font-semibold text-ink uppercase tracking-wider text-[11px] block">
              CampusPulse Platform
            </span>
            <p>Hackathon 2027 Production Release.</p>
            <p>System Governor: Malda College Internal Quality Assurance Cell (IQAC).</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
