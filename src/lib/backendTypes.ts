/**
 * ============================================================================
 * BACKEND CONTRACT — the single source of truth for the frontend.
 * ============================================================================
 * Everything the frontend knows about the campus-pulse-backend schema lives
 * here: DB row shapes, enum sets (mirroring the Postgres enums 1:1), the legal
 * status-transition map, row -> view-model mappers, and display label maps.
 *
 * RULES
 *  1. The DB is the ONLY truth for enums. Never invent frontend-only states.
 *  2. Roles are NEVER trusted from browser metadata (user_metadata.role) —
 *     they come from profiles.role (DB) via these mappers / RLS.
 *  3. ticketNumber does NOT exist in the DB. It is derived deterministically
 *     from the issue id + created_at in `deriveTicketNumber()` below so it is
 *     stable across renders and sessions.
 *  4. lat/lng do NOT exist in the DB. Locations are `locations{id,name,code}`
 *     referenced via issue.location_id. Building geometry used by CampusMap is
 *     a UI-only nicety resolved from the static campus layout below.
 *  5. Legacy UI states are mapped for DISPLAY ONLY (never stored):
 *       REPORTED          -> OPEN
 *       AI_ANALYZED      -> OPEN (AI analysis surfaces as a separate badge)
 *       RESOLUTION_SUBMITTED -> RESOLVED (a resolution summary attached to a
 *                                staff-visible proof; DB has no intermediate
 *                                state — proof upload + reason happen in the
 *                                same RESOLVED transition)
 *       CRITICAL         -> URGENT (DB enum is URGENT; there is no CRITICAL)
 * ============================================================================
 */

import {
  CampusLocation,
  Issue,
  IssueCategory,
  IssueComment,
  IssuePriority,
  IssueStatus,
  NotificationItem,
  TimelineEvent,
  UserRole,
} from '@/types';

export type { UserRole, IssueStatus, IssueCategory, IssuePriority } from '@/types';

// ============================================================
// ENUM SETS — mirror of supabase/migrations/0001_schema.sql
// ============================================================

export const USER_ROLES = ['STUDENT', 'STAFF', 'DEPARTMENT_ADMIN', 'SUPER_ADMIN'] as const;
export const ISSUE_STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;
export const ISSUE_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export const ISSUE_CATEGORIES = [
  'INFRASTRUCTURE',
  'ACADEMICS',
  'HOSTEL',
  'CLEANLINESS',
  'SAFETY',
  'OTHER',
] as const;
export const IMAGE_KINDS = ['EVIDENCE', 'RESOLUTION_PROOF'] as const;
export const NOTIFICATION_TYPES = [
  'ISSUE_ASSIGNED',
  'STATUS_CHANGED',
  'COMMENT_ADDED',
  'RESOLVED',
  'REOPENED',
  'GENERAL',
] as const;

// ============================================================
// STATUS TRANSITION MAP — mirror of transition_issue_status() (0003_rpcs.sql)
// plus who may perform each transition (UI uses this to enable/disable).
// ============================================================

export const STATUS_TRANSITIONS: Record<IssueStatus, IssueStatus[]> = {
  OPEN: ['ASSIGNED'],
  ASSIGNED: ['IN_PROGRESS'],
  IN_PROGRESS: ['RESOLVED'],
  RESOLVED: ['CLOSED', 'OPEN'], // OPEN = reopen
  CLOSED: ['OPEN'], // super admin only
};

export interface TransitionRule {
  from: IssueStatus;
  next: IssueStatus;
  /** Which roles the backend allows for this edge (UI hint; DB enforces truth). */
  roles: UserRole[];
  /** Reason / resolution summary required (UI enforce; server also enforces). */
  requiresReason?: boolean;
  label: string;
}

