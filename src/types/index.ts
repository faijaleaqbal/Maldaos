export type UserRole = 'STUDENT' | 'STAFF' | 'DEPARTMENT_ADMIN' | 'SUPER_ADMIN';

/**
 * Typed integration error thrown by live services. `code` carries the
 * backend's stable error prefix (FORBIDDEN, INVALID_TRANSITION, AUTH_REQUIRED,
 * NOT_FOUND, RESOLUTION_REASON_REQUIRED, REOPEN_WINDOW_EXPIRED, ...).
 */
export interface BackendError extends Error {
  code: string;
  details?: unknown;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department?: string;
  studentId?: string;
  staffId?: string;
  phone?: string;
  avatarUrl?: string;
}

export type IssueCategory =
  | 'INFRASTRUCTURE'
  | 'ACADEMICS'
  | 'HOSTEL'
  | 'CLEANLINESS'
  | 'SAFETY'
  | 'OTHER';

export type IssuePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type IssueStatus =
  | 'OPEN'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'CLOSED';

export interface CampusCoordinates {
  lat: number;
  lng: number;
}

export interface CampusLocation {
  building: string;
  buildingCode: string;
  floor: string;
  roomOrLandmark: string;
  coordinates: CampusCoordinates;
}

export interface PossibleDuplicate {
  ticketNumber: string;
  id: string;
  title: string;
  similarityScore: number;
  status: IssueStatus;
}

export interface AIAnalysis {
  detectedCategory: IssueCategory;
  suggestedSeverity: IssuePriority;
  suggestedPriority: IssuePriority;
  confidence: number;
  summary: string;
  suggestedDepartment: string;
  possibleDuplicates: PossibleDuplicate[];
  urgencyFactors: string[];
  isFallback?: boolean;
  analyzedAt: string;
  gatewayProvider?: string;
}

export interface TimelineEvent {
  id: string;
  status: IssueStatus;
  label: string;
  description: string;
  timestamp: string;
  actor: {
    name: string;
    role: string;
  };
  metadata?: Record<string, any>;
}

export interface IssueComment {
  id: string;
  issueId: string;
  author: {
    id: string;
    name: string;
    role: UserRole;
    avatarUrl?: string;
    department?: string;
  };
  content: string;
  createdAt: string;
  isInternal?: boolean;
}

export interface Issue {
  id: string;
  ticketNumber: string;
  title: string;
  description: string;
  category: IssueCategory;
  priority: IssuePriority;
  status: IssueStatus;
  location: CampusLocation;
  locationId?: string;
  departmentId?: string | null;
  reporter: {
    id: string;
    name: string;
    role: UserRole;
    studentId?: string;
    department?: string;
    avatarUrl?: string;
  };
  assignedTo?: {
    id: string;
    name: string;
    department: string;
    phone?: string;
    avatarUrl?: string;
  };
  department: string;
  images: string[];
  upvotes: number;
  upvotedBy: string[];
  isAnonymous?: boolean;
  resolutionSummary?: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
  aiAnalysis?: AIAnalysis;
  timeline: TimelineEvent[];
  comments: IssueComment[];
}

export interface CampusHealthScore {
  overall: number;
  resolutionPerformance: number;
  openIssueLoad: number;
  criticalSeverityIndex: number;
  recurringFaultIndex: number;
  statusLabel: 'OPTIMAL' | 'STABLE' | 'ATTENTION_NEEDED' | 'CRITICAL';
  trailingDays: number;
  disclaimer: string;
}

export interface CampusBuilding {
  id: string;
  name: string;
  code: string;
  lat: number;
  lng: number;
  departments: string[];
  floors: number;
  description: string;
  type: 'ACADEMIC' | 'ADMINISTRATIVE' | 'LABORATORY' | 'STUDENT_FACILITY' | 'RESIDENTIAL';
}

export interface InsightItem {
  id: string;
  type: 'RECURRING_PATTERN' | 'LOCATION_HOTSPOT' | 'SLA_RISK' | 'PREVENTIVE_MAINTENANCE';
  title: string;
  description: string;
  affectedArea: string;
  detectedDate: string;
  linkedTickets: string[];
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  actionableRecommendation: string;
  metricImpact?: string;
}

export interface NotificationItem {
  id: string;
  userId?: string;
  title: string;
  message: string;
  ticketNumber?: string;
  ticketId?: string;
  /**
   * DB notification_type set: ISSUE_ASSIGNED | STATUS_CHANGED | COMMENT_ADDED
   * | RESOLVED | REOPENED | GENERAL. Legacy display-only values are kept in the
   * union so old mock data still renders; mapping lives in lib/backendTypes.
   */
  type:
    | 'ISSUE_ASSIGNED'
    | 'STATUS_CHANGED'
    | 'COMMENT_ADDED'
    | 'RESOLVED'
    | 'REOPENED'
    | 'GENERAL'
    // legacy (display-compat only)
    | 'STATUS_CHANGE'
    | 'ASSIGNED'
    | 'CAMPUS_ALERT'
    | 'AI_NOTE';
  read: boolean;
  createdAt: string;
}

export interface AnalyticsSummary {
  totalIssues: number;
  openIssues: number;
  criticalIssues: number;
  inProgressIssues: number;
  resolvedIssues: number;
  resolutionRate: number; // percentage
  averageResolutionHours: number;
  campusHealth: CampusHealthScore;
  issuesByDay: { date: string; reported: number; resolved: number }[];
  issuesByCategory: { category: string; count: number; color: string }[];
  issuesByDepartment: { department: string; open: number; resolved: number; avgHours: number }[];
  issuesByBuilding: { building: string; count: number; critical: number }[];
  resolutionTimeDistribution: { bracket: string; count: number }[];
}
