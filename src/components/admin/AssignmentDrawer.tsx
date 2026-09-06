'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Issue, IssueStatus, AIAnalysis } from '@/types';
import { useIssues } from '@/context/IssuesContext';
import { useAuth } from '@/context/AuthContext';
import { IssuesService, DepartmentOption, StaffOption } from '@/services/issues.service';
import { AIService } from '@/services/ai.service';
import {
  canUserAssign,
  canUserResolve,
  canUserClose,
  canUserReopen,
  getAvailableTransitions,
  isResolutionReasonRequired,
} from '@/lib/adminTransitions';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Input';
import { AIAnalysisPanel } from '@/components/ai/AIAnalysisPanel';
import { IssueStatusBadge } from '@/components/issues/IssueStatusBadge';
import { PriorityBadge } from '@/components/issues/PriorityBadge';
import {
  X,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Activity,
  Upload,
  Check,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';

interface AssignmentDrawerProps {
  issue: Issue | null;
  isOpen: boolean;
  onClose: () => void;
}

export const AssignmentDrawer: React.FC<AssignmentDrawerProps> = ({
  issue,
  isOpen,
  onClose,
}) => {
  const { assignIssue, updateIssueStatus, uploadResolutionProof, issues } = useIssues();
  const { user } = useAuth();

  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');

  const [targetStatus, setTargetStatus] = useState<IssueStatus>(issue?.status || 'ASSIGNED');
  const [dispatchNote, setDispatchNote] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);

  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | undefined>(issue?.aiAnalysis);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Compute permissions context
  const isDeptStaffOrAdmin = useMemo(() => {
    if (user.role === 'SUPER_ADMIN') return true;
    if (!user.department) return false;
    const userDeptLower = user.department.toLowerCase();
    const issueDeptLower = (issue?.department || '').toLowerCase();
    return userDeptLower === issueDeptLower;
  }, [user.role, user.department, issue?.department]);

  const isReporter = useMemo(() => {
    return Boolean(issue && user.id && issue.reporter?.id === user.id);
  }, [issue, user.id]);

  const isResolvedRecently = useMemo(() => {
    if (!issue?.resolvedAt) return false;
    const resolvedMs = new Date(issue.resolvedAt).getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    return Date.now() - resolvedMs <= sevenDaysMs;
  }, [issue?.resolvedAt]);

  const allowedTransitions = useMemo(() => {
    if (!issue) return [];
    return getAvailableTransitions(
      issue.status,
      user.role,
      isDeptStaffOrAdmin,
      isReporter,
      isResolvedRecently
    );
  }, [issue, user.role, isDeptStaffOrAdmin, isReporter, isResolvedRecently]);

  const drawerRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Focus trap & Escape key listener
  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const timer = setTimeout(() => {
      closeBtnRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Tab') {
        const container = drawerRef.current;
        if (!container) return;
        const focusables = container.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first || !container.contains(document.activeElement)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last || !container.contains(document.activeElement)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, [isOpen, onClose]);

  // Load departments and sync state on drawer open
  useEffect(() => {
    if (isOpen && issue) {
      setErrorMessage(null);
      setDispatchNote('');
      setProofFile(null);
      setTargetStatus(issue.status);

      IssuesService.getDepartments()
        .then((depts) => {
          setDepartments(depts);
          if (depts.length > 0) {
            const match = depts.find(
              (d) => d.id === issue.departmentId || d.name === issue.department
            );
            const initialDeptId = match ? match.id : depts[0].id;
            setSelectedDeptId(initialDeptId);
          }
        })
        .catch((err) => {
          console.error('Failed to load departments:', err);
        });

      // Load or set AI analysis
      if (issue.aiAnalysis) {
        setAiAnalysis(issue.aiAnalysis);
      } else {
        let cancelled = false;
        setIsAnalyzing(true);
        AIService.analyzeIssue(issue.title, issue.description, issue.location.building, issues)
          .then((analysis) => {
            if (!cancelled) setAiAnalysis(analysis);
          })
          .catch(() => {
            if (!cancelled) setAiAnalysis(undefined);
          })
          .finally(() => {
            if (!cancelled) setIsAnalyzing(false);
          });
        return () => {
          cancelled = true;
        };
      }
    }
  }, [isOpen, issue, issues]);

  // Load staff when selected department changes
  useEffect(() => {
    if (!selectedDeptId) {
      setStaffList([]);
      setSelectedStaffId('');
      return;
    }
    let cancelled = false;
    IssuesService.getStaffByDepartment(selectedDeptId)
      .then((staff) => {
        if (!cancelled) {
          setStaffList(staff);
          if (issue?.assignedTo?.id && staff.some((s) => s.id === issue.assignedTo?.id)) {
            setSelectedStaffId(issue.assignedTo.id);
          } else {
            setSelectedStaffId('');
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to load department staff:', err);
          setStaffList([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDeptId, issue]);

  // Keyboard ESC listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !issue) return null;

  const departmentOptions = departments.map((d) => ({
    label: `${d.name} (${d.code})`,
    value: d.id,
  }));

  const staffOptions = [
    { label: 'Unassigned (Department Dispatch Pool)', value: '' },
    ...staffList.map((s) => ({
      label: `${s.full_name} ${s.phone ? `(${s.phone})` : ''}`,
      value: s.id,
    })),
  ];

  const statusOptions = [
    { label: `${issue.status} (Current)`, value: issue.status },
    ...allowedTransitions.map((st) => ({
      label: `${st} (${statusLabelDescription(st)})`,
      value: st,
    })),
  ];

  function statusLabelDescription(s: IssueStatus): string {
    switch (s) {
      case 'OPEN':
        return 'Reopen';
      case 'ASSIGNED':
        return 'Dispatch';
      case 'IN_PROGRESS':
        return 'Start Work';
      case 'RESOLVED':
        return 'Complete & Verify';
      case 'CLOSED':
        return 'Archive';
      default:
        return s;
    }
  }

  const handleApplyAISuggestions = () => {
    if (!aiAnalysis) return;
    if (aiAnalysis.suggestedDepartment && departments.length > 0) {
      const match = departments.find(
        (d) =>
          d.name.toLowerCase().includes(aiAnalysis.suggestedDepartment.toLowerCase()) ||
          aiAnalysis.suggestedDepartment.toLowerCase().includes(d.name.toLowerCase())
      );
      if (match) setSelectedDeptId(match.id);
    }
  };

  const handleAssignAndDispatch = async () => {
    try {
      setIsProcessing(true);
      setErrorMessage(null);

      if (!canUserAssign(user.role)) {
        setErrorMessage('Access Denied: Only Department Admins and Super Admins may dispatch issues.');
        setIsProcessing(false);
        return;
      }

      if (!selectedDeptId) {
        setErrorMessage('Please select a target maintenance department.');
        setIsProcessing(false);
        return;
      }

      await assignIssue(issue.id, {
        departmentId: selectedDeptId,
        staffId: selectedStaffId || undefined,
        note: dispatchNote.trim() || undefined,
      });

      onClose();
    } catch (err: any) {
      console.error('Assignment error:', err);
      setErrorMessage(err.message || 'Dispatch operation failed. Check authorization.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStatusTransitionSubmit = async () => {
    try {
      setIsProcessing(true);
      setErrorMessage(null);

      if (targetStatus === issue.status) {
        onClose();
        return;
      }

      const requiresReason = isResolutionReasonRequired(issue.status, targetStatus);
      if (requiresReason && !dispatchNote.trim()) {
        setErrorMessage('A resolution summary is required by audit policy before marking RESOLVED.');
        setIsProcessing(false);
        return;
      }

      // If proof file is attached when transitioning to RESOLVED, upload first
      if (targetStatus === 'RESOLVED' && proofFile) {
        await uploadResolutionProof(issue.id, proofFile);
      }

      await updateIssueStatus(
        issue.id,
        targetStatus,
        dispatchNote.trim() || undefined
      );

      onClose();
    } catch (err: any) {
      console.error('Status transition error:', err);
      setErrorMessage(err.message || 'Status transition failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQuickStatusChange = async (newStatus: IssueStatus) => {
    try {
      setIsProcessing(true);
      setErrorMessage(null);

      const requiresReason = isResolutionReasonRequired(issue.status, newStatus);
      if (requiresReason && !dispatchNote.trim()) {
        setErrorMessage('Please write a brief resolution summary in the note box below before verifying RESOLVED.');
        setIsProcessing(false);
        return;
      }

      if (newStatus === 'RESOLVED' && proofFile) {
        await uploadResolutionProof(issue.id, proofFile);
      }

      await updateIssueStatus(
        issue.id,
        newStatus,
        dispatchNote.trim() || `Operational status updated to ${newStatus}`
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
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm transition-opacity"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assignment-drawer-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={drawerRef} className="w-full max-w-xl bg-white h-full shadow-2xl overflow-y-auto flex flex-col border-l border-warm-300">
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-warm-200 bg-warm-50 flex items-center justify-between sticky top-0 z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-maroon-900 bg-maroon-100/80 px-2 py-0.5 rounded">
                {issue.ticketNumber}
              </span>
              <span className="text-xs text-ink-muted">Operational Work Order</span>
            </div>
            <h3
              id="assignment-drawer-title"
              className="font-serif font-semibold text-base sm:text-lg text-ink mt-1 line-clamp-1"
            >
              {issue.title}
            </h3>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Close assignment drawer"
            className="min-w-[44px] min-h-[44px] rounded-full bg-warm-200 hover:bg-warm-300 flex items-center justify-center text-ink cursor-pointer transition-colors touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-maroon-700"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-4 sm:p-6 space-y-6 flex-1">
          {errorMessage && (
            <div
              role="alert"
              aria-live="assertive"
              className="p-3 bg-rose-50 border border-rose-200 rounded-md flex items-center gap-2 text-xs text-rose-700"
            >
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-3 p-3.5 bg-warm-50 rounded-lg border border-warm-200 text-xs">
            <div>
              <span className="text-ink-muted block text-[11px] uppercase font-medium">
                Current Status
              </span>
              <IssueStatusBadge status={issue.status} />
            </div>
            <div>
              <span className="text-ink-muted block text-[11px] uppercase font-medium">
                Priority
              </span>
              <PriorityBadge priority={issue.priority} />
            </div>
            <div className="col-span-2">
              <span className="text-ink-muted block text-[11px] uppercase font-medium">
                Location
              </span>
              <div className="flex items-center gap-1 text-ink font-medium">
                <MapPin className="w-3.5 h-3.5 text-maroon-700 shrink-0" />
                <span>
                  {issue.location.building} • {issue.location.roomOrLandmark}
                </span>
              </div>
            </div>
            <div className="col-span-2 flex items-center justify-between pt-1 border-t border-warm-200/60">
              <div>
                <span className="text-ink-muted block text-[11px] uppercase font-medium">
                  Reporter
                </span>
                <span className="text-ink">
                  {issue.reporter.name} ({issue.reporter.role})
                </span>
              </div>
              <div className="text-right">
                <span className="text-ink-muted block text-[11px] uppercase font-medium">
                  Assigned Staff
                </span>
                <span className="text-maroon-900 font-medium">
                  {issue.assignedTo?.name || 'Unassigned'}
                </span>
              </div>
            </div>
          </div>

          {/* Issue Description */}
          <div className="space-y-1">
            <h4 className="text-xs font-semibold text-ink uppercase tracking-wider">
              Work Order Description
            </h4>
            <p className="text-xs sm:text-sm text-ink-muted leading-relaxed bg-warm-50/70 p-3 rounded border border-warm-200">
              {issue.description}
            </p>
          </div>

          {/* Attached Evidence Photos */}
          {issue.images && issue.images.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-ink uppercase tracking-wider">
                Attached Evidence ({issue.images.length})
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {issue.images.map((img, idx) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={idx}
                    src={img}
                    alt={`Evidence attachment ${idx + 1} for ticket ${issue.ticketNumber}`}
                    className="w-full h-28 object-cover rounded border border-warm-300"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Resolution Proof Photos if present */}
          {issue.resolutionProofImages && issue.resolutionProofImages.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                Verified Resolution Proof ({issue.resolutionProofImages.length})
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {issue.resolutionProofImages.map((img, idx) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={idx}
                    src={img}
                    alt={`Resolution verification photo ${idx + 1} for ticket ${issue.ticketNumber}`}
                    className="w-full h-28 object-cover rounded border border-emerald-300"
                  />
                ))}
              </div>
            </div>
          )}

          {/* AI Triage Suggestions Panel */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-ink uppercase tracking-wider">
                Technical Diagnostic Advisory Recommendation
              </h4>
              {aiAnalysis && (
                <button
                  type="button"
                  onClick={handleApplyAISuggestions}
                  className="text-xs text-maroon-800 hover:text-maroon-950 font-semibold flex items-center gap-1 min-h-[36px] px-2 py-1 touch-manipulation cursor-pointer"
                >
                  <Activity className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Apply Advisory</span>
                </button>
              )}
            </div>

            <AIAnalysisPanel
              analysis={aiAnalysis}
              isLoading={isAnalyzing}
              showAdminActions={false}
            />
          </div>

          {/* Triage & Assignment Section */}
          <div className="space-y-4 pt-2 border-t border-warm-200">
            <div className="flex items-center justify-between">
              <h4 className="font-serif font-semibold text-sm sm:text-base text-ink flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-maroon-700" aria-hidden="true" />
                <span>Departmental Dispatch & Staffing</span>
              </h4>
              {canUserAssign(user.role) && (
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-medium">
                  Authorized
                </span>
              )}
            </div>

            {canUserAssign(user.role) ? (
              <div className="space-y-3 bg-warm-50 p-3.5 rounded-lg border border-warm-200">
                <Select
                  label="Target Maintenance Department *"
                  options={departmentOptions}
                  value={selectedDeptId}
                  onChange={(e) => setSelectedDeptId(e.target.value)}
                  helperText="Assigns ticket ownership to appropriate Malda College facility wing."
                />

                <Select
                  label="Field Duty Staff / Technician (Optional)"
                  options={staffOptions}
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  helperText="Designates specific on-duty technician for field resolution."
                />

                <Button
                  variant="primary"
                  className="w-full"
                  isLoading={isProcessing}
                  onClick={handleAssignAndDispatch}
                  leftIcon={<UserCheck className="w-4 h-4" />}
                >
                  Dispatch to Selected Department
                </Button>
              </div>
            ) : (
              <div className="p-3 bg-warm-50 rounded border border-warm-200 text-xs text-ink-muted">
                Departmental dispatch is restricted to Department Heads and Super Administrators.
              </div>
            )}
          </div>

          {/* Operational Status Transitions Section */}
          <div className="space-y-4 pt-2 border-t border-warm-200">
            <h4 className="font-serif font-semibold text-sm sm:text-base text-ink flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-maroon-700" aria-hidden="true" />
              <span>Lifecycle State Transitions</span>
            </h4>

            {allowedTransitions.length > 0 ? (
              <div className="space-y-3 bg-warm-50 p-3.5 rounded-lg border border-warm-200">
                <Select
                  label="Target Lifecycle State *"
                  options={statusOptions}
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value as IssueStatus)}
                  helperText="Select next authorized operational stage for this work order."
                />

                <Textarea
                  label={
                    targetStatus === 'RESOLVED'
                      ? 'Resolution Summary / Repair Action *'
                      : 'Operational Dispatch Note'
                  }
                  rows={2}
                  placeholder={
                    targetStatus === 'RESOLVED'
                      ? 'Describe the physical repair performed (required)...'
                      : 'Add notes for the institutional audit trail...'
                  }
                  value={dispatchNote}
                  onChange={(e) => setDispatchNote(e.target.value)}
                />

                {/* Resolution Proof File Upload */}
                {targetStatus === 'RESOLVED' && (
                  <div className="space-y-1.5 p-3 rounded bg-warm-50 border border-warm-200">
                    <label htmlFor="drawer-proof-file" className="block text-xs font-semibold text-ink uppercase tracking-wider flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5 text-maroon-700" aria-hidden="true" />
                      Resolution Proof Photo (Optional)
                    </label>
                    <input
                      id="drawer-proof-file"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setProofFile(e.target.files[0]);
                        }
                      }}
                      className="block w-full text-xs text-ink-muted file:mr-3 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-maroon-50 file:text-maroon-800 hover:file:bg-maroon-100 cursor-pointer"
                    />
                    <p className="text-[11px] text-ink-muted">
                      Uploaded directly to private resolution-proofs storage bucket.
                    </p>
                  </div>
                )}

                <Button
                  variant="primary"
                  className="w-full"
                  isLoading={isProcessing}
                  onClick={handleStatusTransitionSubmit}
                  disabled={targetStatus === issue.status && !proofFile}
                >
                  Confirm Status Transition
                </Button>
              </div>
            ) : (
              <div className="p-3 bg-warm-50 rounded border border-warm-200 text-xs text-ink-muted space-y-1">
                <p className="font-semibold text-ink">No Direct Status Transitions Permitted</p>
                <p>
                  Current status is <strong>{issue.status}</strong>. Transitions must follow the authorized institutional lifecycle for your role ({user.role}).
                </p>
              </div>
            )}

            {/* Quick Actions Shortcuts for Authorized Staff/Admins */}
            <div className="pt-3 border-t border-warm-200">
              <span className="text-[11px] text-ink-muted font-medium uppercase tracking-wider block mb-2">
                Fast-Action State Shortcuts
              </span>
              <div className="flex flex-wrap gap-2">
                {issue.status === 'ASSIGNED' && isDeptStaffOrAdmin && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleQuickStatusChange('IN_PROGRESS')}
                    disabled={isProcessing}
                  >
                    Mark In Progress
                  </Button>
                )}
                {issue.status === 'IN_PROGRESS' && isDeptStaffOrAdmin && (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handleQuickStatusChange('RESOLVED')}
                    disabled={isProcessing}
                  >
                    Verify & Mark Resolved
                  </Button>
                )}
                {issue.status === 'RESOLVED' && canUserClose(user.role) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleQuickStatusChange('CLOSED')}
                    disabled={isProcessing}
                  >
                    Close & Archive
                  </Button>
                )}
                {(issue.status === 'RESOLVED' || issue.status === 'CLOSED') &&
                  canUserReopen(user.role, isReporter, isResolvedRecently, isDeptStaffOrAdmin) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleQuickStatusChange('OPEN')}
                      disabled={isProcessing}
                    >
                      Reopen Ticket
                    </Button>
                  )}
              </div>
            </div>
          </div>

          {/* Full Ticket Link */}
          <div className="pt-2 text-right">
            <Link
              href={`/issues/${issue.id}`}
              className="text-xs text-maroon-800 font-semibold hover:underline inline-flex items-center gap-1"
            >
              <span>View Full Lifecycle Page</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
