import { getSupabaseClient, isMockModeEnabled } from '@/lib/supabase';
import {
  Issue,
  IssueCategory,
  IssueComment,
  IssuePriority,
  IssueStatus,
  TimelineEvent,
  UserRole,
} from '@/types';
import { INITIAL_MOCK_ISSUES } from './mockData';

const ISSUES_STORAGE_KEY = 'campuspulse_issues_store_v1';

export const IssuesService = {
  getLocalIssues(): Issue[] {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(ISSUES_STORAGE_KEY);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {
          // fall through
        }
      }
    }
    return INITIAL_MOCK_ISSUES;
  },

  saveLocalIssues(issues: Issue[]): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(ISSUES_STORAGE_KEY, JSON.stringify(issues));
    }
  },

  async getAllIssues(): Promise<Issue[]> {
    if (!isMockModeEnabled()) {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('issues')
            .select('*, comments(*), timeline(*)')
            .order('created_at', { ascending: false });

          if (!error && data && data.length > 0) {
            return data as Issue[];
          }
        } catch (err) {
          console.warn('Supabase query failed, falling back to local store:', err);
        }
      }
    }
    return this.getLocalIssues();
  },

  async getIssueById(idOrTicket: string): Promise<Issue | null> {
    const issues = await this.getAllIssues();
    const found = issues.find(
      (iss) => iss.id === idOrTicket || iss.ticketNumber.toLowerCase() === idOrTicket.toLowerCase()
    );
    return found || null;
  },

  async createIssue(
    data: Omit<Issue, 'id' | 'ticketNumber' | 'createdAt' | 'updatedAt' | 'upvotes' | 'upvotedBy' | 'timeline' | 'comments'> & {
      customTimeline?: TimelineEvent[];
    }
  ): Promise<Issue> {
    const issues = this.getLocalIssues();
    const year = new Date().getFullYear();
    const ticketSeq = String(issues.length + 120).padStart(4, '0');
    const ticketNumber = `MC-${year}-${ticketSeq}`;
    const now = new Date().toISOString();

    const initialTimeline: TimelineEvent[] = data.customTimeline || [
      {
        id: `tl-${Date.now()}-1`,
        status: 'REPORTED',
        label: 'Issue Logged by Reporter',
        description: `Submitted for ${data.location.building} (${data.location.roomOrLandmark})`,
        timestamp: now,
        actor: { name: data.reporter.name, role: data.reporter.role },
      },
    ];

    if (data.aiAnalysis) {
      initialTimeline.push({
        id: `tl-${Date.now()}-2`,
        status: 'AI_ANALYZED',
        label: 'AI Operational Triage',
        description: `Detected category ${data.aiAnalysis.detectedCategory}. Suggested Priority: ${data.aiAnalysis.suggestedPriority}. Confidence: ${Math.round(data.aiAnalysis.confidence * 100)}%`,
        timestamp: new Date(Date.now() + 1000).toISOString(),
        actor: { name: 'CampusPulse AI Gateway', role: 'Automated Gateway' },
      });
    }

    const newIssue: Issue = {
      id: `iss-${Date.now()}`,
      ticketNumber,
      title: data.title,
      description: data.description,
      category: data.category,
      priority: data.priority,
      status: data.aiAnalysis ? 'AI_ANALYZED' : 'REPORTED',
      location: data.location,
      reporter: data.reporter,
      department: data.department,
      images: data.images || [],
      upvotes: 1,
      upvotedBy: [data.reporter.id],
      createdAt: now,
      updatedAt: now,
      aiAnalysis: data.aiAnalysis,
      timeline: initialTimeline,
      comments: [],
    };

    // Save locally
    const updated = [newIssue, ...issues];
    this.saveLocalIssues(updated);

    // Save to Supabase if configured
    if (!isMockModeEnabled()) {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          await supabase.from('issues').insert([newIssue]);
        } catch (e) {
          console.warn('Could not sync issue to Supabase:', e);
        }
      }
    }

    return newIssue;
  },

  async updateIssueStatus(
    id: string,
    newStatus: IssueStatus,
    actor: { name: string; role: string },
    note?: string
  ): Promise<Issue | null> {
    const issues = this.getLocalIssues();
    const index = issues.findIndex((iss) => iss.id === id || iss.ticketNumber === id);
    if (index === -1) return null;

    const issue = { ...issues[index] };
    issue.status = newStatus;
    issue.updatedAt = new Date().toISOString();
    if (newStatus === 'RESOLVED') {
      issue.resolvedAt = issue.updatedAt;
    }

    const statusLabels: Record<IssueStatus, string> = {
      REPORTED: 'Reported by Student',
      AI_ANALYZED: 'AI Triage Complete',
      ASSIGNED: 'Dispatched to Department',
      IN_PROGRESS: 'Maintenance in Progress',
      RESOLUTION_SUBMITTED: 'Resolution Submitted for Verification',
      RESOLVED: 'Marked as Resolved',
      CLOSED: 'Ticket Closed',
    };

    const newTimelineEvent: TimelineEvent = {
      id: `tl-${Date.now()}`,
      status: newStatus,
      label: statusLabels[newStatus],
      description: note || `Status updated to ${newStatus.replace('_', ' ')} by ${actor.name}.`,
      timestamp: issue.updatedAt,
      actor,
    };

    issue.timeline = [...issue.timeline, newTimelineEvent];
    issues[index] = issue;
    this.saveLocalIssues(issues);

    return issue;
  },

  async assignIssue(
    id: string,
    assignedTo: { id: string; name: string; department: string; phone?: string },
    actor: { name: string; role: string }
  ): Promise<Issue | null> {
    const issues = this.getLocalIssues();
    const index = issues.findIndex((iss) => iss.id === id || iss.ticketNumber === id);
    if (index === -1) return null;

    const issue = { ...issues[index] };
    issue.assignedTo = assignedTo;
    issue.department = assignedTo.department;
    issue.status = 'ASSIGNED';
    issue.updatedAt = new Date().toISOString();

    const timelineEvent: TimelineEvent = {
      id: `tl-${Date.now()}`,
      status: 'ASSIGNED',
      label: 'Staff Dispatched',
      description: `Assigned to ${assignedTo.name} (${assignedTo.department}) by ${actor.name}.`,
      timestamp: issue.updatedAt,
      actor,
    };

    issue.timeline = [...issue.timeline, timelineEvent];
    issues[index] = issue;
    this.saveLocalIssues(issues);

    return issue;
  },

  async addComment(
    issueId: string,
    content: string,
    author: { id: string; name: string; role: UserRole; department?: string }
  ): Promise<IssueComment | null> {
    const issues = this.getLocalIssues();
    const index = issues.findIndex((iss) => iss.id === issueId || iss.ticketNumber === issueId);
    if (index === -1) return null;

    const newComment: IssueComment = {
      id: `comm-${Date.now()}`,
      issueId,
      author,
      content,
      createdAt: new Date().toISOString(),
    };

    issues[index].comments = [...(issues[index].comments || []), newComment];
    issues[index].updatedAt = newComment.createdAt;
    this.saveLocalIssues(issues);

    return newComment;
  },

  async toggleUpvote(issueId: string, userId: string): Promise<{ upvotes: number; userUpvoted: boolean }> {
    const issues = this.getLocalIssues();
    const index = issues.findIndex((iss) => iss.id === issueId || iss.ticketNumber === issueId);
    if (index === -1) return { upvotes: 0, userUpvoted: false };

    const issue = issues[index];
    const upvotedBy = issue.upvotedBy || [];
    const alreadyUpvoted = upvotedBy.includes(userId);

    let updatedUpvotedBy: string[];
    let newCount: number;

    if (alreadyUpvoted) {
      updatedUpvotedBy = upvotedBy.filter((id) => id !== userId);
      newCount = Math.max(0, issue.upvotes - 1);
    } else {
      updatedUpvotedBy = [...upvotedBy, userId];
      newCount = issue.upvotes + 1;
    }

    issue.upvotes = newCount;
    issue.upvotedBy = updatedUpvotedBy;
    issues[index] = issue;
    this.saveLocalIssues(issues);

    return { upvotes: newCount, userUpvoted: !alreadyUpvoted };
  },

  resetToInitialMock(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(ISSUES_STORAGE_KEY);
      this.saveLocalIssues(INITIAL_MOCK_ISSUES);
      window.location.reload();
    }
  },
};
