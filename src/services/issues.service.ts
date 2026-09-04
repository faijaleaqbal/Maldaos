import {
  getSupabaseClient,
  isMockModeEnabled,
  requireSupabaseClient,
  toBackendError,
} from '@/lib/supabase';
import {
  ImageRow,
  IssueRow,
  UserRole,
  mapIssueRowToViewModel,
} from '@/lib/backendTypes';
import {
  Issue,
  IssueCategory,
  IssueComment,
  IssuePriority,
  IssueStatus,
  TimelineEvent,
  CampusLocation,
  BackendError,
} from '@/types';
import { INITIAL_MOCK_ISSUES } from './mockData';

const ISSUES_STORAGE_KEY = 'campuspulse_issues_store_v1';

/** The exact PostgREST select used for every issue read (row + relations). */
const ISSUE_SELECT = `
  *,
  locations:location_id(id, name, code),
  departments:department_id(id, name, code),
  profiles:student_id(id, full_name, role),
  issue_images(id, storage_path, kind, file_size_bytes, content_type),
  issue_comments(id, author_id, body, is_internal, created_at, author:author_id(id, full_name, role)),
  issue_votes(voter_id),
  issue_status_history(id, old_status, new_status, changed_by, reason, created_at, changer:changed_by(id, full_name, role)),
  issue_assignments(id, department_id, assigned_to, note, created_at, assignee:assigned_to(id, full_name, phone), assigner:assigned_by(id, full_name, role), department:department_id(name))
`;

export interface CreateIssueInput {
  title: string;
  description: string;
  category: IssueCategory;
  priority: IssuePriority;
  location: CampusLocation;
  locationId?: string;
  departmentId?: string | null;
  isAnonymous?: boolean;
  reporter: {
    id: string;
    name: string;
    role: UserRole;
    studentId?: string;
    department?: string;
    avatarUrl?: string;
  };
  department?: string;
  images?: string[];
  imageFiles?: File[];
  customTimeline?: TimelineEvent[];
}

export interface AssignIssueInput {
  issueId: string;
  departmentId: string;
  staffId?: string;
  note?: string;
}

export interface DepartmentOption { id: string; name: string; code: string; }
export interface LocationOption { id: string; name: string; code: string; }
export interface StaffOption { id: string; full_name: string; phone: string | null; }

/** Storage buckets per image kind (0005_storage_triggers.sql). */
const BUCKET_FOR_KIND: Record<string, string> = {
  EVIDENCE: 'issue-photos',
  RESOLUTION_PROOF: 'resolution-proofs',
};

