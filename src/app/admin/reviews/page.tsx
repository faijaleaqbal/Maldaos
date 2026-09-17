'use client';

import React, { useMemo, useState } from 'react';
import { useIssues } from '@/context/IssuesContext';
import { useAuth } from '@/context/AuthContext';
import { Issue } from '@/types';
import { staffQueueState, StaffQueueState } from '@/lib/backendTypes';
import { AssignmentDrawer } from '@/components/admin/AssignmentDrawer';
import { IssueStatusBadge } from '@/components/issues/IssueStatusBadge';
import { PriorityBadge } from '@/components/issues/PriorityBadge';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { Inbox, RefreshCw, Search } from 'lucide-react';

type QueueFilter = 'ALL' | StaffQueueState;

const QUEUE_LABELS: Record<QueueFilter, string> = {
  ALL: 'All in my department',
  PENDING_REVIEW: 'Pending Staff Review',
  ESCALATED: 'Escalated',
  CONFIRMED: 'Confirmed — at Head',
  REJECTED: 'Rejected',
  DECIDED: 'Head Decided',
  NOT_OPEN: 'Beyond Review (assigned+)',
};

const QUEUE_VARIANT: Record<StaffQueueState, 'warning' | 'danger' | 'success' | 'muted' | 'maroon' | 'outline'> = {
  PENDING_REVIEW: 'warning',
  ESCALATED: 'danger',
  CONFIRMED: 'maroon',
  REJECTED: 'muted',
  DECIDED: 'success',
  NOT_OPEN: 'outline',
};

function queueLabel(s: StaffQueueState): string {
  return QUEUE_LABELS[s];
}

/**
 * Stage-3 — Staff department review queue.
 * Shows ONLY the viewer's department scope (RLS already enforces; the client
 * additionally filters by department name so a super admin sees per-dept
 * sections without cross-department action affordances).
 * Confirm/Reject/Escalate happens inside AssignmentDrawer (review_report RPC).
 */
export default function StaffReviewsPage() {
  const { issues, loading, error, refreshIssues } = useIssues();
  const { user } = useAuth();
  const [filter, setFilter] = useState<QueueFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeIssue, setActiveIssue] = useState<Issue | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const myDept = (user.department || '').toLowerCase();
  const isSuper = user.role === 'SUPER_ADMIN';

  const scoped = useMemo(() => {
    // RLS already scopes rows; this client filter only picks the display slice.
    const inScope = isSuper
      ? issues
      : issues.filter((i) => (i.department || '').toLowerCase() === myDept);
    return inScope.map((issue) => ({ issue, queue: staffQueueState(issue) }));
  }, [issues, isSuper, myDept]);

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
        <LoadingState message="Loading department review queue..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ErrorState title="Review Queue Unavailable" message={error} onRetry={refreshIssues} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-warm-300 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Inbox className="w-4 h-4 text-maroon-700" />
            <span className="font-mono text-xs font-semibold text-maroon-900 uppercase tracking-wider">
              {isSuper ? 'All Departments — Review Lens' : `${user.department} — Staff Queue`}
            </span>
          </div>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl text-ink">
            Department Review Queue
          </h1>
          <p className="text-xs sm:text-sm text-ink-muted">
            Confirm genuine reports to head approval, reject with reason, or escalate urgent cases.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={refreshIssues} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
          Refresh
        </Button>
      </div>

      {/* Queue state filter chips */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Review queue filter">
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
        <label htmlFor="staff-queue-search" className="sr-only">Search review queue</label>
        <Search className="w-4 h-4 text-ink-muted absolute left-3 top-2.5" aria-hidden="true" />
        <input
          id="staff-queue-search"
          type="text"
          placeholder="Search by ticket, title, room, sub-category…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-md border border-warm-300 bg-white focus:outline-none focus:border-maroon-700 focus:ring-1 focus:ring-maroon-700"
        />
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="No reports in this review state"
          description="New student reports for your department will appear here for staff review."
          actionLabel="Show All"
          onAction={() => { setFilter('ALL'); setSearchQuery(''); }}
        />
      ) : (
        <div className="rounded-xl border border-warm-300 bg-white divide-y divide-warm-200 overflow-hidden shadow-subtle">
          {visible.map(({ issue, queue }) => (
            <div
              key={issue.id}
              role="button"
              tabIndex={0}
              aria-label={`Review ${issue.ticketNumber}: ${issue.title}`}
              onClick={() => openDrawer(issue)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDrawer(issue); }
              }}
              className="p-3.5 hover:bg-warm-50 transition-colors cursor-pointer space-y-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon-700"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-mono text-xs font-semibold text-maroon-900 bg-maroon-50 px-1.5 py-0.5 rounded">
                  {issue.ticketNumber}
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant={QUEUE_VARIANT[queue]}>{queueLabel(queue)}</Badge>
                  {issue.reportType === 'SUGGESTION' && <Badge variant="gold">Suggestion</Badge>}
                  <PriorityBadge priority={issue.priority} />
                  <IssueStatusBadge status={issue.status} />
                </div>
              </div>
              <h4 className="font-serif font-semibold text-sm text-ink line-clamp-1">{issue.title}</h4>
              <p className="text-[11px] text-ink-muted truncate">
                {issue.subcategory ? `${issue.subcategory} • ` : ''}{issue.location.building} • {issue.location.roomOrLandmark}
              </p>
            </div>
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
