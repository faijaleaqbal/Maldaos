'use client';

import React, { useState, useEffect } from 'react';
import { Issue, IssueStatus } from '@/types';
import { useIssues } from '@/context/IssuesContext';
import { IssuesService } from '@/services/issues.service';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Input';
import { AIAnalysisPanel } from '@/components/ai/AIAnalysisPanel';
import { IssueStatusBadge } from '@/components/issues/IssueStatusBadge';
import { PriorityBadge } from '@/components/issues/PriorityBadge';
import { X, UserCheck, CheckCircle2, AlertCircle, MapPin } from 'lucide-react';

interface AssignmentDrawerProps {
  issue: Issue | null;
  isOpen: boolean;
  onClose: () => void;
}

const STATUS_OPTIONS: { label: string; value: IssueStatus }[] = [
  { label: 'OPEN (Unassigned)', value: 'OPEN' },
  { label: 'ASSIGNED (Dispatched)', value: 'ASSIGNED' },
  { label: 'IN PROGRESS (Under Maintenance)', value: 'IN_PROGRESS' },
  { label: 'RESOLVED (Completed)', value: 'RESOLVED' },
  { label: 'CLOSED (Archived)', value: 'CLOSED' },
];

export const AssignmentDrawer: React.FC<AssignmentDrawerProps> = ({
  issue,
  isOpen,
  onClose,
}) => {
  const { assignIssue, updateIssueStatus } = useIssues();

  const [departments, setDepartments] = useState<{ id: string; name: string; code: string }[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [targetStatus, setTargetStatus] = useState<IssueStatus>(issue?.status || 'ASSIGNED');
  const [dispatchNote, setDispatchNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      IssuesService.getDepartments().then((depts) => {
        setDepartments(depts);
        if (depts.length > 0) {
          const match = depts.find((d) => d.id === issue?.departmentId || d.name === issue?.department);
          setSelectedDeptId(match ? match.id : depts[0].id);
        }
      });
      if (issue) {
        setTargetStatus(issue.status);
      }
    }
  }, [isOpen, issue]);

  if (!isOpen || !issue) return null;

  const departmentOptions = departments.map((d) => ({
    label: `${d.name} (${d.code})`,
    value: d.id,
  }));

  const handleAssign = async () => {
    try {
      setIsProcessing(true);
      setErrorMessage(null);

      if (selectedDeptId) {
        await assignIssue(issue.id, {
          departmentId: selectedDeptId,
          note: dispatchNote || undefined,
        });
      }

      if (targetStatus && targetStatus !== issue.status) {
        if (targetStatus === 'RESOLVED' && !dispatchNote.trim()) {
          setErrorMessage('A resolution summary is required when transitioning status to RESOLVED.');
          setIsProcessing(false);
          return;
        }
        await updateIssueStatus(issue.id, targetStatus, dispatchNote);
      }

      onClose();
    } catch (err: any) {
      console.error('Assignment error:', err);
      setErrorMessage(err.message || 'Operation failed. Check permissions.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQuickStatusChange = async (newStatus: IssueStatus) => {
    try {
      setIsProcessing(true);
      setErrorMessage(null);

      if (newStatus === 'RESOLVED' && !dispatchNote.trim()) {
        setErrorMessage('Please provide a brief resolution summary in the note field before marking RESOLVED.');
        setIsProcessing(false);
        return;
      }

      await updateIssueStatus(
        issue.id,
        newStatus,
        dispatchNote || `Operational status updated to ${newStatus}`
      );
      onClose();
    } catch (err: any) {
      console.error('Quick status transition failed:', err);
      setErrorMessage(err.message || 'Failed to update status.');
    } finally {
      setIsProcessing(false);
    }
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
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-md flex items-center gap-2 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-warm-50 rounded-lg border border-warm-200 text-xs">
            <div>
              <span className="text-ink-muted block text-[11px] uppercase font-medium">Current Status</span>
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
              <h4 className="text-xs font-semibold text-ink uppercase tracking-wider">Attached Evidence ({issue.images.length})</h4>
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
          {issue.aiAnalysis && (
            <div>
              <h4 className="text-xs font-semibold text-ink uppercase tracking-wider mb-2">
                Automated Triage Suggestions
              </h4>
              <AIAnalysisPanel analysis={issue.aiAnalysis} />
            </div>
          )}

          {/* Assignment Controls */}
          <div className="p-4 rounded-lg border border-warm-300 bg-warm-100/50 space-y-3">
            <h4 className="font-serif font-semibold text-sm text-ink flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-maroon-700" />
              Dispatch Department & Transition Stage
            </h4>

            {departmentOptions.length > 0 && (
              <Select
                label="Target Maintenance Department"
                options={departmentOptions}
                value={selectedDeptId}
                onChange={(e) => setSelectedDeptId(e.target.value)}
              />
            )}

            <Select
              label="Transition Ticket Status"
              options={STATUS_OPTIONS}
              value={targetStatus}
              onChange={(e) => setTargetStatus(e.target.value as IssueStatus)}
            />

            <Textarea
              label="Operational Directive / Resolution Summary"
              rows={2}
              placeholder="e.g. Fixed electrical wiring and restored power safely..."
              value={dispatchNote}
              onChange={(e) => setDispatchNote(e.target.value)}
              helperText={targetStatus === 'RESOLVED' ? 'Required for RESOLVED transition.' : undefined}
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
                disabled={issue.status === 'IN_PROGRESS' || isProcessing}
              >
                Mark In Progress
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => handleQuickStatusChange('RESOLVED')}
                disabled={issue.status === 'RESOLVED' || isProcessing}
              >
                Verify & Mark Resolved
              </Button>
              {issue.status === 'RESOLVED' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleQuickStatusChange('CLOSED')}
                  disabled={isProcessing}
                >
                  Close & Archive
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

