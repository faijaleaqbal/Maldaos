'use client';

import React, { useState } from 'react';
import { useIssues } from '@/context/IssuesContext';
import { Issue } from '@/types';
import { AssignmentDrawer } from '@/components/admin/AssignmentDrawer';
import { IssueStatusBadge } from '@/components/issues/IssueStatusBadge';
import { PriorityBadge } from '@/components/issues/PriorityBadge';
import { Button } from '@/components/ui/Button';
import {
  UserCheck,
  Phone,
  CheckCircle2,
  Clock,
  Layers,
  Wrench,
  Sparkles,
  ArrowRight,
  Shield,
} from 'lucide-react';

const TECHNICIANS = [
  {
    id: 'usr-staff-01',
    name: 'Subhashish Roy',
    role: 'Senior Electrical Technician',
    department: 'Electrical & Facility Operations',
    phone: '+91 94340 77189',
    specialty: 'High Voltage, Sub-distribution, AV Projectors',
    status: 'ACTIVE_DUTY',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'usr-staff-02',
    name: 'Biren Mondal',
    role: 'Civil Infrastructure Officer',
    department: 'Civil Works & Plumbing',
    phone: '+91 94342 11982',
    specialty: 'Overhead Tanks, Pipeline stacks, Masonry',
    status: 'ACTIVE_DUTY',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'usr-staff-03',
    name: 'Kallol Sarkar',
    role: 'Sanitation & Estate Supervisor',
    department: 'Civil Works & Sanitation',
    phone: '+91 98320 44109',
    specialty: 'Canteen Kitchen, Common Hall, Waste Management',
    status: 'ACTIVE_DUTY',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'usr-staff-04',
    name: 'Soumen Debnath',
    role: 'Network Engineer',
    department: 'IT & Network Cell',
    phone: '+91 94341 00293',
    specialty: 'Campus Wi-Fi APs, Fiber Backbone, Lab Workstations',
    status: 'ACTIVE_DUTY',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
  },
];

export default function AssignmentsPage() {
  const { issues } = useIssues();
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const openDrawer = (issue: Issue) => {
    setSelectedIssue(issue);
    setIsDrawerOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="border-b border-warm-300 pb-4">
        <h1 className="font-serif font-bold text-2xl sm:text-3xl text-ink">
          Workforce Roster & Duty Assignments
        </h1>
        <p className="text-xs sm:text-sm text-ink-muted">
          Active duty personnel, department capacity, and dispatched field work orders
        </p>
      </div>

      {/* Technicians Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {TECHNICIANS.map((tech) => {
          // Issues assigned to this technician
          const techTickets = issues.filter(
            (i) => i.assignedTo?.name === tech.name && i.status !== 'RESOLVED' && i.status !== 'CLOSED'
          );
          const resolvedByTech = issues.filter(
            (i) => i.assignedTo?.name === tech.name && (i.status === 'RESOLVED' || i.status === 'CLOSED')
          );

          return (
            <div
              key={tech.id}
              className="rounded-xl border border-warm-300 bg-white p-5 shadow-card space-y-4"
            >
              {/* Tech Header */}
              <div className="flex items-start justify-between gap-3 border-b border-warm-200 pb-3">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={tech.avatar}
                    alt={tech.name}
                    className="w-12 h-12 rounded-full object-cover border border-warm-300"
                  />
                  <div>
                    <h3 className="font-serif font-bold text-base text-ink">{tech.name}</h3>
                    <p className="text-xs text-maroon-900 font-medium">{tech.role}</p>
                    <span className="text-[11px] text-ink-muted">{tech.department}</span>
                  </div>
                </div>

                <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded">
                  On Duty
                </span>
              </div>

              {/* Contact & Specialty */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
                <div className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-maroon-700" />
                  <span className="font-mono text-ink">{tech.phone}</span>
                </div>
                <span className="text-[11px] bg-warm-100 px-2 py-0.5 rounded">
                  {tech.specialty}
                </span>
              </div>

              {/* Workload Metrics */}
              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <div className="p-2 rounded bg-warm-50 border border-warm-200">
                  <span className="font-mono text-base font-bold text-maroon-900">
                    {techTickets.length}
                  </span>
                  <span className="block text-[11px] text-ink-muted">Active Work Orders</span>
                </div>
                <div className="p-2 rounded bg-warm-50 border border-warm-200">
                  <span className="font-mono text-base font-bold text-emerald-700">
                    {resolvedByTech.length}
                  </span>
                  <span className="block text-[11px] text-ink-muted">Resolved History</span>
                </div>
              </div>

              {/* Active Assigned Tickets List */}
              <div className="space-y-2 pt-2 border-t border-warm-200">
                <span className="text-[11px] font-semibold text-ink uppercase tracking-wider block">
                  Current In-flight Tickets:
                </span>
                {techTickets.length > 0 ? (
                  techTickets.map((ticket) => (
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
                  <p className="text-xs text-ink-muted italic py-1">No active tickets currently assigned.</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <AssignmentDrawer
        issue={selectedIssue}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </div>
  );
}
