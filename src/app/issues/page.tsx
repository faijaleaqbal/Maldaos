'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useIssues } from '@/context/IssuesContext';
import { useAuth } from '@/context/AuthContext';
import { Issue, IssueCategory, IssuePriority, IssueStatus } from '@/types';
import { IssueCard } from '@/components/issues/IssueCard';
import { IssueTable } from '@/components/issues/IssueTable';
import { Button } from '@/components/ui/Button';
import {
  SpatialTabs,
  SpatialFilter,
  SpatialSearch,
  SpatialSelect,
} from '@/components/ui/SpatialControls';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import {
  Search,
  Filter,
  PlusCircle,
  LayoutGrid,
  List,
} from 'lucide-react';

export default function IssuesListPage() {
  const { issues, loading, error, refreshIssues } = useIssues();
  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [scope, setScope] = useState<'ALL' | 'MY'>('ALL');
  const [sortBy, setSortBy] = useState<'NEWEST' | 'UPVOTES' | 'PRIORITY'>('NEWEST');
  const [viewMode, setViewMode] = useState<'QUEUE' | 'CARDS'>('QUEUE');


  // Filtering
  const filteredIssues = issues.filter((issue) => {
    if (scope === 'MY' && issue.reporter.id !== user.id && issue.reporter.name !== user.name) {
      return false;
    }

    if (selectedCategory !== 'ALL' && issue.category !== selectedCategory) {
      return false;
    }

    if (selectedStatus !== 'ALL') {
      if (selectedStatus === 'OPEN' && (issue.status === 'RESOLVED' || issue.status === 'CLOSED')) {
        return false;
      }
      if (selectedStatus === 'RESOLVED' && issue.status !== 'RESOLVED' && issue.status !== 'CLOSED') {
        return false;
      }
      if (selectedStatus === 'IN_PROGRESS' && issue.status !== 'IN_PROGRESS' && issue.status !== 'ASSIGNED') {
        return false;
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = issue.title.toLowerCase().includes(q);
      const matchDesc = issue.description.toLowerCase().includes(q);
      const matchTicket = issue.ticketNumber.toLowerCase().includes(q);
      const matchBuilding = issue.location.building.toLowerCase().includes(q);
      const matchLandmark = issue.location.roomOrLandmark.toLowerCase().includes(q);

      if (!matchTitle && !matchDesc && !matchTicket && !matchBuilding && !matchLandmark) {
        return false;
      }
    }

    return true;
  });

  // Sorting
  const sortedIssues = [...filteredIssues].sort((a, b) => {
    if (sortBy === 'UPVOTES') {
      return (b.upvotes || 0) - (a.upvotes || 0);
    }
    if (sortBy === 'PRIORITY') {
      const priorityWeights: Record<IssuePriority, number> = {
        URGENT: 4,
        HIGH: 3,
        MEDIUM: 2,
        LOW: 1,
      };
      return priorityWeights[b.priority] - priorityWeights[a.priority];
    }
    // NEWEST
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <LoadingState message="Loading campus maintenance feed..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <ErrorState message={error} onRetry={refreshIssues} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-warm-300 pb-4">
        <div>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl text-ink">
            Campus Issues & Maintenance Feed
          </h1>
          <p className="text-xs sm:text-sm text-ink-muted">
            Track and verify campus repairs across Malda College academic and administrative blocks
          </p>
        </div>

        <Link href="/report">
          <Button variant="primary" leftIcon={<PlusCircle className="w-4 h-4" />}>
            Report an Issue
          </Button>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-lg border border-warm-300 bg-white p-4 shadow-subtle space-y-3.5">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
          {/* Spatial Search Box */}
          <SpatialSearch
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClear={() => setSearchQuery('')}
            placeholder="Search by ticket number, classroom, equipment, or description..."
          />

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Scope Toggle: All Campus vs My Reports (Spatial Tabs) */}
            <SpatialTabs<'ALL' | 'MY'>
              tabs={[
                { id: 'ALL', label: 'All Campus Issues', count: issues.length },
                { id: 'MY', label: 'My Submissions' },
              ]}
              activeTab={scope}
              onChange={(id) => setScope(id)}
              layoutId="issues-scope-tab"
              ariaLabel="Issue scope filter"
              className="shrink-0"
            />

            {/* View Mode Toggle: Ledger vs Cards (Spatial Tabs) */}
            <SpatialTabs<'QUEUE' | 'CARDS'>
              tabs={[
                { id: 'QUEUE', label: 'Ledger', icon: <List className="w-3.5 h-3.5" /> },
                { id: 'CARDS', label: 'Cards', icon: <LayoutGrid className="w-3.5 h-3.5" /> },
              ]}
              activeTab={viewMode}
              onChange={(id) => setViewMode(id)}
              layoutId="issues-view-mode-tab"
              ariaLabel="View layout"
              className="shrink-0"
            />

            {/* Spatial Sorting Dropdown */}
            <SpatialSelect
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              aria-label="Sort issues by"
            />
          </div>
        </div>

        {/* Category & Status Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2.5 border-t border-warm-200 text-xs">
          <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider mr-1">
            Category:
          </span>
          {['ALL', 'ELECTRICAL', 'PLUMBING', 'IT_NETWORK', 'FACILITY_CLASSROOM', 'LAB_EQUIPMENT', 'SANITATION', 'SAFETY_SECURITY'].map(
            (cat) => (
              <SpatialFilter
                key={cat}
                active={selectedCategory === cat}
                onClick={() => setSelectedCategory(cat)}
                label={cat === 'ALL' ? 'All Categories' : cat.replace('_', ' ')}
                variant="category"
              />
            )
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider mr-1">
            Status:
          </span>
          {[
            { label: 'All Statuses', val: 'ALL' },
            { label: 'Open & Active', val: 'OPEN' },
            { label: 'In Progress', val: 'IN_PROGRESS' },
            { label: 'Resolved Only', val: 'RESOLVED' },
          ].map((st) => (
            <SpatialFilter
              key={st.val}
              active={selectedStatus === st.val}
              onClick={() => setSelectedStatus(st.val)}
              label={st.label}
              variant="status"
            />
          ))}
        </div>
      </div>

      {/* Issues Feed / Ledger */}
      {sortedIssues.length > 0 ? (
        viewMode === 'QUEUE' ? (
          <div className="bg-white rounded-md border border-warm-300 shadow-subtle overflow-hidden">
            <IssueTable issues={sortedIssues} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedIssues.map((issue) => (
              <IssueCard key={issue.id} issue={issue} />
            ))}
          </div>
        )
      ) : (
        <EmptyState
          title="No campus issues found"
          description="Try adjusting your filters or search keywords, or lodge a new issue if you noticed something broken."
          actionLabel="Clear Filters"
          onAction={() => {
            setSearchQuery('');
            setSelectedCategory('ALL');
            setSelectedStatus('ALL');
            setScope('ALL');
          }}
        />
      )}
    </div>
  );
}
