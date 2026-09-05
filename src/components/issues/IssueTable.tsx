'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Issue, IssuePriority, IssueStatus } from '@/types';
import { IssueStatusBadge } from './IssueStatusBadge';
import { PriorityBadge } from './PriorityBadge';
import { Button } from '@/components/ui/Button';
import {
  MapPin,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  UserCheck,
  ArrowUpDown,
} from 'lucide-react';

interface IssueTableProps {
  issues: Issue[];
  onOpenQuickView?: (issue: Issue) => void;
  onAssignClick?: (issue: Issue) => void;
}

export const IssueTable: React.FC<IssueTableProps> = ({
  issues,
  onOpenQuickView,
  onAssignClick,
}) => {
  const [sortField, setSortField] = useState<'ticket' | 'priority' | 'age'>('age');
  const [sortAsc, setSortAsc] = useState(false);

  const getPriorityWeight = (p: IssuePriority) => {
    switch (p as string) {
      case 'URGENT':
      case 'CRITICAL':
        return 4;
      case 'HIGH':
        return 3;
      case 'MEDIUM':
        return 2;
      case 'LOW':
        return 1;
      default:
        return 0;
    }
  };

  const sortedIssues = [...issues].sort((a, b) => {
    if (sortField === 'priority') {
      const diff = getPriorityWeight(a.priority) - getPriorityWeight(b.priority);
      return sortAsc ? diff : -diff;
    }
    if (sortField === 'ticket') {
      return sortAsc
        ? a.ticketNumber.localeCompare(b.ticketNumber)
        : b.ticketNumber.localeCompare(a.ticketNumber);
    }
    // Age default
    const timeA = new Date(a.createdAt).getTime();
    const timeB = new Date(b.createdAt).getTime();
    return sortAsc ? timeA - timeB : timeB - timeA;
  });

  const toggleSort = (field: 'ticket' | 'priority' | 'age') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const calculateAge = (dateStr: string) => {
    const hours = Math.round((Date.now() - new Date(dateStr).getTime()) / (1000 * 3600));
    if (hours < 1) return '< 1h';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="relative rounded-lg border border-warm-300 bg-white shadow-card overflow-hidden">
      {/* Mobile swipe hint */}
      <div className="block sm:hidden px-3 py-1.5 bg-warm-50 border-b border-warm-200 text-[11px] text-ink-muted flex items-center justify-between">
        <span>Scroll horizontally to inspect full work order details →</span>
      </div>
      <div
        tabIndex={0}
        role="region"
        aria-label="Campus work order queue table"
        className="overflow-x-auto focus-visible:ring-2 focus-visible:ring-maroon-700 focus-visible:outline-none"
      >
        <table className="w-full text-left border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-warm-300 bg-warm-100/90 text-ink-muted text-[11px] font-semibold uppercase tracking-wider">
              <th
                scope="col"
                aria-sort={sortField === 'ticket' ? (sortAsc ? 'ascending' : 'descending') : 'none'}
                className="py-2.5 px-3.5"
              >
                <button
                  type="button"
                  onClick={() => toggleSort('ticket')}
                  className="flex items-center gap-1 hover:text-maroon-800 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon-700 rounded py-1 px-0.5"
                >
                  <span>Ticket</span>
                  <ArrowUpDown className="w-3 h-3" aria-hidden="true" />
                </button>
              </th>
              <th scope="col" className="py-3 px-3.5">Issue Description</th>
              <th scope="col" className="py-3 px-3.5 hidden md:table-cell">Location</th>
              <th
                scope="col"
                aria-sort={sortField === 'priority' ? (sortAsc ? 'ascending' : 'descending') : 'none'}
                className="py-2.5 px-3.5"
              >
                <button
                  type="button"
                  onClick={() => toggleSort('priority')}
                  className="flex items-center gap-1 hover:text-maroon-800 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon-700 rounded py-1 px-0.5"
                >
                  <span>Priority</span>
                  <ArrowUpDown className="w-3 h-3" aria-hidden="true" />
                </button>
              </th>
              <th scope="col" className="py-3 px-3.5 hidden lg:table-cell">Department</th>
              <th scope="col" className="py-3 px-3.5">Status</th>
              <th
                scope="col"
                aria-sort={sortField === 'age' ? (sortAsc ? 'ascending' : 'descending') : 'none'}
                className="py-2.5 px-3.5 hidden sm:table-cell"
              >
                <button
                  type="button"
                  onClick={() => toggleSort('age')}
                  className="flex items-center gap-1 hover:text-maroon-800 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon-700 rounded py-1 px-0.5"
                >
                  <span>Age</span>
                  <ArrowUpDown className="w-3 h-3" aria-hidden="true" />
                </button>
              </th>
              <th scope="col" className="py-3 px-3.5 hidden xl:table-cell">Assigned Staff</th>
              <th scope="col" className="py-3 px-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-warm-200">
            {sortedIssues.map((issue) => {
              const isCritical = (issue.priority === 'URGENT' || (issue.priority as string) === 'CRITICAL') && issue.status !== 'RESOLVED' && issue.status !== 'CLOSED';

              return (
                <tr
                  key={issue.id}
                  className={`hover:bg-warm-50/80 transition-colors ${
                    isCritical ? 'bg-rose-50/40' : ''
                  }`}
                >
                  {/* Ticket ID */}
                  <td className="py-3 px-3.5 font-mono text-xs font-semibold text-ink whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      {isCritical && (
                        <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0" title="High Urgency Work Order" />
                      )}
                      <Link
                        href={`/issues/${issue.id}`}
                        className="text-maroon-800 hover:text-maroon-950 hover:underline"
                      >
                        {issue.ticketNumber}
                      </Link>
                    </div>
                  </td>

                  {/* Issue title */}
                  <td className="py-3 px-3.5 max-w-[260px] sm:max-w-[320px]">
                    <div className="space-y-0.5">
                      <button
                        type="button"
                        onClick={() => onOpenQuickView && onOpenQuickView(issue)}
                        className="font-medium text-ink hover:text-maroon-800 cursor-pointer line-clamp-1 leading-snug text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-maroon-700 rounded"
                        aria-label={`Inspect work order details for ${issue.ticketNumber}: ${issue.title}`}
                      >
                        {issue.title}
                      </button>
                      <div className="flex items-center gap-2 text-[11px] text-ink-muted">
                        <span>{issue.category.replace('_', ' ')}</span>
                        {issue.aiAnalysis && !issue.aiAnalysis.isFallback && (
                          <span className="inline-flex items-center text-ink-muted bg-warm-100 border border-warm-200 px-1.5 py-0.2 rounded font-mono text-[10px]" title="Technical Advisory Recorded">
                            Advisory
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Location */}
                  <td className="py-3 px-3.5 hidden md:table-cell max-w-[180px]">
                    <div className="flex items-center gap-1.5 text-xs text-ink-muted">
                      <MapPin className="w-3 h-3 text-maroon-700 shrink-0" aria-hidden="true" />
                      <span className="truncate" title={`${issue.location.building} - ${issue.location.roomOrLandmark}`}>
                        {issue.location.building.split('(')[0]}
                      </span>
                    </div>
                  </td>

                  {/* Priority */}
                  <td className="py-3 px-3.5 whitespace-nowrap">
                    <PriorityBadge priority={issue.priority} />
                  </td>

                  {/* Department */}
                  <td className="py-3 px-3.5 hidden lg:table-cell text-xs text-ink-muted whitespace-nowrap">
                    {issue.department}
                  </td>

                  {/* Status */}
                  <td className="py-3 px-3.5 whitespace-nowrap">
                    <IssueStatusBadge status={issue.status} />
                  </td>

                  {/* Age */}
                  <td className="py-3 px-3.5 hidden sm:table-cell text-xs text-ink-muted font-mono whitespace-nowrap">
                    {calculateAge(issue.createdAt)}
                  </td>

                  {/* Assigned Staff */}
                  <td className="py-3 px-3.5 hidden xl:table-cell text-xs whitespace-nowrap">
                    {issue.assignedTo ? (
                      <div className="flex items-center gap-1.5 text-ink">
                        <span className="w-5 h-5 rounded-full bg-warm-200 flex items-center justify-center text-[10px] font-semibold text-maroon-800">
                          {issue.assignedTo.name.charAt(0)}
                        </span>
                        <span className="truncate max-w-[120px]">{issue.assignedTo.name}</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onAssignClick && onAssignClick(issue)}
                        aria-label={`Assign staff to work order ${issue.ticketNumber}`}
                        className="text-amber-800 hover:text-amber-950 font-medium text-xs flex items-center gap-1 p-1.5 min-h-[36px] hover:bg-amber-50 rounded touch-manipulation focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-700"
                      >
                        <UserCheck className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Unassigned</span>
                      </button>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-3.5 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      {onOpenQuickView && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => onOpenQuickView(issue)}
                          className="h-8 text-xs px-2.5 touch-manipulation"
                          aria-label={`Inspect work order ${issue.ticketNumber}`}
                        >
                          Inspect
                        </Button>
                      )}
                      <Link href={`/issues/${issue.id}`}>
                        <Button size="sm" variant="outline" className="h-8 text-xs px-2 touch-manipulation" title="Full ticket view" aria-label={`View full ticket for ${issue.ticketNumber}`}>
                          <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                        </Button>
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
