'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AnalyticsSummary, Issue, IssueCategory, IssuePriority, IssueStatus, TimelineEvent } from '@/types';
import { IssuesService } from '@/services/issues.service';
import { AnalyticsService } from '@/services/analytics.service';
import { useAuth } from './AuthContext';

interface IssuesContextType {
  issues: Issue[];
  loading: boolean;
  error: string | null;
  summary: AnalyticsSummary;
  refreshIssues: () => Promise<void>;
  createIssue: (
    data: Omit<Issue, 'id' | 'ticketNumber' | 'createdAt' | 'updatedAt' | 'upvotes' | 'upvotedBy' | 'timeline' | 'comments'> & {
      customTimeline?: TimelineEvent[];
    }
  ) => Promise<Issue>;
  updateIssueStatus: (id: string, newStatus: IssueStatus, note?: string) => Promise<Issue | null>;
  assignIssue: (id: string, staff: { id: string; name: string; department: string; phone?: string }) => Promise<Issue | null>;
  addComment: (issueId: string, content: string) => Promise<void>;
  toggleUpvote: (issueId: string) => Promise<void>;
  resetData: () => void;
}

const IssuesContext = createContext<IssuesContextType | undefined>(undefined);

export const IssuesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshIssues = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await IssuesService.getAllIssues();
      setIssues(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load issues');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshIssues();
  }, [refreshIssues]);

  const summary = React.useMemo(() => {
    return AnalyticsService.calculateSummary(issues);
  }, [issues]);

  const createIssue = async (
    data: Omit<Issue, 'id' | 'ticketNumber' | 'createdAt' | 'updatedAt' | 'upvotes' | 'upvotedBy' | 'timeline' | 'comments'> & {
      customTimeline?: TimelineEvent[];
    }
  ): Promise<Issue> => {
    const created = await IssuesService.createIssue(data);
    setIssues((prev) => [created, ...prev]);
    // Note: per-action user-facing notifications are now produced by
    // the backend (DB triggers + notifications.service.ts). The
    // client no longer fabricates local notifications.
    return created;
  };

  const updateIssueStatus = async (
    id: string,
    newStatus: IssueStatus,
    note?: string
  ): Promise<Issue | null> => {
    const actor = user ? { name: user.name, role: user.role } : { name: 'System', role: 'STAFF' as const };
    const updated = await IssuesService.updateIssueStatus(id, newStatus, actor, note);
    if (updated) {
      setIssues((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    }
    return updated;
  };

  const assignIssue = async (
    id: string,
    staff: { id: string; name: string; department: string; phone?: string }
  ): Promise<Issue | null> => {
    const actor = user ? { name: user.name, role: user.role } : { name: 'System', role: 'STAFF' as const };
    const updated = await IssuesService.assignIssue(id, staff, actor);
    if (updated) {
      setIssues((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    }
    return updated;
  };

  const addComment = async (issueId: string, content: string): Promise<void> => {
    if (!user) return;
    const comment = await IssuesService.addComment(issueId, content, {
      id: user.id,
      name: user.name,
      role: user.role,
      department: user.department,
    });
    if (comment) {
      setIssues((prev) =>
        prev.map((iss) => {
          if (iss.id === issueId || iss.ticketNumber === issueId) {
            return {
              ...iss,
              comments: [...(iss.comments || []), comment],
            };
          }
          return iss;
        })
      );
    }
  };

  const toggleUpvote = async (issueId: string): Promise<void> => {
    if (!user) return;
    const { upvotes, userUpvoted } = await IssuesService.toggleUpvote(issueId, user.id);
    const uid = user.id;
    setIssues((prev) =>
      prev.map((iss) => {
        if (iss.id === issueId || iss.ticketNumber === issueId) {
          const upvotedBy = userUpvoted
            ? [...(iss.upvotedBy || []), uid]
            : (iss.upvotedBy || []).filter((id) => id !== uid);
          return { ...iss, upvotes, upvotedBy };
        }
        return iss;
      })
    );
  };

  const resetData = () => {
    IssuesService.resetToInitialMock();
  };

  return (
    <IssuesContext.Provider
      value={{
        issues,
        loading,
        error,
        summary,
        refreshIssues,
        createIssue,
        updateIssueStatus,
        assignIssue,
        addComment,
        toggleUpvote,
        resetData,
      }}
    >
      {children}
    </IssuesContext.Provider>
  );
};

export const useIssues = () => {
  const context = useContext(IssuesContext);
  if (!context) {
    throw new Error('useIssues must be used within an IssuesProvider');
  }
  return context;
};
