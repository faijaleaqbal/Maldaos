'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useIssues } from '@/context/IssuesContext';
import { useAuth } from '@/context/AuthContext';
import { Issue, IssueStatus } from '@/types';
import { IssueStatusBadge } from '@/components/issues/IssueStatusBadge';
import { PriorityBadge } from '@/components/issues/PriorityBadge';
import { IssueTimeline } from '@/components/issues/IssueTimeline';
import { AIAnalysisPanel } from '@/components/ai/AIAnalysisPanel';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { LoadingState } from '@/components/common/LoadingState';
import { EmptyState } from '@/components/common/EmptyState';
import {
  ArrowLeft,
  MapPin,
  Clock,
  User,
  ThumbsUp,
  MessageSquare,
  Sparkles,
  ShieldCheck,
  Send,
  CheckCircle2,
  Share2,
  Wrench,
  AlertTriangle,
} from 'lucide-react';

export default function IssueDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { id } = params;
  const { issues, updateIssueStatus, addComment, toggleUpvote, loading } = useIssues();
  const { user, isAdmin } = useAuth();

  const [commentText, setCommentText] = useState('');
  const [isInternalComment, setIsInternalComment] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolutionSummary, setResolutionSummary] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { uploadResolutionProof } = useIssues();

  // Find issue by id or ticketNumber
  const issue = issues.find(
    (i) => i.id === id || i.ticketNumber.toLowerCase() === (id as string).toLowerCase()
  );

  if (loading) {
    return <LoadingState fullPage message="Fetching ticket lifecycle and telemetry..." />;
  }

  if (!issue) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <EmptyState
          title="Ticket Record Not Found"
          description={`No active or archived campus report matches reference "${id}". Please check the ticket number.`}
          actionLabel="Back to Campus Issues"
          actionHref="/issues"
        />
      </div>
    );
  }

  const isUpvoted = (issue.upvotedBy || []).includes(user.id);

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    try {
      setIsSubmittingComment(true);
      await addComment(issue.id, commentText.trim(), isInternalComment);
      setCommentText('');
      setIsInternalComment(false);
    } catch (err: any) {
      setActionError(err.message || 'Failed to post comment');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleShare = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleStaffStatusTransition = async (newStatus: IssueStatus, customNote?: string) => {
    try {
      setIsUpdatingStatus(true);
      setActionError(null);
      await updateIssueStatus(
        issue.id,
        newStatus,
        customNote || `Operational status changed to ${newStatus.replace('_', ' ')} by ${user.name}`
      );
    } catch (err: any) {
      console.error('Status transition error:', err);
      setActionError(err.message || 'Status transition failed.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleResolveSubmit = async () => {
    if (!resolutionSummary.trim()) {
      setActionError('Please provide a resolution summary describing the maintenance performed.');
      return;
    }

    try {
      setIsUpdatingStatus(true);
      setActionError(null);

      if (proofFile) {
        await uploadResolutionProof(issue.id, proofFile);
      }

      await updateIssueStatus(issue.id, 'RESOLVED', resolutionSummary.trim());
      setShowResolveModal(false);
      setResolutionSummary('');
      setProofFile(null);
    } catch (err: any) {
      console.error('Resolution submission failed:', err);
      setActionError(err.message || 'Failed to resolve ticket. Please retry.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };


  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Breadcrumb & Return Link */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-maroon-800 hover:text-maroon-950 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Feed</span>
        </button>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleShare}
            leftIcon={<Share2 className="w-3.5 h-3.5" />}
          >
            {copiedLink ? 'Link Copied!' : 'Share Ticket'}
          </Button>

          {/* Upvote */}
          <Button
            size="sm"
            variant={isUpvoted ? 'primary' : 'secondary'}
            onClick={() => toggleUpvote(issue.id)}
            leftIcon={<ThumbsUp className={`w-3.5 h-3.5 ${isUpvoted ? 'fill-white' : ''}`} />}
          >
            <span>{isUpvoted ? 'Endorsed' : 'Endorse Issue'} ({issue.upvotes || 0})</span>
          </Button>
        </div>
      </div>

      {/* Main Issue Header Card */}
      <div className="rounded-xl border border-warm-300 bg-white p-5 sm:p-7 shadow-card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-warm-200 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-sm sm:text-base font-bold text-maroon-900 bg-maroon-50 px-2.5 py-1 rounded border border-maroon-200">
              {issue.ticketNumber}
            </span>
            <span className="text-xs text-ink-muted uppercase font-medium tracking-wider">
              {issue.category.replace('_', ' ')}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <PriorityBadge priority={issue.priority} size="md" />
            <IssueStatusBadge status={issue.status} size="md" />
          </div>
        </div>

        {/* Issue Title */}
        <h1 className="font-serif font-bold text-xl sm:text-3xl text-ink leading-snug">
          {issue.title}
        </h1>

        {/* Location & Reporter Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-warm-100 rounded-lg border border-warm-200 text-xs">
          <div className="space-y-0.5">
            <span className="text-[11px] text-ink-muted uppercase font-medium block">Campus Location</span>
            <div className="flex items-center gap-1 font-semibold text-ink">
              <MapPin className="w-3.5 h-3.5 text-maroon-700 shrink-0" />
              <span className="truncate">{issue.location.building}</span>
            </div>
            <span className="text-ink-muted text-[11px] block">{issue.location.roomOrLandmark} ({issue.location.floor})</span>
          </div>

          <div className="space-y-0.5">
            <span className="text-[11px] text-ink-muted uppercase font-medium block">Reporter</span>
            <div className="flex items-center gap-1 font-semibold text-ink">
              <User className="w-3.5 h-3.5 text-maroon-700 shrink-0" />
              <span>{issue.reporter.name}</span>
            </div>
            <span className="text-ink-muted text-[11px] block">
              {issue.reporter.department || 'Student'} {issue.reporter.studentId ? `(${issue.reporter.studentId})` : ''}
            </span>
          </div>

          <div className="space-y-0.5">
            <span className="text-[11px] text-ink-muted uppercase font-medium block">Department Assigned</span>
            <div className="font-semibold text-ink">{issue.department}</div>
            <span className="text-ink-muted text-[11px] block">
              {issue.assignedTo ? `Technician: ${issue.assignedTo.name}` : 'Awaiting manual dispatch'}
            </span>
          </div>
        </div>

        {/* Detailed Description */}
        <div className="space-y-2 pt-2">
          <h3 className="text-xs font-semibold text-ink uppercase tracking-wider">
            Incident Description & Context
          </h3>
          <p className="text-xs sm:text-sm text-ink-muted leading-relaxed whitespace-pre-wrap bg-warm-50 p-4 rounded-lg border border-warm-200 font-sans">
            {issue.description}
          </p>
        </div>

        {/* Evidence Images Gallery */}
        {issue.images && issue.images.length > 0 && (
          <div className="space-y-2 pt-2">
            <h3 className="text-xs font-semibold text-ink uppercase tracking-wider">
              Photo Evidence ({issue.images.length})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {issue.images.map((img, idx) => (
                <div
                  key={idx}
                  className="aspect-video rounded-lg overflow-hidden border border-warm-300 bg-warm-100 shadow-subtle"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img}
                    alt={`Incident evidence ${idx + 1}`}
                    className="w-full h-full object-cover hover:scale-105 transition-transform"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resolution Summary Banner if resolved */}
        {issue.status === 'RESOLVED' && (
          <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-950 space-y-2">
            <div className="flex items-center gap-2 font-serif font-bold text-base text-emerald-900">
              <CheckCircle2 className="w-5 h-5 text-emerald-700" />
              Verified & Resolved by Maintenance Cell
            </div>
            {issue.resolutionSummary && (
              <p className="text-xs sm:text-sm text-emerald-900/90 leading-relaxed font-sans">
                <strong>Resolution Summary:</strong> {issue.resolutionSummary}
              </p>
            )}
            {issue.resolvedAt && (
              <p className="text-[11px] font-mono text-emerald-700">
                Completed on: {new Date(issue.resolvedAt).toLocaleString('en-IN')}
              </p>
            )}
          </div>
        )}

        {/* Action Error Banner */}
        {actionError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-md flex items-center gap-2 text-xs text-rose-700">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Admin / Staff Quick Operational Controls */}
        {isAdmin && (
          <div className="mt-4 pt-4 border-t border-warm-200 bg-maroon-50/50 -mx-5 -mb-4 p-4 sm:p-5 rounded-b-xl space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-maroon-900 block flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-maroon-700" />
              Duty Officer Fast Action Bar ({user.role})
            </span>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleStaffStatusTransition('IN_PROGRESS')}
                disabled={issue.status === 'IN_PROGRESS' || isUpdatingStatus}
                isLoading={isUpdatingStatus}
              >
                Mark In Progress
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => setShowResolveModal(true)}
                disabled={issue.status === 'RESOLVED' || isUpdatingStatus}
              >
                Resolve with Proof
              </Button>
              {issue.status === 'RESOLVED' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleStaffStatusTransition('CLOSED')}
                  disabled={isUpdatingStatus}
                >
                  Close & Archive
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Student Reopen Ticket button if eligible */}
        {!isAdmin && issue.status === 'RESOLVED' && user.id === issue.reporter.id && (
          <div className="pt-2 flex justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleStaffStatusTransition('OPEN', 'Reopened by student reporter')}
              isLoading={isUpdatingStatus}
            >
              Reopen Ticket (Issue Persists)
            </Button>
          </div>
        )}
      </div>

      {/* Resolve Issue Modal */}
      {showResolveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl border border-warm-300 max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-warm-200 pb-3">
              <h3 className="font-serif font-bold text-lg text-ink">
                Record Resolution & Verification
              </h3>
              <button
                type="button"
                onClick={() => setShowResolveModal(false)}
                className="text-ink-muted hover:text-ink text-sm font-semibold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <Textarea
                label="Resolution Summary / Rectification Details *"
                rows={3}
                placeholder="Detail what was repaired or replaced (e.g. Cleared drainage clog and replaced faulty pipe joint)..."
                value={resolutionSummary}
                onChange={(e) => setResolutionSummary(e.target.value)}
                helperText="Required by institutional maintenance audit policy."
              />

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-ink uppercase tracking-wider">
                  Resolution Proof Photo (Optional)
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setProofFile(e.target.files[0]);
                    }
                  }}
                  className="block w-full text-xs text-ink-muted file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-maroon-50 file:text-maroon-800 hover:file:bg-maroon-100 cursor-pointer"
                />
                <p className="text-[11px] text-ink-muted">
                  Photo uploaded directly to Supabase resolution-proofs storage bucket.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-warm-200">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowResolveModal(false)}
                disabled={isUpdatingStatus}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                isLoading={isUpdatingStatus}
                onClick={handleResolveSubmit}
              >
                Verify & Mark Resolved
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Two-Column Grid: Timeline & AI Analysis (Left) vs Discussion & Comments (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Timeline & AI Panel */}
        <div className="lg:col-span-7 space-y-6">
          {/* Issue Lifecycle Timeline with Motion */}
          <div className="rounded-xl border border-warm-300 bg-white p-5 sm:p-6 shadow-card space-y-4">
            <div className="border-b border-warm-200 pb-3">
              <h3 className="font-serif font-semibold text-lg text-ink">
                Maintenance Lifecycle Timeline
              </h3>
              <p className="text-xs text-ink-muted">
                Audit trail of status transitions from lodging to verified resolution
              </p>
            </div>

            <IssueTimeline events={issue.timeline || []} currentStatus={issue.status} />
          </div>

          {/* AI Analysis Panel */}
          {issue.aiAnalysis && (
            <div className="space-y-2">
              <h3 className="font-serif font-semibold text-base text-ink">
                Automated Triage Evaluation
              </h3>
              <AIAnalysisPanel analysis={issue.aiAnalysis} />
            </div>
          )}
        </div>

        {/* Right Column: Discussion & Activity Comments */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-xl border border-warm-300 bg-white p-5 sm:p-6 shadow-card space-y-4">
            <div className="border-b border-warm-200 pb-3 flex items-center justify-between">
              <div>
                <h3 className="font-serif font-semibold text-lg text-ink">
                  Discussion & Operational Notes
                </h3>
                <p className="text-xs text-ink-muted">
                  Official updates between students, faculty, and maintenance staff
                </p>
              </div>
              <span className="text-xs font-mono bg-warm-100 px-2 py-0.5 rounded border border-warm-200">
                {issue.comments?.length || 0}
              </span>
            </div>

            {/* Comments Stream */}
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {issue.comments && issue.comments.length > 0 ? (
                issue.comments.map((comm) => {
                  const isStaff = comm.author.role !== 'STUDENT';

                  return (
                    <div
                      key={comm.id}
                      className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                        comm.isInternal
                          ? 'bg-amber-50/70 border-amber-300'
                          : isStaff
                          ? 'bg-maroon-50/50 border-maroon-200'
                          : 'bg-warm-50 border-warm-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-ink">{comm.author.name}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                              comm.isInternal
                                ? 'bg-amber-200 text-amber-900'
                                : isStaff
                                ? 'bg-maroon-700 text-white'
                                : 'bg-warm-200 text-ink-muted'
                            }`}
                          >
                            {comm.isInternal ? 'INTERNAL NOTE' : comm.author.role}
                          </span>
                        </div>
                        <time className="text-[10px] text-ink-muted font-mono">
                          {new Date(comm.createdAt).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </time>
                      </div>
                      <p className="text-xs text-ink leading-relaxed font-sans">{comm.content}</p>
                    </div>
                  );
                })
              ) : (
                <div className="text-xs text-ink-muted text-center py-6">
                  No comments or operational directives recorded yet.
                </div>
              )}
            </div>

            {/* Add Comment Form */}
            <form onSubmit={handleCommentSubmit} className="pt-3 border-t border-warm-200 space-y-2">
              <Textarea
                rows={2}
                placeholder={`Leave an update or query as ${user.name} (${user.role})...`}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
              />
              <div className="flex items-center justify-between">
                {isAdmin ? (
                  <label className="inline-flex items-center gap-1.5 text-xs text-ink-muted cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isInternalComment}
                      onChange={(e) => setIsInternalComment(e.target.checked)}
                      className="rounded border-warm-300 text-maroon-700 focus:ring-maroon-700"
                    />
                    <span>Internal note (staff only)</span>
                  </label>
                ) : <div />}
                <Button
                  type="submit"
                  size="sm"
                  variant="primary"
                  isLoading={isSubmittingComment}
                  leftIcon={<Send className="w-3 h-3" />}
                >
                  Post Update
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

