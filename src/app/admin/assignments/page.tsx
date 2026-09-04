'use client';

import React, { useEffect, useState } from 'react';
import { useIssues } from '@/context/IssuesContext';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';
import { CampusMap } from '@/components/map/CampusMap';
import { AssignmentDrawer } from '@/components/admin/AssignmentDrawer';
import { Issue } from '@/types';
import {
  Wrench, Flame, AlertTriangle, User as UserIcon, Phone, Hash,
} from 'lucide-react';

interface StaffRow {
  id: string;
  full_name: string;
  role: string;
  department_id: string | null;
  phone: string | null;
  is_active: boolean;
  department_name?: string;
  avatarUrl?: string | null;
}

export default function AssignmentsPage() {
  const { issues } = useIssues();
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isSupabaseConfigured()) {
        setError('Supabase is not configured.');
        setLoading(false);
        return;
      }
      const supabase = getSupabaseClient();
      if (!supabase) {
        setError('Supabase client unavailable.');
        setLoading(false);
        return;
      }
      try {
        // RLS scopes to same-college active staff+admins. We pull
        // department name via a separate join.
        const { data: rows, error: e } = await supabase
          .from('profiles')
          .select('id, full_name, role, department_id, phone, is_active, avatar_url')
          .in('role', ['STAFF', 'DEPARTMENT_ADMIN', 'SUPER_ADMIN'])
          .eq('is_active', true)
          .order('full_name');
        if (e) throw e;
        // Resolve department names if available.
        const deptIds = Array.from(new Set((rows ?? []).map((r: any) => r.department_id).filter(Boolean))) as string[];
        let deptMap: Record<string, string> = {};
        if (deptIds.length > 0) {
          const { data: depts } = await supabase
            .from('departments')
            .select('id, name')
            .in('id', deptIds);
          deptMap = Object.fromEntries(((depts ?? []) as any[]).map((d) => [d.id, d.name]));
        }
        if (!cancelled) {
          setStaff(
            ((rows ?? []) as any[]).map((r) => ({
              id: r.id,
              full_name: r.full_name,
              role: r.role,
              department_id: r.department_id,
              phone: r.phone,
              is_active: r.is_active,
              department_name: r.department_id ? deptMap[r.department_id] : undefined,
              avatarUrl: r.avatar_url ?? null,
            })),
          );
          setLoading(false);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message ?? 'Failed to load staff');
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const openDrawer = (issue: Issue) => {
    setSelectedIssue(issue);
    setIsDrawerOpen(true);
  };

  const initials = (name: string) =>
    name
      .split(/\s+/)
      .map((s) => s[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px- lg:px-8 py-6 space-y-6">
      <div className="border-b border-warm-300 pb-4">
        <h1 className="font-serif font-bold text-2xl sm:text-3xl text-ink">
          Workforce Roster & Duty Assignments
        </h1>
        <p className="text-xs sm:text-sm text-ink-muted">
          Active duty personnel sourced from <code className="font-mono">public.profiles</code> (RLS-scoped to your college).
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-300 bg-rose-50 p-4 text-xs text-rose-900 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-warm-300 bg-white p-6 text-xs text-ink-muted">Loading staff…</div>
      ) : staff.length === 0 ? (
        <div className="rounded-lg border border-warm-300 bg-white p-6 text-xs text-ink-muted flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>No active staff or admins in your college. Use the SUPER_ADMIN console to invite staff.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {staff.map((tech) => {
            const techTickets = issues.filter(
              (i) =>
                (i.assignedTo?.id === tech.id || i.assignedTo?.name === tech.full_name) &&
                i.status !== 'RESOLVED' &&
                i.status !== 'CLOSED',
            );
            const resolvedByTech = issues.filter(
              (i) =>
                (i.assignedTo?.id === tech.id || i.assignedTo?.name === tech.full_name) &&
                (i.status === 'RESOLVED' || i.status === 'CLOSED'),
            );

            return (
              <div key={tech.id} className="rounded-xl border border-warm-300 bg-white p-5 shadow-card space-y-4">
                <div className="flex items-start justify-between gap-3 border-b border-warm-200 pb-3">
                  <div className="flex items-center gap-3">
                    {tech.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={tech.avatarUrl}
                        alt={tech.full_name}
                        className="w-12 h-12 rounded-full object-cover border border-warm-300"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-maroon-100 text-maroon-900 font-semibold text-sm flex items-center justify-center border border-warm-300">
                        {initials(tech.full_name)}
                      </div>
                    )}
                    <div>
                      <h3 className="font-serif font-semibold text-base text-ink leading-snug">{tech.full_name}</h3>
                      <p className="text-[11px] text-ink-muted font-mono uppercase tracking-wider">
                        {tech.role.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded border border-emerald-300 shrink-0">
                    {tech.is_active ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="flex items-start gap-2">
                    <Wrench className="w-3.5 h-3.5 text-maroon-700 mt-0.5" />
                    <div>
                      <span className="text-[10px] text-ink-muted uppercase font-medium block">Department</span>
                      <span className="font-semibold text-ink">{tech.department_name ?? '—'}</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Hash className="w-3.5 h-3.5 text-maroon-700 mt-0.5" />
                    <div>
                      <span className="text-[10px] text-ink-muted uppercase font-medium block">Role</span>
                      <span className="font-mono text-ink">{tech.role}</span>
                    </div>
                  </div>
                  {tech.phone && (
                    <div className="flex items-start gap-2">
                      <Phone className="w-3.5 h-3.5 text-maroon-700 mt-0.5" />
                      <div>
                        <span className="text-[10px] text-ink-muted uppercase font-medium block">Phone</span>
                        <span className="font-mono text-ink">{tech.phone}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-warm-50 rounded border border-warm-200">
                    <span className="text-[10px] text-ink-muted uppercase font-semibold block">Active Tickets</span>
                    <span className="font-mono font-bold text-ink">{techTickets.length}</span>
                  </div>
                  <div className="p-2 bg-warm-50 rounded border border-warm-200">
                    <span className="text-[10px] text-ink-muted uppercase font-semibold block">Resolved</span>
                    <span className="font-mono font-bold text-emerald-700">{resolvedByTech.length}</span>
                  </div>
                </div>

                {techTickets.length > 0 && (
                  <div>
                    <span className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider block mb-1">
                      Open Assignments
                    </span>
                    <ul className="space-y-1 text-xs">
                      {techTickets.slice(0, 3).map((t) => (
                        <li
                          key={t.id}
                          onClick={() => openDrawer(t)}
                          className="flex items-center justify-between gap-1 p-1.5 rounded border border-warm-200 hover:bg-warm-50 cursor-pointer"
                        >
                          <span className="font-mono font-semibold text-maroon-900 text-[11px]">{t.ticketNumber}</span>
                          <span className="truncate text-ink-muted text-[11px] flex-1 ml-1">{t.title}</span>
                          {(t.priority === 'CRITICAL' || t.priority === 'HIGH') && (
                            <Flame className="w-3 h-3 text-rose-600" />
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AssignmentDrawer
        issue={selectedIssue}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </div>
  );
}