export const TRANSITION_RULES: TransitionRule[] = [
  { from: 'OPEN', next: 'ASSIGNED', roles: ['DEPARTMENT_ADMIN', 'SUPER_ADMIN'], label: 'Assign to Department' },
  { from: 'ASSIGNED', next: 'IN_PROGRESS', roles: ['STAFF', 'DEPARTMENT_ADMIN', 'SUPER_ADMIN'], label: 'Start Work' },
  { from: 'IN_PROGRESS', next: 'RESOLVED', roles: ['STAFF', 'DEPARTMENT_ADMIN', 'SUPER_ADMIN'], label: 'Resolve', requiresReason: true },
  { from: 'RESOLVED', next: 'CLOSED', roles: ['SUPER_ADMIN'], label: 'Close & Archive' },
  { from: 'RESOLVED', next: 'OPEN', roles: ['STUDENT', 'STAFF', 'DEPARTMENT_ADMIN', 'SUPER_ADMIN'], label: 'Reopen' },
  { from: 'CLOSED', next: 'OPEN', roles: ['SUPER_ADMIN'], label: 'Reopen (Super Admin)' },
];

// Typed accessor: legal next statuses for a given current status.
export function legalNextStatuses(current: IssueStatus): IssueStatus[] {
  return STATUS_TRANSITIONS[current] ?? [];
}

export function isLegalTransition(from: IssueStatus, to: IssueStatus): boolean {
  return legalNextStatuses(from).includes(to);
}

/** Roles allowed for a specific edge (empty = no UI affordance should exist). */
export function rolesForTransition(from: IssueStatus, to: IssueStatus): UserRole[] {
  const rule = TRANSITION_RULES.find((r) => r.from === from && r.next === to);
  return rule ? rule.roles : [];
}

// ============================================================
// LEGACY STATE MAPPING (display-only; old mock/UI literals -> DB enums)
// ============================================================

const LEGACY_STATUS_MAP: Record<string, IssueStatus> = {
  REPORTED: 'OPEN',
  AI_ANALYZED: 'OPEN',
  RESOLUTION_SUBMITTED: 'RESOLVED', // documented decision above
  CRITICAL: 'URGENT' as unknown as IssueStatus, // defensive: legacy priority-as-status
};

const LEGACY_PRIORITY_MAP: Record<string, IssuePriority> = {
  CRITICAL: 'URGENT',
};

const LEGACY_CATEGORY_MAP: Record<string, IssueCategory> = {
  ELECTRICAL: 'INFRASTRUCTURE',
  PLUMBING: 'INFRASTRUCTURE',
  IT_NETWORK: 'ACADEMICS',
  FACILITY_CLASSROOM: 'ACADEMICS',
  LAB_EQUIPMENT: 'ACADEMICS',
  SANITATION: 'CLEANLINESS',
  SAFETY_SECURITY: 'SAFETY',
};

/** Normalize any status literal (incl. legacy UI states) to the DB enum set. */
export function normalizeStatus(raw: string | null | undefined): IssueStatus {
  const val = (raw || 'OPEN') as IssueStatus;
  if ((ISSUE_STATUSES as readonly string[]).includes(val)) return val;
  return LEGACY_STATUS_MAP[val] ?? 'OPEN';
}

/** Normalize any priority literal (maps legacy CRITICAL -> URGENT). */
export function normalizePriority(raw: string | null | undefined): IssuePriority {
  const val = (raw || 'LOW') as IssuePriority;
  if ((ISSUE_PRIORITIES as readonly string[]).includes(val)) return val;
  return LEGACY_PRIORITY_MAP[val] ?? 'LOW';
}

/** Normalize any category literal (maps all legacy frontend categories). */
export function normalizeCategory(raw: string | null | undefined): IssueCategory {
  const val = (raw || 'OTHER') as IssueCategory;
  if ((ISSUE_CATEGORIES as readonly string[]).includes(val)) return val;
  return LEGACY_CATEGORY_MAP[val] ?? 'OTHER';
}

// ============================================================
// DISPLAY LABEL MAPS — ONE place for every human label (no scattered enums)
// ============================================================

