'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useIssues } from '@/context/IssuesContext';
import { Issue } from '@/types';
import { IssuesService, DepartmentOption } from '@/services/issues.service';
import { AssignmentDrawer } from '@/components/admin/AssignmentDrawer';
import { PriorityBadge } from '@/components/issues/PriorityBadge';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { Phone, Users, Shield, UserCheck, Wrench, Search, Filter } from 'lucide-react';

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
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const [staff, depts] = await Promise.all([
          IssuesService.getAllStaff(),
          IssuesService.getDepartments(),
        ]);
        if (!cancelled) {
          setStaffList(staff);
          setDepartments(depts);
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
    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  const openDrawer = (issue: Issue) => {
    setSelectedIssue(issue);
    setIsDrawerOpen(true);
  };

  const filteredStaff = useMemo(() => {
    return staffList.filter((s) => {
      if (selectedDept !== 'ALL') {
        if (s.department_id !== selectedDept && s.department_name !== selectedDept) {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = s.full_name.toLowerCase().includes(q);
        const matchDept = (s.department_name || '').toLowerCase().includes(q);
        const matchPhone = (s.phone || '').toLowerCase().includes(q);
        if (!matchName && !matchDept && !matchPhone) return false;
      }
      return true;
    });
  }, [staffList, selectedDept, searchQuery]);

  const unassignedCount = issues.filter(
    (i) => !i.assignedTo && i.status !== 'RESOLVED' && i.status !== 'CLOSED'
  ).length;

  const totalAssignedCount = issues.filter(
    (i) => i.assignedTo && i.status !== 'RESOLVED' && i.status !== 'CLOSED'
  ).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
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

      {/* Capacity Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-xl border border-warm-300 shadow-card">
          <span className="text-xs text-ink-muted uppercase font-semibold block mb-1">
            Registered Duty Personnel
          </span>
          <span className="font-mono text-2xl font-bold text-ink">{staffList.length} Staff</span>
          <span className="text-[11px] text-ink-muted block mt-1">
            Technicians & Department Admins
          </span>
        </div>
        <div className="p-4 bg-white rounded-xl border border-warm-300 shadow-card">
          <span className="text-xs text-ink-muted uppercase font-semibold block mb-1">
            In-Flight Assigned Work Orders
          </span>
          <span className="font-mono text-2xl font-bold text-emerald-800">
            {totalAssignedCount} Orders
          </span>
          <span className="text-[11px] text-emerald-900 block mt-1">
            Currently in technician custody
          </span>
        </div>
        <div className="p-4 bg-white rounded-xl border border-warm-300 shadow-card">
          <span className="text-xs text-ink-muted uppercase font-semibold block mb-1">
            Unassigned Incident Queue
          </span>
          <span className="font-mono text-2xl font-bold text-amber-800">
            {unassignedCount} Pending
          </span>
          <span className="text-[11px] text-amber-900 block mt-1">
            Awaiting administrator dispatch
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-lg border border-warm-300 bg-white p-4 shadow-subtle flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-ink-muted absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by staff name, department, or phone number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-md border border-warm-300 focus:outline-none focus:border-maroon-700 focus:ring-1 focus:ring-maroon-700"
          />
        </div>

        <div className="w-full sm:w-auto">
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="w-full sm:w-auto p-2 text-xs rounded border border-warm-300 bg-white text-ink focus:outline-none focus:border-maroon-700"
          >
            <option value="ALL">All Departments ({staffList.length} staff)</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name} ({dept.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <LoadingState message="Loading authenticated staff directory..." />
      ) : error ? (
        <ErrorState
          title="Directory Fetch Failed"
          message={error}
          onRetry={() => window.location.reload()}
        />
      ) : filteredStaff.length === 0 ? (
        <EmptyState
          title="No Staff Personnel Found"
          description="No active staff or department administrators matched the search criteria."
          actionLabel="Reset Search"
          onAction={() => {
            setSearchQuery('');
            setSelectedDept('ALL');
          }}
        />
      ) : (
        /* Real Staff Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredStaff.map((staff) => {
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

            const loadLevel =
              staffTickets.length >= 4
                ? { label: 'High Load', color: 'bg-amber-100 text-amber-900 border-amber-300' }
                : staffTickets.length > 0
                ? { label: 'Active', color: 'bg-emerald-100 text-emerald-900 border-emerald-300' }
                : { label: 'Available', color: 'bg-warm-100 text-ink border-warm-300' };

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

                  <span className={`text-[10px] font-semibold border px-2 py-0.5 rounded ${loadLevel.color}`}>
                    {loadLevel.label}
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
