'use client';

import React, { useState } from 'react';
import { Issue, IssuePriority, IssueStatus } from '@/types';
import { useIssues } from '@/context/IssuesContext';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Input';
import { AIAnalysisPanel } from '@/components/ai/AIAnalysisPanel';
import { IssueStatusBadge } from '@/components/issues/IssueStatusBadge';
import { PriorityBadge } from '@/components/issues/PriorityBadge';
import { X, UserCheck, CheckCircle, Wrench, Clock, MapPin } from 'lucide-react';

interface AssignmentDrawerProps {
  issue: Issue | null;
  isOpen: boolean;
  onClose: () => void;
}

const STAFF_MEMBERS = [
  { id: 'usr-staff-01', name: 'Subhashish Roy', department: 'Electrical & Facility Operations', phone: '+91 94340 77189' },
  { id: 'usr-staff-02', name: 'Biren Mondal', department: 'Civil Works & Plumbing', phone: '+91 94342 11982' },
  { id: 'usr-staff-03', name: 'Kallol Sarkar', department: 'Civil Works & Sanitation', phone: '+91 98320 44109' },
  { id: 'usr-staff-04', name: 'Soumen Debnath', department: 'IT & Network Cell', phone: '+91 94341 00293' },
  { id: 'usr-staff-05', name: 'Bikash Murmu', department: 'Campus Security & Estate Office', phone: '+91 98325 66710' },
];

const STATUS_OPTIONS: { label: string; value: IssueStatus }[] = [
  { label: 'REPORTED', value: 'REPORTED' },
  { label: 'AI ANALYZED', value: 'AI_ANALYZED' },
  { label: 'ASSIGNED', value: 'ASSIGNED' },
  { label: 'IN PROGRESS', value: 'IN_PROGRESS' },
  { label: 'RESOLUTION SUBMITTED', value: 'RESOLUTION_SUBMITTED' },
  { label: 'RESOLVED', value: 'RESOLVED' },
  { label: 'CLOSED', value: 'CLOSED' },
];