export const IssuesService = {
  // ------------------------------------------------------------
  // MOCK MODE ONLY — localStorage persistence. NEVER called in live mode.
  // ------------------------------------------------------------
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

  // ------------------------------------------------------------
  // INTERNAL: viewer context (auth session) for mappers
  // ------------------------------------------------------------
  async getViewer(): Promise<{ userId?: string; role?: UserRole }> {
    const supabase = getSupabaseClient();
    if (!supabase) return {};
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return {};
    // Role is read from the DB profile (authoritative), never user_metadata.
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single();
    return {
      userId: user.id,
      role: (profile?.role as UserRole) || 'STUDENT',
    };
  },

  // ------------------------------------------------------------
  // INTERNAL: signed URLs for a row's private-bucket images
  // ------------------------------------------------------------
  async signedImageUrls(row: IssueRow): Promise<string[]> {
    const supabase = getSupabaseClient();
    if (!supabase || !row.issue_images || row.issue_images.length === 0) return [];
    const urls: string[] = [];
    for (const img of row.issue_images as ImageRow[]) {
      try {
        const bucket = BUCKET_FOR_KIND[img.kind] || 'issue-photos';
        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUrl(img.storage_path, 3600);
        if (!error && data?.signedUrl) {
          urls.push(data.signedUrl);
        }
      } catch (e) {
        console.warn('Could not generate signed URL for image:', img.storage_path);
      }
    }
    return urls;
  },

  // ------------------------------------------------------------
  // GET ALL ISSUES
  //   LIVE: supabase only. Empty result = valid empty state. Errors throw
  //   typed BackendError for the UI ErrorState — NEVER a mock fallback.
  // ------------------------------------------------------------
  async getAllIssues(): Promise<Issue[]> {
    if (isMockModeEnabled()) {
      return this.getLocalIssues();
    }

    const supabase = requireSupabaseClient();

    const { data, error } = await supabase
      .from('issues')
      .select(ISSUE_SELECT)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('getAllIssues failed:', error);
      throw toBackendError(error, 'ISSUES_FETCH_FAILED');
    }

    const viewer = await this.getViewer();
    const rows = (data || []) as unknown as IssueRow[];
    return Promise.all(
      rows.map(async (row) =>
        mapIssueRowToViewModel(row, viewer, await this.signedImageUrls(row))
      )
    );
  },

  // ------------------------------------------------------------
  // GET ISSUE BY ID (UUID) — ticketNumber lookups resolve through the list
  // ------------------------------------------------------------
  async getIssueById(idOrTicket: string): Promise<Issue | null> {
    if (isMockModeEnabled()) {
      const issues = this.getLocalIssues();
      return (
        issues.find(
          (iss) =>
            iss.id === idOrTicket ||
            iss.ticketNumber.toLowerCase() === idOrTicket.toLowerCase()
        ) || null
      );
    }

    const supabase = requireSupabaseClient();

    const isUuid =
      idOrTicket.length === 36 && /^[0-9a-f-]{36}$/i.test(idOrTicket);

    if (!isUuid) {
      // Ticket-number / id-prefix search: resolve via the full list
      const issues = await this.getAllIssues();
      const lower = idOrTicket.toLowerCase();
      return (
        issues.find(
          (iss) =>
            iss.id === idOrTicket ||
            iss.ticketNumber.toLowerCase() === lower ||
            iss.id.startsWith(idOrTicket)
        ) || null
      );
    }

    const { data, error } = await supabase
      .from('issues')
      .select(ISSUE_SELECT)
      .eq('id', idOrTicket)
      .maybeSingle();

    if (error) {
      console.error('getIssueById failed:', error);
      throw toBackendError(error, 'ISSUE_FETCH_FAILED');
    }
    if (!data) return null;

    const row = data as unknown as IssueRow;
    const viewer = await this.getViewer();
    return mapIssueRowToViewModel(row, viewer, await this.signedImageUrls(row));
  },

  // ------------------------------------------------------------
  // CREATE ISSUE (students) — create_issue RPC + storage + register_issue_image
  // ------------------------------------------------------------
  async createIssue(data: CreateIssueInput): Promise<Issue> {
    if (isMockModeEnabled()) {
      const issues = this.getLocalIssues();
      const year = new Date().getFullYear();
      const ticketSeq = String(issues.length + 120).padStart(4, '0');
      const ticketNumber = `MC-${year}-${ticketSeq}`;
      const now = new Date().toISOString();

      const initialTimeline: TimelineEvent[] = data.customTimeline || [
        {
          id: `tl-${Date.now()}-1`,
          status: 'OPEN',
          label: 'Issue Logged by Reporter',
          description: `Submitted for ${data.location.building} (${data.location.roomOrLandmark})`,
          timestamp: now,
          actor: { name: data.reporter.name, role: data.reporter.role },
        },
      ];

      const newIssue: Issue = {
        id: `iss-${Date.now()}`,
        ticketNumber,
        title: data.title,
        description: data.description,
        category: data.category,
        priority: data.priority,
        status: 'OPEN',
        location: data.location,
        reporter: data.reporter,
        department: data.department || 'Campus Infrastructure',
        images: data.images || [],
        upvotes: 1,
        upvotedBy: [data.reporter.id],
        isAnonymous: data.isAnonymous,
        createdAt: now,
        updatedAt: now,
        timeline: initialTimeline,
        comments: [],
      };

      this.saveLocalIssues([newIssue, ...issues]);
      return newIssue;
    }

    const supabase = requireSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw toBackendError(
        { message: 'AUTH_REQUIRED: please log in to submit a ticket.' },
        'AUTH_REQUIRED'
      );
    }

    // Location must be a DB locations.id — no silent "first location" fallback.
    let locationId = data.locationId;
    if (!locationId) {
      const { data: locations, error: locErr } = await supabase
        .from('locations')
        .select('id, name, code');
      if (locErr || !locations || locations.length === 0) {
        throw toBackendError(
          { message: 'LOCATIONS_UNAVAILABLE: could not load campus locations from the database.' },
          'LOCATIONS_UNAVAILABLE'
        );
      }
      const matched = locations.find(
        (l) =>
          l.code === data.location.buildingCode ||
          l.name.toLowerCase() === data.location.building.toLowerCase()
      );
      if (!matched) {
        throw toBackendError(
          { message: 'INVALID_LOCATION: no campus location matches the selected building. Pick a location from the list.' },
          'INVALID_LOCATION'
        );
      }
      locationId = matched.id;
    }

    // create_issue RPC (students only; DB enforces role + validation)
    const { data: createdRow, error: rpcErr } = await supabase.rpc('create_issue', {
      p_title: data.title,
      p_description: data.description,
      p_category: data.category,
      p_location_id: locationId,
      p_priority: data.priority || 'LOW',
      p_department_id: data.departmentId || null,
      p_is_anonymous: Boolean(data.isAnonymous),
    });

    if (rpcErr) {
      console.error('create_issue RPC failed:', rpcErr);
      throw toBackendError(rpcErr, 'CREATE_ISSUE_FAILED');
    }

    const issueId = (createdRow as { id: string }).id;

    // Evidence photos: validate client-side, upload to private bucket,
    // register metadata via RPC. Failures are collected, not silent.
    if (data.imageFiles && data.imageFiles.length > 0) {
      for (const file of data.imageFiles) {
        const validation = validateImageFile(file);
        if (validation) {
          console.warn('Skipping invalid evidence file:', validation);
          continue;
        }
        const cleanName = storageFileName(file.name);
        const storagePath = `${issueId}/${user.id}/${cleanName}`;

        const { error: uploadErr } = await supabase.storage
          .from('issue-photos')
          .upload(storagePath, file, {
            contentType: file.type,
            upsert: false,
          });

        if (uploadErr) {
          console.error('Storage upload failed:', uploadErr);
          throw toBackendError(uploadErr, 'IMAGE_UPLOAD_FAILED');
        }

        const { error: regErr } = await supabase.rpc('register_issue_image', {
          p_issue_id: issueId,
          p_kind: 'EVIDENCE',
          p_storage_path: storagePath,
          p_file_size_bytes: file.size,
          p_content_type: file.type,
        });

        if (regErr) {
          console.error('register_issue_image RPC failed:', regErr);
          throw toBackendError(regErr, 'IMAGE_REGISTER_FAILED');
        }
      }
    }

    const fetched = await this.getIssueById(issueId);
    if (!fetched) {
      throw toBackendError(
        { message: 'Issue created in database, but the ticket could not be reloaded.' },
        'RELOAD_FAILED'
      );
    }
    return fetched;
  },

  // ------------------------------------------------------------
  // UPDATE ISSUE STATUS — transition_issue_status RPC
  //   Errors: INVALID_TRANSITION / FORBIDDEN / RESOLUTION_REASON_REQUIRED /
  //   REOPEN_WINDOW_EXPIRED / NOT_FOUND — surfaced as typed BackendError.
  // ------------------------------------------------------------
  async updateIssueStatus(
    id: string,
    newStatus: IssueStatus,
    actor: { name: string; role: string },
    note?: string
  ): Promise<Issue | null> {
    if (isMockModeEnabled()) {
      const issues = this.getLocalIssues();
      const index = issues.findIndex((iss) => iss.id === id || iss.ticketNumber === id);
      if (index === -1) return null;

      const issue = { ...issues[index] };
      issue.status = newStatus;
      issue.updatedAt = new Date().toISOString();
      if (newStatus === 'RESOLVED') {
        issue.resolvedAt = issue.updatedAt;
        if (note) issue.resolutionSummary = note;
      }

      const newTimelineEvent: TimelineEvent = {
        id: `tl-${Date.now()}`,
        status: newStatus,
        label: `Status: ${newStatus.replace('_', ' ')}`,
        description: note || `Status updated to ${newStatus} by ${actor.name}.`,
        timestamp: issue.updatedAt,
        actor,
      };

      issue.timeline = [...issue.timeline, newTimelineEvent];
      issues[index] = issue;
      this.saveLocalIssues(issues);
      return issue;
    }

    const supabase = requireSupabaseClient();

    const { error } = await supabase.rpc('transition_issue_status', {
      p_issue_id: id,
      p_new_status: newStatus,
      p_reason: note || null,
    });

    if (error) {
      console.error('transition_issue_status RPC failed:', error);
      throw toBackendError(error, 'TRANSITION_FAILED');
    }

    return await this.getIssueById(id);
  },

  // ------------------------------------------------------------
  // ASSIGN ISSUE — assign_issue RPC (dept admin of target dept / super admin)
  // ------------------------------------------------------------
  async assignIssue(
    id: string,
    params: { departmentId: string; staffId?: string; note?: string },
    actor: { name: string; role: string }
  ): Promise<Issue | null> {
    if (isMockModeEnabled()) {
      const issues = this.getLocalIssues();
      const index = issues.findIndex((iss) => iss.id === id || iss.ticketNumber === id);
      if (index === -1) return null;

      const issue = { ...issues[index] };
      issue.status = 'ASSIGNED';
      issue.departmentId = params.departmentId;
      issue.updatedAt = new Date().toISOString();

      const timelineEvent: TimelineEvent = {
        id: `tl-${Date.now()}`,
        status: 'ASSIGNED',
        label: 'Work Order Assigned',
        description: params.note || `Dispatched to department by ${actor.name}.`,
        timestamp: issue.updatedAt,
        actor,
      };

      issue.timeline = [...issue.timeline, timelineEvent];
      issues[index] = issue;
      this.saveLocalIssues(issues);
      return issue;
    }

    const supabase = requireSupabaseClient();

    const { error } = await supabase.rpc('assign_issue', {
      p_issue_id: id,
      p_department_id: params.departmentId,
      p_staff_id: params.staffId || null,
      p_note: params.note || null,
    });

    if (error) {
      console.error('assign_issue RPC failed:', error);
      throw toBackendError(error, 'ASSIGN_FAILED');
    }

    return await this.getIssueById(id);
  },

  // ------------------------------------------------------------
  // ADD COMMENT — add_comment RPC (students never internal; DB enforces)
  // ------------------------------------------------------------
  async addComment(
    issueId: string,
    content: string,
    author: { id: string; name: string; role: UserRole; department?: string },
    isInternal = false
  ): Promise<IssueComment | null> {
    if (isMockModeEnabled()) {
      const issues = this.getLocalIssues();
      const index = issues.findIndex((iss) => iss.id === issueId || iss.ticketNumber === issueId);
      if (index === -1) return null;

      const newComment: IssueComment = {
        id: `comm-${Date.now()}`,
        issueId,
        author,
        content,
        createdAt: new Date().toISOString(),
        isInternal,
      };

      issues[index].comments = [...(issues[index].comments || []), newComment];
      issues[index].updatedAt = newComment.createdAt;
      this.saveLocalIssues(issues);
      return newComment;
    }

    const supabase = requireSupabaseClient();

    const { data, error } = await supabase.rpc('add_comment', {
      p_issue_id: issueId,
      p_body: content,
      p_is_internal: isInternal,
    });

    if (error) {
      console.error('add_comment RPC failed:', error);
      throw toBackendError(error, 'COMMENT_FAILED');
    }

    const row = data as { id: string; created_at: string };
    return {
      id: row.id,
      issueId,
      author,
      content,
      createdAt: row.created_at || new Date().toISOString(),
      isInternal,
    };
  },

  // ------------------------------------------------------------
  // CAST VOTE — cast_vote RPC.
  //   DB semantics: ONE vote per student per issue, idempotent, NO un-vote.
  //   The UI adapts: an already-voted user sees "Endorsed" (disabled-style),
  //   and repeat calls are safe (server returns the same count).
  //   Students cannot vote on their own or anonymous issues (DB enforces).
  // ------------------------------------------------------------
  async toggleUpvote(issueId: string, userId: string): Promise<{ upvotes: number; userUpvoted: boolean }> {
    if (isMockModeEnabled()) {
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
    }

    const supabase = requireSupabaseClient();

    const { data: newCount, error } = await supabase.rpc('cast_vote', {
      p_issue_id: issueId,
    });

    if (error) {
      console.error('cast_vote RPC failed:', error);
      throw toBackendError(error, 'VOTE_FAILED');
    }

    return { upvotes: Number(newCount), userUpvoted: true };
  },

  // ------------------------------------------------------------
  // UPLOAD RESOLUTION PROOF (Staff / Admins) — 'resolution-proofs' bucket
  //   Client-side validation BEFORE upload; register kind RESOLUTION_PROOF.
  // ------------------------------------------------------------
  async uploadResolutionProof(issueId: string, file: File): Promise<string> {
    if (isMockModeEnabled()) {
      return URL.createObjectURL(file);
    }

    const supabase = requireSupabaseClient();

    const validation = validateImageFile(file);
    if (validation) {
      throw toBackendError({ message: validation }, 'INVALID_FILE');
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw toBackendError(
        { message: 'AUTH_REQUIRED: sign in to upload a resolution proof.' },
        'AUTH_REQUIRED'
      );
    }

    const cleanName = storageFileName(file.name);
    const storagePath = `${issueId}/${user.id}/${cleanName}`;

    const { error: upErr } = await supabase.storage
      .from('resolution-proofs')
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (upErr) throw toBackendError(upErr, 'PROOF_UPLOAD_FAILED');

    const { error: regErr } = await supabase.rpc('register_issue_image', {
      p_issue_id: issueId,
      p_kind: 'RESOLUTION_PROOF',
      p_storage_path: storagePath,
      p_file_size_bytes: file.size,
      p_content_type: file.type,
    });

    if (regErr) throw toBackendError(regErr, 'PROOF_REGISTER_FAILED');

    const { data, error: signErr } = await supabase.storage
      .from('resolution-proofs')
      .createSignedUrl(storagePath, 3600);
    if (signErr || !data?.signedUrl) {
      throw toBackendError(signErr || { message: 'Could not sign proof URL.' }, 'SIGN_URL_FAILED');
    }
    return data.signedUrl;
  },

  // ------------------------------------------------------------
  // REFERENCE DATA — departments / locations / staff from the DB
  // ------------------------------------------------------------
  async getDepartments(): Promise<DepartmentOption[]> {
    if (isMockModeEnabled()) {
      return [
        { id: 'dept-cse', name: 'Computer Science', code: 'CSE' },
        { id: 'dept-ece', name: 'Electronics', code: 'ECE' },
        { id: 'dept-fac', name: 'Facilities', code: 'FAC' },
      ];
    }

    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
      .from('departments')
      .select('id, name, code')
      .order('name');
    if (error) {
      console.error('getDepartments failed:', error);
      throw toBackendError(error, 'DEPARTMENTS_FETCH_FAILED');
    }
    return (data || []) as DepartmentOption[];
  },

  async getLocations(): Promise<LocationOption[]> {
    if (isMockModeEnabled()) {
      const { MOCK_BUILDINGS } = await import('./mockData');
      return MOCK_BUILDINGS.map((b) => ({ id: b.id, name: b.name, code: b.code }));
    }

    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
      .from('locations')
      .select('id, name, code')
      .order('name');
    if (error) {
      console.error('getLocations failed:', error);
      throw toBackendError(error, 'LOCATIONS_FETCH_FAILED');
    }
    return (data || []) as LocationOption[];
  },

  async getStaffByDepartment(departmentId: string): Promise<StaffOption[]> {
    if (isMockModeEnabled()) {
      return [
        { id: 'usr-staff-01', full_name: 'Subhashish Roy', phone: '+91 94340 77189' },
      ];
    }

    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, phone')
      .eq('department_id', departmentId)
      .in('role', ['STAFF', 'DEPARTMENT_ADMIN'])
      .eq('is_active', true);

    if (error) {
      console.error('getStaffByDepartment failed:', error);
      throw toBackendError(error, 'STAFF_FETCH_FAILED');
    }
    return (data || []) as StaffOption[];
  },

  resetToInitialMock(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(ISSUES_STORAGE_KEY);
      this.saveLocalIssues(INITIAL_MOCK_ISSUES);
      window.location.reload();
    }
  },
};

// ------------------------------------------------------------
// Client-side image validation (mirrors register_issue_image rules)
// ------------------------------------------------------------

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

/** Returns an error message for invalid files, or null when valid. */
export function validateImageFile(file: File): string | null {
  if (!ALLOWED_MIME.includes(file.type)) {
    return 'Invalid format: only JPEG, PNG, or WebP images are permitted.';
  }
  if (file.size <= 0 || file.size > MAX_SIZE) {
    return 'File too large: images must be under 5 MB.';
  }
  return null;
}

/** Deterministic, path-safe storage filename (jpg/jpeg/png/webp extension). */
export function storageFileName(originalName: string): string {
  const ext = (originalName.split('.').pop() || 'jpg').toLowerCase();
  const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;
}
