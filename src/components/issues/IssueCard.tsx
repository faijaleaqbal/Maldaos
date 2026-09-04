'use client';

import React from 'react';
import Link from 'next/link';
import { Issue } from '@/types';
import { IssueStatusBadge } from './IssueStatusBadge';
import { PriorityBadge } from './PriorityBadge';
import { MapPin, ThumbsUp, MessageSquare, Sparkles, ArrowRight } from 'lucide-react';
import { useIssues } from '@/context/IssuesContext';
import { useAuth } from '@/context/AuthContext';

interface IssueCardProps {
  issue: Issue;
  compact?: boolean;
}

export const IssueCard: React.FC<IssueCardProps> = ({ issue, compact = false }) => {
  const { toggleUpvote } = useIssues();
  const { user } = useAuth();

  const isUpvoted = (issue.upvotedBy || []).includes(user.id);

  const handleUpvote = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleUpvote(issue.id);
  };

  const formattedDate = new Date(issue.createdAt).toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <Link href={`/issues/${issue.id}`} className="block group">
      <div className="rounded-lg border border-warm-300 bg-white p-4 sm:p-5 transition-all duration-150 hover:border-maroon-300 hover:shadow-card">
        {/* Top Meta Line: Ticket # + Status + Priority */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-maroon-900 bg-maroon-50 px-2 py-0.5 rounded border border-maroon-200">
              {issue.ticketNumber}
            </span>
            <span className="text-[11px] text-ink-muted">
              {issue.category.replace('_', ' ')}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {issue.aiAnalysis && !issue.aiAnalysis.isFallback && (
              <span
                title="AI operational triage completed"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-ai-700 bg-ai-50 border border-ai-border px-1.5 py-0.5 rounded"
              >
                <Sparkles className="w-3 h-3 text-ai-500" />
                <span className="hidden sm:inline">AI Triaged</span>
              </span>
            )}
            <PriorityBadge priority={issue.priority} />
            <IssueStatusBadge status={issue.status} />
          </div>
        </div>

        {/* Issue Title */}
        <h4 className="font-serif font-semibold text-sm sm:text-base text-ink group-hover:text-maroon-800 transition-colors line-clamp-2 mb-2">
          {issue.title}
        </h4>

        {/* Issue Description snippet (if not compact) */}
        {!compact && (
          <p className="text-xs sm:text-sm text-ink-muted line-clamp-2 mb-3 leading-relaxed">
            {issue.description}
          </p>
        )}

        {/* Location & Meta Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-warm-200 text-xs text-ink-muted">
          <div className="flex items-center gap-1.5 text-ink-muted max-w-[70%]">
            <MapPin className="w-3.5 h-3.5 text-maroon-700 shrink-0" />
            <span className="truncate" title={`${issue.location.building} • ${issue.location.roomOrLandmark}`}>
              {issue.location.building.split('(')[0]}
              <span className="text-ink-muted/70"> • {issue.location.roomOrLandmark}</span>
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Upvote Button - Min 44px hit box for mobile ergonomics */}
            <button
              type="button"
              onClick={handleUpvote}
              aria-label={`Upvote issue ${issue.ticketNumber}. Current upvotes: ${issue.upvotes || 0}`}
              aria-pressed={isUpvoted}
              className={`min-h-[44px] min-w-[44px] px-2.5 py-1.5 inline-flex items-center justify-center gap-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                isUpvoted
                  ? 'bg-maroon-50 text-maroon-800 font-semibold border border-maroon-200'
                  : 'hover:bg-warm-100 text-ink-muted'
              }`}
              title="Endorse this campus issue report"
            >
              <ThumbsUp className={`w-3.5 h-3.5 ${isUpvoted ? 'fill-maroon-700 text-maroon-700' : ''}`} />
              <span className="font-mono text-xs">{issue.upvotes || 0}</span>
            </button>

            {/* Comments count */}
            {issue.comments && issue.comments.length > 0 && (
              <span className="inline-flex items-center gap-1 text-ink-muted">
                <MessageSquare className="w-3 h-3" />
                <span>{issue.comments.length}</span>
              </span>
            )}

            <time className="font-mono text-[11px] text-ink-muted">{formattedDate}</time>

            <span className="text-maroon-700 group-hover:translate-x-0.5 transition-transform">
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
};