export const AssignmentDrawer: React.FC<AssignmentDrawerProps> = ({
  issue,
  isOpen,
  onClose,
}) => {
  const { assignIssue, updateIssueStatus } = useIssues();

  const [selectedStaffId, setSelectedStaffId] = useState(issue?.assignedTo?.id || STAFF_MEMBERS[0].id);
  const [targetStatus, setTargetStatus] = useState<IssueStatus>(issue?.status || 'ASSIGNED');
  const [dispatchNote, setDispatchNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen || !issue) return null;

  const staffOptions = STAFF_MEMBERS.map((s) => ({
    label: `${s.name} (${s.department})`,
    value: s.id,
  }));

  const handleAssign = async () => {
    setIsProcessing(true);
    const chosenStaff = STAFF_MEMBERS.find((s) => s.id === selectedStaffId) || STAFF_MEMBERS[0];
    await assignIssue(issue.id, chosenStaff);
    if (targetStatus && targetStatus !== issue.status) {
      await updateIssueStatus(issue.id, targetStatus, dispatchNote);
    }
    setIsProcessing(false);
    onClose();
  };

  const handleQuickStatusChange = async (newStatus: IssueStatus) => {
    setIsProcessing(true);
    await updateIssueStatus(issue.id, newStatus, dispatchNote || `Status quickly shifted to ${newStatus}`);
    setIsProcessing(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-xl bg-white h-full shadow-2xl overflow-y-auto flex flex-col border-l border-warm-300">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-warm-200 bg-warm-50 flex items-center justify-between sticky top-0 z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-maroon-900 bg-maroon-100/80 px-2 py-0.5 rounded">
                {issue.ticketNumber}
              </span>
              <span className="text-xs text-ink-muted">Operational Work Order</span>
            </div>
            <h3 className="font-serif font-semibold text-base sm:text-lg text-ink mt-1 line-clamp-1">
              {issue.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-warm-200 hover:bg-warm-300 flex items-center justify-center text-ink cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-6 flex-1">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-warm-50 rounded-lg border border-warm-200 text-xs">
            <div>
              <span className="text-ink-muted block text-[11px] uppercase font-medium">Status</span>
              <IssueStatusBadge status={issue.status} />
            </div>
            <div>
              <span className="text-ink-muted block text-[11px] uppercase font-medium">Priority</span>
              <PriorityBadge priority={issue.priority} />
            </div>
            <div className="col-span-2">
              <span className="text-ink-muted block text-[11px] uppercase font-medium">Location</span>
              <div className="flex items-center gap-1 text-ink font-medium">
                <MapPin className="w-3.5 h-3.5 text-maroon-700" />
                <span>{issue.location.building} • {issue.location.roomOrLandmark}</span>
              </div>
            </div>
            <div className="col-span-2">
              <span className="text-ink-muted block text-[11px] uppercase font-medium">Reporter</span>
              <span className="text-ink">{issue.reporter.name} ({issue.reporter.role})</span>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <h4 className="text-xs font-semibold text-ink uppercase tracking-wider">Report Description</h4>
            <p className="text-xs sm:text-sm text-ink-muted leading-relaxed bg-warm-50/70 p-3 rounded border border-warm-200">
              {issue.description}
            </p>
          </div>

          {/* Evidence Photos */}
          {issue.images && issue.images.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-ink uppercase tracking-wider">Attached Evidence</h4>
              <div className="grid grid-cols-2 gap-2">
                {issue.images.map((img, idx) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={idx}
                    src={img}
                    alt="Evidence"
                    className="w-full h-28 object-cover rounded border border-warm-300"
                  />
                ))}
              </div>
            </div>
          )}

          {/* AI Analysis Panel */}
          <div>
            <h4 className="text-xs font-semibold text-ink uppercase tracking-wider mb-2">
              Automated Triage Suggestions
            </h4>
            <AIAnalysisPanel analysis={issue.aiAnalysis} />
          </div>

          {/* Assignment Controls */}
          <div className="p-4 rounded-lg border border-warm-300 bg-warm-100/50 space-y-3">
            <h4 className="font-serif font-semibold text-sm text-ink flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-maroon-700" />
              Assign / Dispatch Maintenance Personnel
            </h4>

            <Select
              label="Select Designated Duty Officer / Technician"
              options={staffOptions}
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
            />

            <Select
              label="Transition Ticket Status"
              options={STATUS_OPTIONS}
              value={targetStatus}
              onChange={(e) => setTargetStatus(e.target.value as IssueStatus)}
            />

            <Textarea
              label="Operational Dispatch Directive (Optional)"
              rows={2}
              placeholder="e.g. Inspect HDMI junction box and replace coupler before 11:00 AM..."
              value={dispatchNote}
              onChange={(e) => setDispatchNote(e.target.value)}
            />

            <Button
              variant="primary"
              className="w-full"
              isLoading={isProcessing}
              onClick={handleAssign}
            >
              Confirm Dispatch & Update Ticket
            </Button>
          </div>

          {/* Quick Actions Bar */}
          <div className="pt-2 border-t border-warm-200">
            <span className="text-[11px] text-ink-muted font-medium uppercase tracking-wider block mb-2">
              Quick Stage Transitions
            </span>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleQuickStatusChange('IN_PROGRESS')}
                disabled={issue.status === 'IN_PROGRESS'}
              >
                Mark In Progress
              </Button>
              <Button
                size="sm"
                variant="gold"
                onClick={() => handleQuickStatusChange('RESOLUTION_SUBMITTED')}
                disabled={issue.status === 'RESOLUTION_SUBMITTED'}
              >
                Submit Resolution
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => handleQuickStatusChange('RESOLVED')}
                disabled={issue.status === 'RESOLVED'}
              >
                Verify & Close
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
