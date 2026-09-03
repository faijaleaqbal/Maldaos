import { getSupabaseClient, isMockModeEnabled } from '@/lib/supabase';
import {
  Issue,
  IssueCategory,
  IssueComment,
  IssuePriority,
  IssueStatus,
  TimelineEvent,
  UserRole,
  CampusLocation,
} from '@/types';
import { INITIAL_MOCK_ISSUES, MOCK_BUILDINGS } from './mockData';

const ISSUES_STORAGE_KEY = 'campuspulse_issues_store_v1';

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

export const IssuesService = {
  // ------------------------------------------------------------
  // LOCAL / MOCK FALLBACK ONLY
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
  // REAL BACKEND DATA TRANSFORMATION
  // ------------------------------------------------------------
  async transformDbIssue(
    row: any,
    currentUserId?: string,
    currentUserRole?: UserRole
  ): Promise<Issue> {
    const supabase = getSupabaseClient();

    // Generate signed URLs for private images
    const imageUrls: string[] = [];
    if (supabase && row.issue_images && Array.isArray(row.issue_images)) {
      for (const img of row.issue_images) {
        try {
          const bucket = img.kind === 'RESOLUTION_PROOF' ? 'resolution-proofs' : 'issue-photos';
          const { data, error } = await supabase.storage.from(bucket).createSignedUrl(img.storage_path, 3600);
          if (!error && data?.signedUrl) {
            imageUrls.push(data.signedUrl);
          }
        } catch (e) {
          console.warn('Could not generate signed URL for image:', img.storage_path);
        }
      }
    }

    // Determine privacy: if anonymous and viewer is not owner or staff+, hide reporter details
    const isOwner = currentUserId && row.student_id === currentUserId;
    const isStaffOrAdmin = currentUserRole && currentUserRole !== 'STUDENT';
    const isAnonymous = Boolean(row.is_anonymous);
    const hideIdentity = isAnonymous && !isOwner && !isStaffOrAdmin;

    const studentName = row.profiles?.full_name || 'Malda Student';
    const reporter = {
      id: hideIdentity ? 'anonymous' : row.student_id,
      name: hideIdentity ? 'Anonymous Student' : studentName,
      role: (row.profiles?.role as UserRole) || 'STUDENT',
      studentId: hideIdentity ? undefined : `MC-${row.student_id?.slice(0, 6).toUpperCase()}`,
      department: row.departments?.name || 'Malda College',
    };

    // Location mapping
    const locName = row.locations?.name || 'Main Block';
    const locCode = row.locations?.code || 'MAIN';
    const mockBuilding = MOCK_BUILDINGS.find((b) => b.code === locCode) || MOCK_BUILDINGS[0];
    const location: CampusLocation = {
      building: locName,
      buildingCode: locCode,
      floor: 'Campus Facility',
      roomOrLandmark: locName,
      coordinates: { lat: mockBuilding.lat, lng: mockBuilding.lng },
    };

    // Assigned staff mapping
    let assignedTo: Issue['assignedTo'] = undefined;
    if (row.issue_assignments && row.issue_assignments.length > 0) {
      const latestAssign = row.issue_assignments[row.issue_assignments.length - 1];
      if (latestAssign.assignee) {
        assignedTo = {
          id: latestAssign.assigned_to,
          name: latestAssign.assignee.full_name,
          department: latestAssign.department?.name || row.departments?.name || 'Campus Maintenance',
          phone: latestAssign.assignee.phone || undefined,
        };
      }
    }

    // Build timeline events
    const timeline: TimelineEvent[] = [
      {
        id: `tl-${row.id}-created`,
        status: 'OPEN',
        label: 'Issue Logged by Reporter',
        description: `Lodged at ${locName}${isAnonymous ? ' (Anonymous report)' : ''}.`,
        timestamp: row.created_at,
        actor: { name: reporter.name, role: reporter.role },
      },
    ];

    if (row.issue_status_history && Array.isArray(row.issue_status_history)) {
      for (const hist of row.issue_status_history) {
        timeline.push({
          id: hist.id || `tl-${hist.created_at}`,
          status: hist.new_status as IssueStatus,
          label: `Status: ${hist.new_status.replace('_', ' ')}`,
          description: hist.reason || `Status transitioned to ${hist.new_status}`,
          timestamp: hist.created_at,
          actor: {
            name: hist.changer?.full_name || 'Campus Duty Staff',
            role: hist.changer?.role || 'STAFF',
          },
        });
      }
    }

    // Comments mapping
    const comments: IssueComment[] = (row.issue_comments || []).map((c: any) => ({
      id: c.id,
      issueId: row.id,
      author: {
        id: c.author_id,
        name: c.author?.full_name || 'Campus User',
        role: (c.author?.role as UserRole) || 'STUDENT',
      },
      content: c.body,
      createdAt: c.created_at,
      isInternal: c.is_internal,
    }));

    // Upvotes mapping
    const upvotedBy: string[] = (row.issue_votes || []).map((v: any) => v.voter_id);
    const upvotes = upvotedBy.length;

    const ticketYear = new Date(row.created_at).getFullYear();
    const ticketSeq = row.id.slice(0, 8).toUpperCase();
    const ticketNumber = `MC-${ticketYear}-${ticketSeq}`;

    return {
      id: row.id,
      ticketNumber,
      title: row.title,
      description: row.description,
      category: row.category as IssueCategory,
      priority: row.priority as IssuePriority,
      status: row.status as IssueStatus,
      location,
      locationId: row.location_id,
      departmentId: row.department_id,
      department: row.departments?.name || 'Campus Infrastructure',
      reporter,
      assignedTo,
      images: imageUrls,
      upvotes,
      upvotedBy,
      isAnonymous,
      resolutionSummary: row.resolution_summary,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      resolvedAt: row.resolved_at,
      timeline,
      comments,
    };
  },

  // ------------------------------------------------------------
  // GET ALL ISSUES
  // ------------------------------------------------------------
  async getAllIssues(): Promise<Issue[]> {
    if (isMockModeEnabled()) {
      return this.getLocalIssues();
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Supabase client not initialized. Cannot fetch live issues.');
    }

    const { data: { user } } = await supabase.auth.getUser();
    const userRole = (user?.user_metadata?.role as UserRole) || 'STUDENT';

    const { data, error } = await supabase
      .from('issues')
      .select(`
        *,
        locations:location_id(id, name, code),
        departments:department_id(id, name, code),
        profiles:student_id(id, full_name, role),
        issue_images(id, storage_path, kind, file_size_bytes, content_type),
        issue_comments(id, author_id, body, is_internal, created_at, author:author_id(id, full_name, role)),
        issue_votes(voter_id),
        issue_status_history(id, old_status, new_status, changed_by, reason, created_at, changer:changed_by(id, full_name, role)),
        issue_assignments(id, department_id, assigned_to, note, created_at, assignee:assigned_to(id, full_name, phone), assigner:assigned_by(id, full_name, role), department:department_id(name))
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase query failed for getAllIssues:', error);
      throw new Error(`Database error: ${error.message} (${error.code || 'UNKNOWN'})`);
    }

    const issues = await Promise.all(
      (data || []).map((row) => this.transformDbIssue(row, user?.id, userRole))
    );
    return issues;
  },

  // ------------------------------------------------------------
  // GET ISSUE BY ID
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

    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Supabase client not initialized');
    }

    const { data: { user } } = await supabase.auth.getUser();
    const userRole = (user?.user_metadata?.role as UserRole) || 'STUDENT';

    // Query either by exact UUID or by searching
    let q = supabase
      .from('issues')
      .select(`
        *,
        locations:location_id(id, name, code),
        departments:department_id(id, name, code),
        profiles:student_id(id, full_name, role),
        issue_images(id, storage_path, kind, file_size_bytes, content_type),
        issue_comments(id, author_id, body, is_internal, created_at, author:author_id(id, full_name, role)),
        issue_votes(voter_id),
        issue_status_history(id, old_status, new_status, changed_by, reason, created_at, changer:changed_by(id, full_name, role)),
        issue_assignments(id, department_id, assigned_to, note, created_at, assignee:assigned_to(id, full_name, phone), assigner:assigned_by(id, full_name, role), department:department_id(name))
      `);

    if (idOrTicket.includes('-') && idOrTicket.length === 36) {
      q = q.eq('id', idOrTicket);
    } else {
      // Suffix search or fetch list
      const issues = await this.getAllIssues();
      return (
        issues.find(
          (iss) =>
            iss.id === idOrTicket ||
            iss.ticketNumber.toLowerCase() === idOrTicket.toLowerCase() ||
            iss.id.startsWith(idOrTicket)
        ) || null
      );
    }

    const { data, error } = await q.single();
    if (error || !data) {
      if (error && error.code !== 'PGRST116') {
        throw new Error(`Failed to load issue: ${error.message}`);
      }
      return null;
    }

    return await this.transformDbIssue(data, user?.id, userRole);
  },

  // ------------------------------------------------------------
  // CREATE ISSUE (Students)
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

    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not initialized');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Authentication required: please log in to submit a ticket.');
    }

    // Resolve location UUID
    let locationId = data.locationId;
    if (!locationId) {
      const { data: locations, error: locErr } = await supabase
        .from('locations')
        .select('id, name, code');
      if (locErr || !locations || locations.length === 0) {
        throw new Error('Could not resolve campus locations from database.');
      }
      const matched = locations.find(
        (l) => l.code === data.location.buildingCode || l.name.toLowerCase() === data.location.building.toLowerCase()
      );
      locationId = matched ? matched.id : locations[0].id;
    }

    // Call create_issue RPC (students only)
    const { data: createdIssueRow, error: rpcErr } = await supabase.rpc('create_issue', {
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
      throw new Error(`Failed to create issue: ${rpcErr.message}`);
    }

    const issueId = createdIssueRow.id;

    // Handle real image uploads to private bucket 'issue-photos'
    if (data.imageFiles && data.imageFiles.length > 0) {
      for (const file of data.imageFiles) {
        try {
          const cleanName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${file.name.split('.').pop()!.toLowerCase()}`;
          const storagePath = `${issueId}/${user.id}/${cleanName}`;

          const { error: uploadErr } = await supabase.storage
            .from('issue-photos')
            .upload(storagePath, file, {
              contentType: file.type,
              upsert: false,
            });

          if (uploadErr) {
            console.error('Storage upload failed:', uploadErr);
            continue;
          }

          // Register image metadata in database
          const { error: regErr } = await supabase.rpc('register_issue_image', {
            p_issue_id: issueId,
            p_kind: 'EVIDENCE',
            p_storage_path: storagePath,
            p_file_size_bytes: file.size,
            p_content_type: file.type,
          });

          if (regErr) {
            console.error('register_issue_image RPC failed:', regErr);
          }
        } catch (imgErr) {
          console.error('Image attachment failed:', imgErr);
        }
      }
    }

    // Fetch and return the fully populated issue
    const fetched = await this.getIssueById(issueId);
    if (!fetched) {
      throw new Error('Issue created in database, but could not retrieve ticket details.');
    }
    return fetched;
  },

  // ------------------------------------------------------------
  // UPDATE ISSUE STATUS (Staff / Admin RPC)
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

    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not initialized');

    const { error } = await supabase.rpc('transition_issue_status', {
      p_issue_id: id,
      p_new_status: newStatus,
      p_reason: note || null,
    });

    if (error) {
      console.error('transition_issue_status RPC failed:', error);
      throw new Error(`Status transition failed: ${error.message}`);
    }

    return await this.getIssueById(id);
  },

  // ------------------------------------------------------------
  // ASSIGN ISSUE (Department Admin / Super Admin RPC)
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

    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not initialized');

    const { error } = await supabase.rpc('assign_issue', {
      p_issue_id: id,
      p_department_id: params.departmentId,
      p_staff_id: params.staffId || null,
      p_note: params.note || null,
    });

    if (error) {
      console.error('assign_issue RPC failed:', error);
      throw new Error(`Assignment failed: ${error.message}`);
    }

    return await this.getIssueById(id);
  },

  // ------------------------------------------------------------
  // ADD COMMENT (Guarded RPC)
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

    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not initialized');

    const { data, error } = await supabase.rpc('add_comment', {
      p_issue_id: issueId,
      p_body: content,
      p_is_internal: isInternal,
    });

    if (error) {
      console.error('add_comment RPC failed:', error);
      throw new Error(`Failed to post comment: ${error.message}`);
    }

    return {
      id: data.id,
      issueId,
      author,
      content,
      createdAt: data.created_at || new Date().toISOString(),
      isInternal,
    };
  },

  // ------------------------------------------------------------
  // TOGGLE / CAST UPVOTE (Students RPC)
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

    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not initialized');

    const { data: newCount, error } = await supabase.rpc('cast_vote', {
      p_issue_id: issueId,
    });

    if (error) {
      console.error('cast_vote RPC failed:', error);
      throw new Error(`Vote failed: ${error.message}`);
    }

    return { upvotes: Number(newCount), userUpvoted: true };
  },

  // ------------------------------------------------------------
  // UPLOAD RESOLUTION PROOF (Staff / Admins)
  // ------------------------------------------------------------
  async uploadResolutionProof(issueId: string, file: File): Promise<string> {
    if (isMockModeEnabled()) {
      return URL.createObjectURL(file);
    }

    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not initialized');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required to upload resolution proof');

    const cleanName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${file.name.split('.').pop()!.toLowerCase()}`;
    const storagePath = `${issueId}/${user.id}/${cleanName}`;

    const { error: upErr } = await supabase.storage
      .from('resolution-proofs')
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (upErr) throw new Error(`Proof upload failed: ${upErr.message}`);

    const { error: regErr } = await supabase.rpc('register_issue_image', {
      p_issue_id: issueId,
      p_kind: 'RESOLUTION_PROOF',
      p_storage_path: storagePath,
      p_file_size_bytes: file.size,
      p_content_type: file.type,
    });

    if (regErr) throw new Error(`Proof registration failed: ${regErr.message}`);

    const { data } = await supabase.storage.from('resolution-proofs').createSignedUrl(storagePath, 3600);
    return data?.signedUrl || '';
  },

  // ------------------------------------------------------------
  // LIST LOCATIONS & DEPARTMENTS FROM DATABASE
  // ------------------------------------------------------------
  async getDepartments(): Promise<{ id: string; name: string; code: string }[]> {
    if (isMockModeEnabled()) {
      return [
        { id: 'dept-cse', name: 'Computer Science', code: 'CSE' },
        { id: 'dept-ece', name: 'Electronics', code: 'ECE' },
        { id: 'dept-fac', name: 'Facilities', code: 'FAC' },
      ];
    }

    const supabase = getSupabaseClient();
    if (!supabase) return [];
    const { data, error } = await supabase.from('departments').select('id, name, code').order('name');
    if (error) {
      console.warn('Failed to fetch departments:', error);
      return [];
    }
    return data || [];
  },

  async getLocations(): Promise<{ id: string; name: string; code: string }[]> {
    if (isMockModeEnabled()) {
      return MOCK_BUILDINGS.map((b) => ({ id: b.id, name: b.name, code: b.code }));
    }

    const supabase = getSupabaseClient();
    if (!supabase) return [];
    const { data, error } = await supabase.from('locations').select('id, name, code').order('name');
    if (error) {
      console.warn('Failed to fetch locations:', error);
      return [];
    }
    return data || [];
  },

  async getStaffByDepartment(departmentId: string): Promise<{ id: string; full_name: string; phone: string | null }[]> {
    if (isMockModeEnabled()) {
      return [
        { id: 'usr-staff-01', full_name: 'Subhashish Roy', phone: '+91 94340 77189' },
      ];
    }

    const supabase = getSupabaseClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, phone')
      .eq('department_id', departmentId)
      .in('role', ['STAFF', 'DEPARTMENT_ADMIN'])
      .eq('is_active', true);

    if (error) {
      console.warn('Failed to fetch department staff:', error);
      return [];
    }
    return data || [];
  },

  resetToInitialMock(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(ISSUES_STORAGE_KEY);
      this.saveLocalIssues(INITIAL_MOCK_ISSUES);
      window.location.reload();
    }
  },
};

