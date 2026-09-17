'use client';

import React, { useMemo, useState } from 'react';
import { useIssues } from '@/context/IssuesContext';
import { useAuth } from '@/context/AuthContext';
import { Issue, IssueStatus } from '@/types';
import { adminQueueState, AdminQueueState } from '@/lib/backendTypes';
import { AssignmentDrawer } from '@/components/admin/AssignmentDrawer';
import { IssueStatusBadge } from '@/components/issues/IssueStatusBadge';
import { PriorityBadge } from '@/components/issues/PriorityBadge';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { Stamp, RefreshCw, Search } from 'lucide-react';

type QueueFilter = 'ALL' | AdminQueueState;

const QUEUE_LABELS: Record<QueueFilter, string> = {
  ALL: 'All awaiting + decided',
  AWAITING_ADMIN: 'Awaiting My Approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  RETURNED: 'Returned to Staff',
  AWAITING_STAFF: 'Awaiting Staff Review',
  NOT_OPEN: 'Beyond Review (assigned+)',
};

const QUEUE_VARIANT: Record<AdminQueueState, 'warning' | 'danger' | 'success' | 'muted' | 'maroon' | 'outline'> = {
  AWAITING_ADMIN: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  RETURNED: 'maroon',
  AWAITING_STAFF: 'muted',
  NOT_OPEN: 'outline',
};

/**
 * Stage-4 — Department approval queue + per-department dashboard strip.
 * Dept heads see ONLY their own department (client slice; RLS enforces).
 * Super admins see the per-department breakdown across all departments.
 * Approve/Reject/Return happens inside AssignmentDrawer (admin_decide RPC);
 * dispatch itself stays in the existing AssignmentDrawer dispatch section.
 */
