'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useIssues } from '@/context/IssuesContext';
import { Issue, IssueCategory, IssuePriority, IssueStatus } from '@/types';
import { DepartmentOption, IssuesService } from '@/services/issues.service';
import { IssueTable } from '@/components/issues/IssueTable';
import { AssignmentDrawer } from '@/components/admin/AssignmentDrawer';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import {
  Search,
  PlusCircle,
  Download,
  RefreshCw,
} from 'lucide-react';

type SortOption = 'NEWEST' | 'OLDEST' | 'PRIORITY' | 'ENDORSEMENTS';

const PRIORITY_WEIGHTS: Record<IssuePriority, number> = {
  URGENT: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export default function AdminIssuesPage() {
  const { issues, loading, error, refreshIssues } = useIssues();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('NEWEST');

  const [departments, setDepartments] = useState<DepartmentOption[]>([]);

  // Drawer state
  const [activeIssue, setActiveIssue] = useState<Issue | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    IssuesService.getDepartments()
      .then((depts) => {
        if (!cancelled) setDepartments(depts);
      })
      .catch((err) => {
        console.error('Failed to load departments for issue filter:', err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Filter and sort issues
  const filteredAndSortedIssues = useMemo(() => {
    const filtered = issues.filter((issue) => {
      if (selectedCategory !== 'ALL' && issue.category !== selectedCategory) return false;
      if (selectedStatus !== 'ALL') {
        if (selectedStatus === 'UNASSIGNED') {
          if (issue.assignedTo || issue.status === 'RESOLVED' || issue.status === 'CLOSED') {
            return false;
          }
        } else if (issue.status !== selectedStatus) {
          return false;
        }
      }
      if (selectedPriority !== 'ALL' && issue.priority !== selectedPriority) return false;
      if (selectedDepartment !== 'ALL') {
        const matchesDept =
          issue.departmentId === selectedDepartment ||
          issue.department?.toLowerCase().includes(selectedDepartment.toLowerCase());
        if (!matchesDept) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTicket = issue.ticketNumber.toLowerCase().includes(q);
        const matchTitle = issue.title.toLowerCase().includes(q);
        const matchDesc = issue.description.toLowerCase().includes(q);
        const matchBuilding = issue.location.building.toLowerCase().includes(q);
        const matchRoom = issue.location.roomOrLandmark.toLowerCase().includes(q);
        const matchStaff = issue.assignedTo?.name.toLowerCase().includes(q);
        const matchReporter = issue.reporter?.name.toLowerCase().includes(q);
        if (
          !matchTicket &&
          !matchTitle &&
          !matchDesc &&
          !matchBuilding &&
          !matchRoom &&
          !matchStaff &&
          !matchReporter
        ) {
          return false;
        }
      }

      return true;
    });

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'OLDEST':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'PRIORITY': {
          const pDiff = (PRIORITY_WEIGHTS[b.priority] || 0) - (PRIORITY_WEIGHTS[a.priority] || 0);
          if (pDiff !== 0) return pDiff;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        case 'ENDORSEMENTS':
          return (b.upvotes || 0) - (a.upvotes || 0);
        case 'NEWEST':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
  }, [
    issues,
    selectedCategory,
    selectedStatus,
    selectedDepartment,
    selectedPriority,
    searchQuery,
    sortBy,
  ]);

  const handleOpenDrawer = (issue: Issue) => {
    setActiveIssue(issue);
    setIsDrawerOpen(true);
  };

  const exportCSV = () => {
    const headers = [
      'Ticket',
      'Title',
      'Category',
      'Priority',
      'Status',
      'Building',
      'Room',
      'Department',
      'AssignedStaff',
      'CreatedAt',
      'ResolvedAt',
    ];
    const rows = filteredAndSortedIssues.map((i) => [
      i.ticketNumber,
      `"${i.title.replace(/"/g, '""')}"`,
      i.category,
      i.priority,
      i.status,
      `"${i.location.building}"`,
      `"${i.location.roomOrLandmark}"`,
      `"${i.department}"`,
      i.assignedTo ? `"${i.assignedTo.name}"` : 'Unassigned',
      i.createdAt,
      i.resolvedAt || '',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Malda_College_Work_Orders_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('ALL');
    setSelectedStatus('ALL');
    setSelectedDepartment('ALL');
    setSelectedPriority('ALL');
    setSortBy('NEWEST');
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <LoadingState message="Loading administrative incident queue from PostgreSQL..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ErrorState
          title="Incident Queue Unavailable"
          message={error}
          onRetry={refreshIssues}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-warm-300 pb-4">
        <div>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl text-ink">
            Administrative Issue Management Queue
          </h1>
          <p className="text-xs sm:text-sm text-ink-muted">
            Triage, dispatch duty officers, and audit campus repairs across all facility units
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={refreshIssues}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={exportCSV}
            leftIcon={<Download className="w-3.5 h-3.5" />}
          >
            Export Audit CSV
          </Button>
          <Link href="/report">
            <Button size="sm" variant="primary" leftIcon={<PlusCircle className="w-3.5 h-3.5" />}>
              Create Work Order
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="rounded-lg border border-warm-300 bg-white p-4 shadow-subtle space-y-3">
        {/* Search Bar */}
        <div className="relative">
          <label htmlFor="admin-queue-search" className="sr-only">
            Search incident queue
          </label>
          <Search className="w-4 h-4 text-ink-muted absolute left-3 top-2.5" aria-hidden="true" />
          <input
            id="admin-queue-search"
            type="text"
            placeholder="Search by ticket number, title, classroom, building, reporter, staff..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-md border border-warm-300 focus:outline-none focus:border-maroon-700 focus:ring-1 focus:ring-maroon-700"
          />
        </div>

        {/* Filter Dropdowns Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          {/* Status Filter */}
          <div>
            <label htmlFor="admin-filter-status" className="text-[11px] font-semibold text-ink-muted uppercase block mb-1">
              Status
            </label>
            <select
              id="admin-filter-status"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full p-2 rounded border border-warm-300 bg-white text-ink text-xs focus:outline-none focus:border-maroon-700 min-h-[38px]"
            >
              <option value="ALL">All Statuses ({issues.length})</option>
              <option value="UNASSIGNED">Unassigned Pool</option>
              <option value="OPEN">Open (Logged)</option>
              <option value="ASSIGNED">Assigned (Dispatched)</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed (Archived)</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <label htmlFor="admin-filter-priority" className="text-[11px] font-semibold text-ink-muted uppercase block mb-1">
              Priority
            </label>
            <select
              id="admin-filter-priority"
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="w-full p-2 rounded border border-warm-300 bg-white text-ink text-xs focus:outline-none focus:border-maroon-700 min-h-[38px]"
            >
              <option value="ALL">All Priorities</option>
              <option value="URGENT">Urgent (Safety Critical)</option>
              <option value="HIGH">High Urgency</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low / Routine</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label htmlFor="admin-filter-category" className="text-[11px] font-semibold text-ink-muted uppercase block mb-1">
              Category
            </label>
            <select
              id="admin-filter-category"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full p-2 rounded border border-warm-300 bg-white text-ink text-xs focus:outline-none focus:border-maroon-700 min-h-[38px]"
            >
              <option value="ALL">All Categories</option>
              <option value="INFRASTRUCTURE">Infrastructure</option>
              <option value="ACADEMICS">Academics</option>
              <option value="HOSTEL">Hostel</option>
              <option value="CLEANLINESS">Cleanliness</option>
              <option value="SAFETY">Safety</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          {/* Department Filter */}
          <div>
            <label htmlFor="admin-filter-department" className="text-[11px] font-semibold text-ink-muted uppercase block mb-1">
              Department
            </label>
            <select
              id="admin-filter-department"
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full p-2 rounded border border-warm-300 bg-white text-ink text-xs focus:outline-none focus:border-maroon-700 min-h-[38px]"
            >
              <option value="ALL">All Departments</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name} ({dept.code})
                </option>
              ))}
            </select>
          </div>

          {/* Sort By Filter */}
          <div>
            <label htmlFor="admin-filter-sort" className="text-[11px] font-semibold text-ink-muted uppercase block mb-1">
              Sort By
            </label>
            <select
              id="admin-filter-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="w-full p-2 rounded border border-warm-300 bg-white text-ink text-xs focus:outline-none focus:border-maroon-700 font-medium min-h-[38px]"
            >
              <option value="NEWEST">Newest First</option>
              <option value="OLDEST">Oldest First</option>
              <option value="PRIORITY">Highest Priority</option>
              <option value="ENDORSEMENTS">Most Endorsed</option>
            </select>
          </div>
        </div>

        {/* Active Filter Metrics */}
        <div className="flex items-center justify-between text-xs text-ink-muted pt-2 border-t border-warm-200">
          <span>
            Showing <strong>{filteredAndSortedIssues.length}</strong> of <strong>{issues.length}</strong> work orders
          </span>
          {(selectedCategory !== 'ALL' ||
            selectedStatus !== 'ALL' ||
            selectedDepartment !== 'ALL' ||
            selectedPriority !== 'ALL' ||
            searchQuery.trim() !== '') && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-maroon-800 hover:text-maroon-950 font-semibold hover:underline cursor-pointer"
            >
              Clear all filters
            </button>
          )}
        </div>
      </div>

      {/* Issues Table */}
      {filteredAndSortedIssues.length > 0 ? (
        <IssueTable
          issues={filteredAndSortedIssues}
          onOpenQuickView={handleOpenDrawer}
          onAssignClick={handleOpenDrawer}
        />
      ) : (
        <EmptyState
          title="No incident tickets match current operational filters"
          description="Try adjusting your search query, clearing category filters, or selecting 'All Statuses'."
          actionLabel="Reset Filters"
          onAction={handleResetFilters}
        />
      )}

      {/* Slide-over Drawer for Triage, Staff Assignment & Proof Verification */}
      <AssignmentDrawer
        issue={activeIssue}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </div>
  );
}
