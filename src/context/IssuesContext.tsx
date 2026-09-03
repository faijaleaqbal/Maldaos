'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AnalyticsSummary, Issue, IssueCategory, IssuePriority, IssueStatus, TimelineEvent, CampusLocation } from '@/types';
import { IssuesService, CreateIssueInput } from '@/services/issues.service';
import { AnalyticsService } from '@/services/analytics.service';
import { NotificationService } from '@/services/notifications.service';
import { useAuth } from './AuthContext';

export interface CreateIssueParams {
  title: string;
  description: string;
  category: IssueCategory;
  priority: IssuePriority;
  location: CampusLocation;
  locationId?: string;
  departmentId?: string | null;
  isAnonymous?: boolean;
  images?: string[];
  imageFiles?: File[];
  customTimeline?: TimelineEvent[];
}

interface IssuesContextType {
  issues: Issue[];
  loading: boolean;
  error: string | null;
  summary: AnalyticsSummary;
  refreshIssues: () => Promise<void>;
  createIssue: (data: CreateIssueParams) => Promise<Issue>;
  updateIssueStatus: (id: string, newStatus: IssueStatus, note?: string) => Promise<Issue | null>;
  assignIssue: (id: string, params: { departmentId: string; staffId?: string; note?: string }) => Promise<Issue | null>;
  addComment: (issueId: string, content: string, isInternal?: boolean) => Promise<void>;
  toggleUpvote: (issueId: string) => Promise<void>;
  uploadResolutionProof: (issueId: string, file: File) => Promise<string>;
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
      console.error('refreshIssues error:', err);
      setError(err.message || 'Failed to load issues from database');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshIssues();
  }, [refreshIssues, user.id, user.role]);

  const summary = React.useMemo(() => {
    return AnalyticsService.calculateSummary(issues);
  }, [issues]);

  const createIssue = async (data: CreateIssueParams): Promise<Issue> => {
    try {
      setError(null);
      const input: CreateIssueInput = {
        ...data,
        reporter: {
          id: user.id,
          name: user.name,
          role: user.role,
          studentId: user.studentId,
          department: user.department,
        },
      };

      const created = await IssuesService.createIssue(input);
      setIssues((prev) => [created, ...prev.filter((i) => i.id !== created.id)]);

      NotificationService.addNotification({
        title: 'New Issue Registered',
        message: `Ticket ${created.ticketNumber} lodged for ${created.location.building}.`,
        ticketNumber: created.ticketNumber,
        ticketId: created.id,
        type: 'STATUS_CHANGE',
      });

      return created;
    } catch (err: any) {
      setError(err.message || 'Failed to create issue');
      throw err;
    }
  };

  const updateIssueStatus = async (
    id: string,
    newStatus: IssueStatus,
    note?: string
  ): Promise<Issue | null> => {
    try {
      setError(null);
      const actor = { name: user.name, role: user.role };
      const updated = await IssuesService.updateIssueStatus(id, newStatus, actor, note);
      if (updated) {
        setIssues((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));

        NotificationService.addNotification({
          title: `Ticket ${updated.ticketNumber} Updated`,
          message: `Status transitioned to ${newStatus.replace('_', ' ')} by ${user.name}.`,
          ticketNumber: updated.ticketNumber,
          ticketId: updated.id,
          type: newStatus === 'RESOLVED' ? 'RESOLVED' : 'STATUS_CHANGE',
        });
      }
      return updated;
    } catch (err: any) {
      setError(err.message || 'Failed to update issue status');
      throw err;
    }
  };

  const assignIssue = async (
    id: string,
    params: { departmentId: string; staffId?: string; note?: string }
  ): Promise<Issue | null> => {
    try {
      setError(null);
      const actor = { name: user.name, role: user.role };
      const updated = await IssuesService.assignIssue(id, params, actor);
      if (updated) {
        setIssues((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));

        NotificationService.addNotification({
          title: `Work Order Dispatched: ${updated.ticketNumber}`,
          message: `Assigned to department: ${params.departmentId}.`,
          ticketNumber: updated.ticketNumber,
          ticketId: updated.id,
          type: 'ASSIGNED',
        });
      }
      return updated;
    } catch (err: any) {
      setError(err.message || 'Failed to assign issue');
      throw err;
    }
  };

  const addComment = async (issueId: string, content: string, isInternal = false): Promise<void> => {
    try {
      setError(null);
      const comment = await IssuesService.addComment(
        issueId,
        content,
        {
          id: user.id,
          name: user.name,
          role: user.role,
          department: user.department,
        },
        isInternal
      );
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
    } catch (err: any) {
      setError(err.message || 'Failed to add comment');
      throw err;
    }
  };

  const toggleUpvote = async (issueId: string): Promise<void> => {
    try {
      setError(null);
      const { upvotes, userUpvoted } = await IssuesService.toggleUpvote(issueId, user.id);
      setIssues((prev) =>
        prev.map((iss) => {
          if (iss.id === issueId || iss.ticketNumber === issueId) {
            const upvotedBy = userUpvoted
              ? [...(iss.upvotedBy || []), user.id]
              : (iss.upvotedBy || []).filter((uid) => uid !== user.id);
            return { ...iss, upvotes, upvotedBy };
          }
          return iss;
        })
      );
    } catch (err: any) {
      setError(err.message || 'Failed to vote');
      throw err;
    }
  };

  const uploadResolutionProof = async (issueId: string, file: File): Promise<string> => {
    try {
      setError(null);
      const signedUrl = await IssuesService.uploadResolutionProof(issueId, file);
      // Refresh issue to update timeline and images
      const refreshed = await IssuesService.getIssueById(issueId);
      if (refreshed) {
        setIssues((prev) => prev.map((i) => (i.id === refreshed.id ? refreshed : i)));
      }
      return signedUrl;
    } catch (err: any) {
      setError(err.message || 'Failed to upload proof');
      throw err;
    }
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
        uploadResolutionProof,
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

