'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useIssues } from '@/context/IssuesContext';
import { Issue, IssueCategory, IssuePriority, IssueStatus } from '@/types';
import { IssueTable } from '@/components/issues/IssueTable';
import { AssignmentDrawer } from '@/components/admin/AssignmentDrawer';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/common/EmptyState';
import {
  Search,
  Filter,
  PlusCircle,
  Download,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  RefreshCw,
} from 'lucide-react';

export default function AdminIssuesPage() {
  const { issues, loading, refreshIssues } = useIssues();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');

  // Drawer state
  const [activeIssue, setActiveIssue] = useState<Issue | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Filter issues
  const filteredIssues = issues.filter((issue) => {
    if (selectedCategory !== 'ALL' && issue.category !== selectedCategory) return false;
    if (selectedStatus !== 'ALL') {
      if (selectedStatus === 'UNASSIGNED' && issue.assignedTo) return false;
      else if (selectedStatus !== 'UNASSIGNED' && issue.status !== selectedStatus) return false;
    }
    if (selectedPriority !== 'ALL' && issue.priority !== selectedPriority) return false;
    if (selectedDepartment !== 'ALL' && !issue.department.includes(selectedDepartment)) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTicket = issue.ticketNumber.toLowerCase().includes(q);
      const matchTitle = issue.title.toLowerCase().includes(q);
      const matchLoc = issue.location.building.toLowerCase().includes(q) || issue.location.roomOrLandmark.toLowerCase().includes(q);
      const matchStaff = issue.assignedTo?.name.toLowerCase().includes(q);
      if (!matchTicket && !matchTitle && !matchLoc && !matchStaff) return false;
    }

    return true;
  });

  const handleOpenDrawer = (issue: Issue) => {
    setActiveIssue(issue);
    setIsDrawerOpen(true);
  };

  const exportCSV = () => {
    const headers = ['Ticket', 'Title', 'Category', 'Priority', 'Status', 'Building', 'Room', 'Department', 'AssignedStaff', 'CreatedAt'];
    const rows = filteredIssues.map((i) => [
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
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Malda_College_Issues_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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

        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={exportCSV} leftIcon={<Download className="w-3.5 h-3.5" />}>
            Export Audit CSV
          </Button>
          <Link href="/report">
            <Button size="sm" variant="primary" leftIcon={<PlusCircle className="w-3.5 h-3.5" />}>
              Create Internal Work Order
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="rounded-lg border border-warm-300 bg-white p-4 shadow-subtle space-y-3">
        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-ink-muted absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by ticket number, classroom, staff name, or keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-md border border-warm-300 focus:outline-none focus:border-maroon-700 focus:ring-1 focus:ring-maroon-700"
          />
        </div>

        {/* Filter Dropdowns Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="text-[11px] font-semibold text-ink-muted uppercase block mb-1">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full p-2 rounded border border-warm-300 bg-white text-ink text-xs focus:outline-none focus:border-maroon-700"
            >
              <option value="ALL">All Statuses ({issues.length})</option>
              <option value="UNASSIGNED">Unassigned Only</option>
              <option value="REPORTED">Reported</option>
              <option value="AI_ANALYZED">AI Analyzed</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RESOLVED">Resolved</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-ink-muted uppercase block mb-1">Priority</label>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="w-full p-2 rounded border border-warm-300 bg-white text-ink text-xs focus:outline-none focus:border-maroon-700"
            >
              <option value="ALL">All Priorities</option>
              <option value="CRITICAL">Critical Only</option>
              <option value="HIGH">High Urgency</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-ink-muted uppercase block mb-1">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full p-2 rounded border border-warm-300 bg-white text-ink text-xs focus:outline-none focus:border-maroon-700"
            >
              <option value="ALL">All Categories</option>
              <option value="ELECTRICAL">Electrical</option>
              <option value="PLUMBING">Plumbing</option>
              <option value="IT_NETWORK">IT & Network</option>
              <option value="FACILITY_CLASSROOM">Classroom & Furniture</option>
              <option value="LAB_EQUIPMENT">Laboratory Equipment</option>
              <option value="SANITATION">Sanitation & Hygiene</option>
              <option value="SAFETY_SECURITY">Safety & Security</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-ink-muted uppercase block mb-1">Department</label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full p-2 rounded border border-warm-300 bg-white text-ink text-xs focus:outline-none focus:border-maroon-700"
            >
              <option value="ALL">All Departments</option>
              <option value="Electrical">Electrical Operations</option>
              <option value="Plumbing">Civil Works & Plumbing</option>
              <option value="IT">IT & Network Cell</option>
              <option value="Sanitation">Sanitation</option>
              <option value="Infrastructure">Academic Infrastructure</option>
            </select>
          </div>
        </div>
      </div>

      {/* Issues Table */}
      {filteredIssues.length > 0 ? (
        <IssueTable
          issues={filteredIssues}
          onOpenQuickView={handleOpenDrawer}
          onAssignClick={handleOpenDrawer}
        />
      ) : (
        <EmptyState
          title="No incident tickets match current operational filters"
          description="Try clearing your search query or selecting 'All Statuses'."
          actionLabel="Reset Filters"
          onAction={() => {
            setSearchQuery('');
            setSelectedCategory('ALL');
            setSelectedStatus('ALL');
            setSelectedDepartment('ALL');
            setSelectedPriority('ALL');
          }}
        />
      )}

      {/* Slide-over Drawer for Triage & Staff Assignment */}
      <AssignmentDrawer
        issue={activeIssue}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </div>
  );
}