export const STATUS_LABELS: Record<IssueStatus, string> = {
  OPEN: 'Open',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

export const PRIORITY_LABELS: Record<IssuePriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

export const CATEGORY_LABELS: Record<IssueCategory, string> = {
  INFRASTRUCTURE: 'Infrastructure',
  ACADEMICS: 'Academics',
  HOSTEL: 'Hostel',
  CLEANLINESS: 'Cleanliness',
  SAFETY: 'Safety',
  OTHER: 'Other',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  STUDENT: 'Student',
  STAFF: 'Staff',
  DEPARTMENT_ADMIN: 'Department Admin',
  SUPER_ADMIN: 'Super Admin',
};

export const NOTIFICATION_LABELS: Record<string, string> = {
  ISSUE_ASSIGNED: 'Work Order Assigned',
  STATUS_CHANGED: 'Status Updated',
  COMMENT_ADDED: 'New Comment',
  RESOLVED: 'Issue Resolved',
  REOPENED: 'Issue Reopened',
  GENERAL: 'Campus Notice',
  // legacy frontend-only types kept for display compatibility
  STATUS_CHANGE: 'Status Updated',
  ASSIGNED: 'Work Order Assigned',
  CAMPUS_ALERT: 'Campus Alert',
  AI_NOTE: 'AI Notice',
};

export function statusLabel(s: IssueStatus): string {
  return STATUS_LABELS[s] ?? s;
}
export function priorityLabel(p: IssuePriority): string {
  return PRIORITY_LABELS[p] ?? p;
}
export function categoryLabel(c: IssueCategory): string {
  return CATEGORY_LABELS[c] ?? c;
}

/** Order value for sorting statuses along the lifecycle. */
export const STATUS_ORDER: Record<IssueStatus, number> = {
  OPEN: 1,
  ASSIGNED: 2,
  IN_PROGRESS: 3,
  RESOLVED: 4,
  CLOSED: 5,
};

export const PRIORITY_ORDER: Record<IssuePriority, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  URGENT: 4,
};

// ============================================================
// BACKEND ROW SHAPES — exact shapes returned by PostgREST selects
// ============================================================