export default function AdminApprovalsPage() {
  const { issues, loading, error, refreshIssues } = useIssues();
  const { user } = useAuth();
  const [filter, setFilter] = useState<QueueFilter>('AWAITING_ADMIN');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeIssue, setActiveIssue] = useState<Issue | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const myDept = (user.department || '').toLowerCase();
  const isSuper = user.role === 'SUPER_ADMIN';

  const scoped = useMemo(() => {
    const inScope = isSuper
      ? issues
      : issues.filter((i) => (i.department || '').toLowerCase() === myDept);
    return inScope.map((issue) => ({ issue, queue: adminQueueState(issue) }));
  }, [issues, isSuper, myDept]);

  // Per-department dashboard strip (counts only — no cross-dept actions).
  const deptStats = useMemo(() => {
    const map = new Map<string, { name: string; awaiting: number; approved: number; inProgress: number; resolved: number; open: number }>();
    for (const i of (isSuper ? issues : scoped.map((s) => s.issue))) {
      const name = i.department || 'Unassigned Department';
      const cur = map.get(name) || { name, awaiting: 0, approved: 0, inProgress: 0, resolved: 0, open: 0 };
      const q = adminQueueState(i);
      if (q === 'AWAITING_ADMIN') cur.awaiting += 1;
      if (q === 'APPROVED') cur.approved += 1;
      if (i.status === 'IN_PROGRESS' || i.status === 'ASSIGNED') cur.inProgress += 1;
      if (i.status === 'RESOLVED' || i.status === 'CLOSED') cur.resolved += 1;
      if (i.status === 'OPEN') cur.open += 1;
      map.set(name, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.awaiting - a.awaiting);
  }, [issues, scoped, isSuper]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: scoped.length };
    for (const { queue } of scoped) c[queue] = (c[queue] || 0) + 1;
    return c;
  }, [scoped]);

  const visible = useMemo(() => {
    return scoped.filter(({ issue, queue }) => {
      if (filter !== 'ALL' && queue !== filter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hay = `${issue.ticketNumber} ${issue.title} ${issue.description} ${issue.location.building} ${issue.location.roomOrLandmark} ${issue.subcategory || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [scoped, filter, searchQuery]);

  const openDrawer = (issue: Issue) => {
    setActiveIssue(issue);
    setIsDrawerOpen(true);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <LoadingState message="Loading approval queue..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ErrorState title="Approval Queue Unavailable" message={error} onRetry={refreshIssues} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-warm-300 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Stamp className="w-4 h-4 text-maroon-700" />
            <span className="font-mono text-xs font-semibold text-maroon-900 uppercase tracking-wider">
              {isSuper ? 'All Departments — Head Approvals' : `${user.department} — Head Approvals`}
            </span>
          </div>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl text-ink">
            Department Approval Queue
          </h1>
          <p className="text-xs sm:text-sm text-ink-muted">
            Staff-confirmed reports await your Approve / Reject / Return. Staff-CONFIRM gate is server-enforced.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={refreshIssues} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
          Refresh
        </Button>
      </div>

      {/* Department dashboard strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-label="Department approval summary">
        {deptStats.map((d) => (
          <div key={d.name} className="p-4 bg-white rounded-xl border border-warm-300 shadow-card space-y-2">
            <h3 className="font-serif font-bold text-base text-ink truncate" title={d.name}>{d.name}</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded bg-amber-50 border border-amber-200 text-center">
                <span className="font-mono text-lg font-bold text-amber-900 block">{d.awaiting}</span>
                <span className="text-[11px] text-amber-900">Awaiting Approval</span>
              </div>
              <div className="p-2 rounded bg-emerald-50 border border-emerald-200 text-center">
                <span className="font-mono text-lg font-bold text-emerald-800 block">{d.approved}</span>
                <span className="text-[11px] text-emerald-900">Approved</span>
              </div>
              <div className="p-2 rounded bg-warm-50 border border-warm-200 text-center">
                <span className="font-mono text-lg font-bold text-ink block">{d.inProgress}</span>
                <span className="text-[11px] text-ink-muted">In Progress</span>
              </div>
              <div className="p-2 rounded bg-warm-50 border border-warm-200 text-center">
                <span className="font-mono text-lg font-bold text-ink block">{d.resolved}</span>
                <span className="text-[11px] text-ink-muted">Resolved</span>
              </div>
            </div>
            <span className="text-[11px] text-ink-muted block">{d.open} open reports in department</span>
          </div>
        ))}
      </div>

      {/* Queue state filter chips */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Approval queue filter">
        {(Object.keys(QUEUE_LABELS) as QueueFilter[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            aria-pressed={filter === k}
            className={`px-3 py-1.5 min-h-[38px] rounded-md border text-xs font-medium touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon-700 ${
              filter === k
                ? 'bg-maroon-700 text-white border-maroon-700'
                : 'bg-white text-ink border-warm-300 hover:border-maroon-400'
            }`}
          >
            {QUEUE_LABELS[k]} ({counts[k] || 0})
          </button>
        ))}
      </div>

      <div className="relative">
        <label htmlFor="admin-approval-search" className="sr-only">Search approval queue</label>
        <Search className="w-4 h-4 text-ink-muted absolute left-3 top-2.5" aria-hidden="true" />
        <input
          id="admin-approval-search"
          type="text"
          placeholder="Search by ticket, title, room, sub-category…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-md border border-warm-300 bg-white focus:outline-none focus:border-maroon-700 focus:ring-1 focus:ring-maroon-700"
        />
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="No reports in this approval state"
          description="Staff-confirmed reports for your department will appear here for head approval."
          actionLabel="Show All"
          onAction={() => { setFilter('ALL'); setSearchQuery(''); }}
        />
      ) : (
        <div className="rounded-xl border border-warm-300 bg-white divide-y divide-warm-200 overflow-hidden shadow-subtle">
          {visible.map(({ issue, queue }) => (
            <ApprovalRow key={issue.id} issue={issue} queue={queue} onOpen={openDrawer} />
          ))}
        </div>
      )}

      <AssignmentDrawer
        issue={activeIssue}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </div>
  );
}

function ApprovalRow({ issue, queue, onOpen }: { issue: Issue; queue: AdminQueueState; onOpen: (i: Issue) => void }) {
  const staffConfirmed = (issue.reviews || []).some((r) => r.stage === 'STAFF_REVIEW' && r.decision === 'CONFIRM');
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Decide ${issue.ticketNumber}: ${issue.title}`}
      onClick={() => onOpen(issue)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(issue); }
      }}
      className="p-3.5 hover:bg-warm-50 transition-colors cursor-pointer space-y-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon-700"
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="font-mono text-xs font-semibold text-maroon-900 bg-maroon-50 px-1.5 py-0.5 rounded">
          {issue.ticketNumber}
        </span>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant={QUEUE_VARIANT[queue]}>{QUEUE_LABELS[queue]}</Badge>
          {issue.reportType === 'SUGGESTION' && <Badge variant="gold">Suggestion</Badge>}
          <PriorityBadge priority={issue.priority} />
          <IssueStatusBadge status={issue.status as IssueStatus} />
        </div>
      </div>
      <h4 className="font-serif font-semibold text-sm text-ink line-clamp-1">{issue.title}</h4>
      <p className="text-[11px] text-ink-muted truncate">
        {issue.subcategory ? `${issue.subcategory} • ` : ''}{issue.location.building} • {issue.location.roomOrLandmark}
        {!staffConfirmed && issue.status === 'OPEN' ? ' • awaiting staff confirm' : ''}
      </p>
    </div>
  );
}
