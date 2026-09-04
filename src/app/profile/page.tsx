'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useIssues } from '@/context/IssuesContext';
import { Button } from '@/components/ui/Button';
import { IssueCard } from '@/components/issues/IssueCard';
import {
  GraduationCap,
  Mail,
  Phone,
  Building,
  LogOut,
} from 'lucide-react';

export default function ProfilePage() {
  const router = useRouter();
  const { user, role, logout, supabaseConfigured } = useAuth();
  const { issues } = useIssues();

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
        <p className="text-sm text-ink-muted">
          {supabaseConfigured
            ? 'You are not signed in.'
            : 'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to use CampusPulse.'}
        </p>
        <Link href="/login" className="text-maroon-700 font-semibold hover:underline mt-2 inline-block">
          Sign in →
        </Link>
      </div>
    );
  }

  const myIssues = issues.filter(
    (i) => i.reporter.id === user.id || i.reporter.email === user.email,
  );

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header Profile Card */}
      <div className="rounded-xl border border-warm-300 bg-white p-6 shadow-card space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-warm-200 pb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-maroon-100 border-2 border-maroon-700 flex items-center justify-center text-maroon-900 font-serif font-bold text-2xl overflow-hidden shadow-sm">
              {user.name.charAt(0)}
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
              onClick={handleLogout}
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
                {user.studentId || user.staffId || '—'}
              </span>
            </div>
          </div>

          <div className="p-3 bg-warm-50 rounded border border-warm-200 flex items-center gap-3">
            <Phone className="w-4 h-4 text-maroon-700 shrink-0" />
            <div>
              <span className="text-[11px] text-ink-muted uppercase font-medium block">Contact</span>
              <span className="font-medium text-ink">{user.phone || '—'}</span>
            </div>
          </div>

          <div className="p-3 bg-warm-50 rounded border border-warm-200 flex items-center gap-3">
            <Building className="w-4 h-4 text-maroon-700 shrink-0" />
            <div>
              <span className="text-[11px] text-ink-muted uppercase font-medium block">Campus</span>
              <span className="font-medium text-ink">Malda College</span>
            </div>
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
            You have not submitted any reports yet.
          </p>
        )}
      </div>
    </div>
  );
}