export interface CollegeRow { id: string; name: string; created_at: string; }
export interface DepartmentRow { id: string; college_id: string; name: string; code: string; }
export interface LocationRow {
  id: string;
  college_id: string;
  name: string;
  code: string;
  parent_location_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface ProfileRow {
  id: string;
  college_id: string;
  department_id: string | null;
  role: UserRole;
  full_name: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // joined (only when requested)
  departments?: { name: string; code: string } | null;
  colleges?: { name: string } | null;
}

export interface IssueRow {
  id: string;
  college_id: string;
  student_id: string;
  department_id: string | null;
  location_id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  is_anonymous: boolean;
  resolution_summary: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  // joined relations (PostgREST embeds)
  locations?: LocationRow | null;
  departments?: DepartmentRow | null;
  profiles?: { id: string; full_name: string; role: UserRole } | null;
  issue_images?: ImageRow[];
  issue_comments?: CommentRow[];
  issue_votes?: { voter_id: string }[];
  issue_status_history?: StatusHistoryRow[];
  issue_assignments?: AssignmentRow[];
}

export interface ImageRow {
  id: string;
  issue_id: string;
  uploaded_by: string;
  kind: 'EVIDENCE' | 'RESOLUTION_PROOF';
  storage_path: string;
  file_size_bytes: number;
  content_type: string;
  created_at: string;
}

export interface CommentRow {
  id: string;
  issue_id: string;
  author_id: string;
  body: string;
  is_internal: boolean;
  created_at: string;
  author?: { id: string; full_name: string; role: UserRole } | null;
}

export interface StatusHistoryRow {
  id: string;
  issue_id: string;
  old_status: string | null;
  new_status: string;
  changed_by: string;
  reason: string | null;
  created_at: string;
  changer?: { id: string; full_name: string; role: UserRole } | null;
}

export interface AssignmentRow {
  id: string;
  issue_id: string;
  department_id: string;
  assigned_to: string | null;
  assigned_by: string;
  note: string | null;
  created_at: string;
  assignee?: { id: string; full_name: string; phone: string | null } | null;
  assigner?: { id: string; full_name: string; role: UserRole } | null;
  department?: { name: string } | null;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  issue_id: string | null;
  type: string;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export interface VoteRow { issue_id: string; voter_id: string; }

// ============================================================
// TICKET NUMBER — deterministic client-side derivation (not stored in DB)
//   MC-<first 6 of issue id>-<yymmddhhmm of creation>
// ============================================================

export function deriveTicketNumber(issueId: string, createdAt: string): string {
  const d = new Date(createdAt);
  if (!isNaN(d.getTime())) {
    const p = (n: number) => String(n).padStart(2, '0');
    const stamp = `${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}`;
    return `MC-${issueId.slice(0, 6).toUpperCase()}-${stamp}`;
  }
  return `MC-${issueId.slice(0, 6).toUpperCase()}`;
}

// ============================================================
// CAMPUS GEOMETRY — Authentic Malda College Landmark Coordinates
// ============================================================

export const MALDA_CAMPUS_COORDINATES = {
  lat: 25.001844,
  lng: 88.136558,
};

// ============================================================
// ROW -> VIEW MODEL MAPPERS
// ============================================================

/** Map a `profiles` row (+joined dept/college) to the frontend User VM. */
export function mapProfileToUser(
  profile: ProfileRow,
  email?: string | null
): import('@/types').User {
  return {
    id: profile.id,
    name: profile.full_name || (email ? email.split('@')[0] : 'User'),
    email: email || '',
    role: profile.role,
    department: profile.departments?.name || profile.colleges?.name || 'Malda College',
    phone: profile.phone || undefined,
    studentId: profile.role === 'STUDENT' ? `MC-${profile.id.slice(0, 6).toUpperCase()}` : undefined,
    staffId: profile.role !== 'STUDENT' ? `MC-STF-${profile.id.slice(0, 6).toUpperCase()}` : undefined,
  };
}

/**
 * Map a notifications row to the frontend NotificationItem VM.
 * payload carries context like { status, department, comment_id }.
 */
export function mapNotificationRow(
  row: NotificationRow,
  issueTitle?: string,
  ticketNumber?: string
): NotificationItem {
  const payload = row.payload || {};
  const status = typeof payload.status === 'string' ? payload.status : undefined;
  const label = NOTIFICATION_LABELS[row.type] ?? row.type;
  let message: string;
  switch (row.type) {
    case 'ISSUE_ASSIGNED':
      message = 'Your ticket has been dispatched to the maintenance department.';
      break;
    case 'STATUS_CHANGED':
    case 'STATUS_CHANGE':
      message = status ? `Ticket status changed to ${statusLabel(normalizeStatus(status))}.` : 'Ticket status was updated.';
      break;
    case 'COMMENT_ADDED':
      message = 'A new update was posted on your ticket.';
      break;
    case 'RESOLVED':
      message = 'Your ticket has been resolved by the maintenance cell.';
      break;
    case 'REOPENED':
      message = 'Your ticket has been reopened for further action.';
      break;
    default:
      message = 'Campus operations notice.';
  }
  return {
    id: row.id,
    userId: row.user_id,
    title: issueTitle ? `${label}: ${issueTitle}` : label,
    message,
    ticketNumber,
    ticketId: row.issue_id || undefined,
    type: (row.type || 'GENERAL') as NotificationItem['type'],
    read: Boolean(row.read_at),
    createdAt: row.created_at,
  };
}

/** Map a status-history row to a TimelineEvent. */
export function mapHistoryToTimelineEvent(hist: StatusHistoryRow): TimelineEvent {
  const status = normalizeStatus(hist.new_status);
  const actor = hist.changer;
  return {
    id: hist.id,
    status,
    label: status === 'OPEN' && hist.old_status ? 'Reopened' : `Status: ${statusLabel(status)}`,
    description:
      hist.reason ||
      `Status transitioned to ${statusLabel(status)}${actor ? ` by ${actor.full_name}` : ''}.`,
    timestamp: hist.created_at,
    actor: {
      name: actor?.full_name || 'Campus Operations',
      role: actor ? ROLE_LABELS[actor.role] || actor.role : 'STAFF',
    },
  };
}

/** Map a comment row to the frontend IssueComment VM. */
export function mapCommentRow(row: CommentRow): IssueComment {
  const author = row.author;
  return {
    id: row.id,
    issueId: row.issue_id,
    author: {
      id: row.author_id,
      name: author?.full_name || 'Campus User',
      role: author?.role || 'STUDENT',
      department: undefined,
    },
    content: row.body,
    createdAt: row.created_at,
    isInternal: row.is_internal,
  };
}

/** Map a locations/departments reference row into the UI CampusLocation shape. */
export function mapLocationRow(
  location: LocationRow | null | undefined,
  fallbackName = 'Main Block'
): CampusLocation {
  const name = location?.name || fallbackName;
  const code = location?.code || 'MAIN';
  const coords =
    location?.latitude != null && location?.longitude != null
      ? { lat: location.latitude, lng: location.longitude }
      : MALDA_CAMPUS_COORDINATES;
  return {
    building: name,
    buildingCode: code,
    floor: 'Campus Facility',
    roomOrLandmark: name,
    coordinates: coords,
  };
}

/**
 * Map a full `issues` row (with embedded relations) to the frontend Issue VM.
 * `viewer` context drives anonymous-identity masking — the DB already hides
 * anonymous rows from other students via RLS; this is defense in depth for the
 * staff/admin path where the row IS visible but identity must not render.
 */
export function mapIssueRowToViewModel(
  row: IssueRow,
  viewer: { userId?: string; role?: UserRole } = {},
  signedImageUrls: string[] = [],
  resolutionProofUrls: string[] = []
): Issue {
  const status = normalizeStatus(row.status);
  const priority = normalizePriority(row.priority);
  const category = normalizeCategory(row.category);

  const isOwner = viewer.userId != null && row.student_id === viewer.userId;
  const isStaffOrAbove = viewer.role != null && viewer.role !== 'STUDENT';
  const hideIdentity = row.is_anonymous && !isOwner && !isStaffOrAbove;

  const reporterProfile = row.profiles;
  const location = mapLocationRow(row.locations);

  // Assigned staff: use the latest assignment with an assignee
  let assignedTo: Issue['assignedTo'] = undefined;
  const assignments = row.issue_assignments || [];
  for (let i = assignments.length - 1; i >= 0; i--) {
    const a = assignments[i];
    if (a.assignee) {
      assignedTo = {
        id: a.assigned_to || a.assignee.id,
        name: a.assignee.full_name,
        department: a.department?.name || row.departments?.name || 'Campus Maintenance',
        phone: a.assignee.phone || undefined,
      };
      break;
    }
  }

  // Timeline: creation event + status history (ordered by created_at)
  const timeline: TimelineEvent[] = [
    {
      id: `tl-${row.id}-created`,
      status: 'OPEN',
      label: 'Issue Logged by Reporter',
      description: `Lodged at ${location.building}${row.is_anonymous ? ' (Anonymous report)' : ''}.`,
      timestamp: row.created_at,
      actor: {
        name: hideIdentity
          ? 'Anonymous Student'
          : reporterProfile?.full_name || 'Malda Student',
        role: ROLE_LABELS[(reporterProfile?.role as UserRole) || 'STUDENT'] || 'Student',
      },
    },
    ...(row.issue_status_history || [])
      .slice()
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map(mapHistoryToTimelineEvent),
  ];

  // Comments (RLS already filters internal notes by role; we do not re-filter)
  const comments = (row.issue_comments || []).map(mapCommentRow);

  // Votes
  const upvotedBy = (row.issue_votes || []).map((v) => v.voter_id);
  const upvotes = upvotedBy.length;

  return {
    id: row.id,
    ticketNumber: deriveTicketNumber(row.id, row.created_at),
    title: row.title,
    description: row.description,
    category,
    priority,
    status,
    location,
    locationId: row.location_id,
    departmentId: row.department_id,
    reporter: {
      id: hideIdentity ? 'anonymous' : row.student_id,
      name: hideIdentity
        ? 'Anonymous Student'
        : reporterProfile?.full_name || 'Malda Student',
      role: (reporterProfile?.role as UserRole) || 'STUDENT',
      studentId: hideIdentity ? undefined : `MC-${row.student_id?.slice(0, 6).toUpperCase()}`,
      department: row.departments?.name || 'Malda College',
    },
    assignedTo,
    department: row.departments?.name || 'Unassigned Department',
    images: signedImageUrls,
    resolutionProofImages: resolutionProofUrls,
    upvotes,
    upvotedBy,
    isAnonymous: row.is_anonymous,
    resolutionSummary: row.resolution_summary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
    timeline,
    comments,
  };
}
