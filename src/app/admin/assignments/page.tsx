'use client';

import React, { useState, useEffect } from 'react';
import { useIssues } from '@/context/IssuesContext';
import { Issue } from '@/types';
import { IssuesService } from '@/services/issues.service';
import { AssignmentDrawer } from '@/components/admin/AssignmentDrawer';
import { PriorityBadge } from '@/components/issues/PriorityBadge';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { Phone, Users, Shield, UserCheck, Wrench } from 'lucide-react';

interface StaffProfile {
  id: string;
  full_name: string;
  role: string;
  phone: string | null;
  department_id: string | null;
  department_name?: string;
}

export default function AssignmentsPage() {
  const { issues } = useIssues();
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadStaff() {
      try {
        setLoading(true);
        setError(null);
        const data = await IssuesService.getAllStaff();
        if (!cancelled) {
          setStaffList(data);
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error('Failed to load workforce roster:', err);
          setError(err?.message || 'Failed to load staff roster from database.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadStaff();
    return () => {
      cancelled = true;
    };
  }, []);

  const openDrawer = (issue: Issue) => {
    setSelectedIssue(issue);
    setIsDrawerOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="border-b border-warm-300 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <Users className="w-4 h-4 text-maroon-700" />
          <span className="font-mono text-xs font-semibold text-maroon-900 uppercase tracking-wider">
            Operational Directory
          </span>
        </div>
        <h1 className="font-serif font-bold text-2xl sm:text-3xl text-ink">
          Workforce Roster & Duty Assignments
        </h1>
        <p className="text-xs sm:text-sm text-ink-muted">
          Active duty personnel, department capacity, and dispatched field work orders from PostgreSQL profiles
        </p>
      </div>

      {loading ? (
        <LoadingState message="Loading authenticated staff directory..." />
      ) : error ? (
        <ErrorState
          title="Directory Fetch Failed"
          message={error}
          onRetry={() => window.location.reload()}
        />
      ) : staffList.length === 0 ? (
        <EmptyState
          title="No Staff Personnel Registered"
          description="No active staff or department administrators were found in the database directory."
        />
      ) : (
        /* Real Staff Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {staffList.map((staff) => {
            // Issues assigned to this technician (match by ID or full name)
            const staffTickets = issues.filter(
              (i) =>
                (i.assignedTo?.id === staff.id || i.assignedTo?.name === staff.full_name) &&
                i.status !== 'RESOLVED' &&
                i.status !== 'CLOSED'
            );
            const resolvedByStaff = issues.filter(
              (i) =>
                (i.assignedTo?.id === staff.id || i.assignedTo?.name === staff.full_name) &&
                (i.status === 'RESOLVED' || i.status === 'CLOSED')
            );

            return (
              <div
                key={staff.id}
                className="rounded-xl border border-warm-300 bg-white p-5 shadow-card space-y-4"
              >
                {/* Tech Header */}
                <div className="flex items-start justify-between gap-3 border-b border-warm-200 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-maroon-100 border border-maroon-300 flex items-center justify-center text-maroon-900 font-serif font-bold text-base">
                      {staff.full_name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-serif font-bold text-base text-ink">{staff.full_name}</h3>
                      <p className="text-xs text-maroon-900 font-medium">
                        {staff.role === 'DEPARTMENT_ADMIN' ? 'Department Administrator' : 'Technical Staff'}
                      </p>
                      <span className="text-[11px] text-ink-muted">{staff.department_name}</span>
                    </div>
                  </div>

                  <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded">
                    Active Duty
                  </span>
                </div>

                {/* Contact & Department */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-maroon-700" />
                    <span className="font-mono text-ink">
                      {staff.phone || 'Campus Extension Registered'}
                    </span>
                  </div>
                  <span className="text-[11px] bg-warm-100 text-ink px-2 py-0.5 rounded border border-warm-200">
                    {staff.department_name}
                  </span>
                </div>

                {/* Workload Metrics */}
                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="p-2 rounded bg-warm-50 border border-warm-200">
                    <span className="font-mono text-base font-bold text-maroon-900">
                      {staffTickets.length}
                    </span>
                    <span className="block text-[11px] text-ink-muted">Active Work Orders</span>
                  </div>
                  <div className="p-2 rounded bg-warm-50 border border-warm-200">
                    <span className="font-mono text-base font-bold text-emerald-700">
                      {resolvedByStaff.length}
                    </span>
                    <span className="block text-[11px] text-ink-muted">Resolved History</span>
                  </div>
                </div>

                {/* Active Assigned Tickets List */}
                <div className="space-y-2 pt-2 border-t border-warm-200">
                  <span className="text-[11px] font-semibold text-ink uppercase tracking-wider block">
                    Current Dispatched Tickets:
                  </span>
                  {staffTickets.length > 0 ? (
                    staffTickets.map((ticket) => (
                      <div
                        key={ticket.id}
                        onClick={() => openDrawer(ticket)}
                        className="p-2.5 rounded bg-warm-50 hover:bg-warm-100 border border-warm-200 cursor-pointer flex items-center justify-between text-xs transition-colors"
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="font-mono font-semibold text-maroon-900 text-[11px]">
                            {ticket.ticketNumber}
                          </span>
                          <span className="truncate text-ink max-w-[180px]">{ticket.title}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <PriorityBadge priority={ticket.priority} />
                          <span className="text-maroon-800 text-[11px] font-medium ml-1">Inspect →</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-ink-muted italic py-1">No active tickets currently dispatched.</p>
                  )}
                </div>
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
