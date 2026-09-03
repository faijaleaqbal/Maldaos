'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useIssues } from '@/context/IssuesContext';
import { isMockModeEnabled, setMockMode } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { IssueCard } from '@/components/issues/IssueCard';
import {
  User,
  GraduationCap,
  Mail,
  Phone,
  Building,
  Shield,
  Clock,
  Database,
  RefreshCw,
  LogOut,
} from 'lucide-react';

export default function ProfilePage() {
  const { user, role, switchRole, logout } = useAuth();
  const { issues, resetData } = useIssues();

  const isMock = isMockModeEnabled();

  const myIssues = issues.filter(
    (i) => i.reporter.id === user.id || i.reporter.name === user.name
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header Profile Card */}
      <div className="rounded-xl border border-warm-300 bg-white p-6 shadow-card space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-warm-200 pb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-maroon-100 border-2 border-maroon-700 flex items-center justify-center text-maroon-900 font-serif font-bold text-2xl overflow-hidden shadow-sm">
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                user.name.charAt(0)
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-serif font-bold text-xl sm:text-2xl text-ink">{user.name}</h1>
                <span className="text-xs bg-maroon-100 text-maroon-900 font-semibold px-2 py-0.5 rounded border border-maroon-300">
                  {role}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-ink-muted">
                {user.department || 'Malda College Department Unit'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => logout()}
              leftIcon={<LogOut className="w-3.5 h-3.5" />}
            >
              Sign Out
            </Button>
          </div>
        </div>

        {/* User Institutional Credentials */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
          <div className="p-3 bg-warm-50 rounded border border-warm-200 flex items-center gap-3">
            <Mail className="w-4 h-4 text-maroon-700 shrink-0" />
            <div>
              <span className="text-[11px] text-ink-muted uppercase font-medium block">Institutional Email</span>
              <span className="font-medium text-ink">{user.email}</span>
            </div>
          </div>

          <div className="p-3 bg-warm-50 rounded border border-warm-200 flex items-center gap-3">
            <GraduationCap className="w-4 h-4 text-maroon-700 shrink-0" />
            <div>
              <span className="text-[11px] text-ink-muted uppercase font-medium block">
                {role === 'STUDENT' ? 'College Registration / Roll No' : 'Employee Staff Code'}
              </span>
              <span className="font-medium font-mono text-ink">
                {user.studentId || user.staffId || 'MC-REG-2024-819'}
              </span>
            </div>
          </div>

          <div className="p-3 bg-warm-50 rounded border border-warm-200 flex items-center gap-3">
            <Phone className="w-4 h-4 text-maroon-700 shrink-0" />
            <div>
              <span className="text-[11px] text-ink-muted uppercase font-medium block">Emergency Contact</span>
              <span className="font-medium text-ink">{user.phone || '+91 98321 45012'}</span>
            </div>
          </div>

          <div className="p-3 bg-warm-50 rounded border border-warm-200 flex items-center gap-3">
            <Building className="w-4 h-4 text-maroon-700 shrink-0" />
            <div>
              <span className="text-[11px] text-ink-muted uppercase font-medium block">Assigned Campus Node</span>
              <span className="font-medium text-ink">Malda College Main Campus</span>
            </div>
          </div>
        </div>

        {/* Developer / Hackathon Telemetry Settings */}
        <div className="p-4 bg-warm-100/70 rounded-lg border border-warm-300 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-maroon-800" />
              <h4 className="font-semibold text-xs sm:text-sm text-ink">
                Platform Data Layer Configuration
              </h4>
            </div>
            <span
              className={`text-[11px] px-2 py-0.5 rounded font-mono font-semibold ${
                isMock ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-emerald-100 text-emerald-900'
              }`}
            >
              {isMock ? 'MOCK DATA MODE' : 'LIVE SUPABASE MODE'}
            </span>
          </div>
          <p className="text-xs text-ink-muted leading-relaxed">
            CampusPulse operates reliably out of the box with realistic Malda College incidents, and seamlessly synchronizes with PostgreSQL via Supabase when environment keys are set.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setMockMode(!isMock)}
            >
              Toggle to {isMock ? 'Live Supabase' : 'Mock Data'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => resetData()}
              leftIcon={<RefreshCw className="w-3 h-3" />}
            >
              Reset Mock Incidents
            </Button>
          </div>
        </div>
      </div>

      {/* Submissions by this user */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-warm-300 pb-2">
          <h2 className="font-serif font-bold text-lg text-ink">
            My Incident Submission History ({myIssues.length})
          </h2>
          <Link href="/report">
            <Button size="sm" variant="primary">
              Report Another Issue
            </Button>
          </Link>
        </div>

        {myIssues.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myIssues.map((issue) => (
              <IssueCard key={issue.id} issue={issue} />
            ))}
          </div>
        ) : (
          <p className="text-xs text-ink-muted py-4">
            You have not submitted any reports yet under this persona.
          </p>
        )}
      </div>
    </div>
  );
}
