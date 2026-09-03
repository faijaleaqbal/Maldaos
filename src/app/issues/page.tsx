'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useIssues } from '@/context/IssuesContext';
import { useAuth } from '@/context/AuthContext';
import { Issue, IssueCategory, IssuePriority, IssueStatus } from '@/types';
import { IssueCard } from '@/components/issues/IssueCard';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/common/EmptyState';
import {
  Search,
  Filter,
  PlusCircle,
  SlidersHorizontal,
  LayoutGrid,
  List,
  CheckCircle2,
  Clock,
  ThumbsUp,
} from 'lucide-react';

export default function IssuesListPage() {
  const { issues, loading } = useIssues();
  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [scope, setScope] = useState<'ALL' | 'MY'>('ALL');
  const [sortBy, setSortBy] = useState<'NEWEST' | 'UPVOTES' | 'PRIORITY'>('NEWEST');

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
      <div className="rounded-lg border border-warm-300 bg-white p-4 shadow-subtle space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-ink-muted absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by ticket number, classroom, equipment, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-md border border-warm-300 focus:outline-none focus:border-maroon-700 focus:ring-1 focus:ring-maroon-700 bg-white"
            />
          </div>

          {/* Scope Toggle: All Campus vs My Reports */}
          <div className="flex rounded-md border border-warm-300 p-0.5 bg-warm-100 text-xs font-medium shrink-0">
            <button
              type="button"
              onClick={() => setScope('ALL')}
              className={`px-3 py-1.5 rounded transition-colors cursor-pointer ${
                scope === 'ALL' ? 'bg-white text-maroon-900 shadow-sm font-semibold' : 'text-ink-muted'
              }`}
            >
              All Campus Issues ({issues.length})
            </button>
            <button
              type="button"
              onClick={() => setScope('MY')}
              className={`px-3 py-1.5 rounded transition-colors cursor-pointer ${
                scope === 'MY' ? 'bg-white text-maroon-900 shadow-sm font-semibold' : 'text-ink-muted'
              }`}
            >
              My Submissions
            </button>
          </div>

          {/* Sorting Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 rounded-md border border-warm-300 text-xs sm:text-sm text-ink bg-white focus:outline-none focus:border-maroon-700 cursor-pointer shrink-0"
          >
            <option value="NEWEST">Sort: Newest First</option>
            <option value="UPVOTES">Sort: Most Endorsed</option>
            <option value="PRIORITY">Sort: Highest Severity</option>
          </select>
        </div>

        {/* Category & Status Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-warm-200 text-xs">
          <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider mr-1">
            Category:
          </span>
          {['ALL', 'ELECTRICAL', 'PLUMBING', 'IT_NETWORK', 'FACILITY_CLASSROOM', 'LAB_EQUIPMENT', 'SANITATION', 'SAFETY_SECURITY'].map(
            (cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-maroon-700 text-white font-medium'
                    : 'bg-warm-100 hover:bg-warm-200 text-ink-muted'
                }`}
              >
                {cat === 'ALL' ? 'All Categories' : cat.replace('_', ' ')}
              </button>
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
            <button
              key={st.val}
              type="button"
              onClick={() => setSelectedStatus(st.val)}
              className={`px-2.5 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                selectedStatus === st.val
                  ? 'bg-warm-400 text-ink font-semibold'
                  : 'bg-warm-100 hover:bg-warm-200 text-ink-muted'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Issues Feed Grid */}
      {sortedIssues.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedIssues.map((issue) => (
            <IssueCard key={issue.id} issue={issue} />
          ))}
        </div>
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
