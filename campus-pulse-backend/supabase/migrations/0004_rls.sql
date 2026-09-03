-- ============================================================
-- CampusPulse 0004: Row Level Security — every user-accessible table
-- Authorization enforced at the DB level, not only in app code.
-- ============================================================

-- ---------- COLLEGES ----------
alter table public.colleges enable row level security;
create policy "colleges: read for members" on public.colleges
  for select to authenticated using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.college_id = colleges.id)
  );
create policy "colleges: super admin write" on public.colleges
  for insert to authenticated with check (public.is_super_admin());
create policy "colleges: super admin update" on public.colleges
  for update to authenticated using (public.is_super_admin());
create policy "colleges: super admin delete" on public.colleges
  for delete to authenticated using (public.is_super_admin());

-- ---------- DEPARTMENTS ----------
alter table public.departments enable row level security;
create policy "departments: read same college" on public.departments
  for select to authenticated using (
    college_id = public.user_college_id()
  );
create policy "departments: super admin write" on public.departments
  for insert to authenticated with check (public.is_super_admin());
create policy "departments: super admin update" on public.departments
  for update to authenticated using (public.is_super_admin());
create policy "departments: super admin delete" on public.departments
  for delete to authenticated using (public.is_super_admin());

-- ---------- LOCATIONS ----------
alter table public.locations enable row level security;
create policy "locations: read same college" on public.locations
  for select to authenticated using (
    college_id = public.user_college_id()
  );
create policy "locations: super admin write" on public.locations
  for insert to authenticated with check (public.is_super_admin());
create policy "locations: super admin update" on public.locations
  for update to authenticated using (public.is_super_admin());
create policy "locations: super admin delete" on public.locations
  for delete to authenticated using (public.is_super_admin());

-- ---------- PROFILES ----------
alter table public.profiles enable row level security;
create policy "profiles: read own" on public.profiles
  for select to authenticated using (
    id = auth.uid() or public.is_super_admin()
  );
-- NOTE: directory-style reads of names are deliberately NOT allowed to keep
-- anonymous issues fully private; staff see who is assigned via assignments rows.
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = auth.uid())
  with check (id = auth.uid());
-- protected columns (role, college_id, department_id) are blocked from direct
-- change by the profiles guard trigger in 0005; role changes go through
-- change_profile_role() RPC (super admin only, audited).
create policy "profiles: insert own (self-signup flow)" on public.profiles
  for insert to authenticated with check (id = auth.uid());

-- ---------- ISSUES ----------
alter table public.issues enable row level security;
create policy "issues: view" on public.issues
  for select to authenticated using (public.can_view_issue(id));
create policy "issues: create as student" on public.issues
  for insert to authenticated with check (
    student_id = auth.uid()
    and college_id = public.user_college_id()
    and public.current_role() = 'STUDENT'
  );
-- Direct UPDATE is deliberately RESTRICTED by the guard trigger (0005):
-- students may only edit title/description while OPEN; status/department
-- changes are possible ONLY through transition_issue_status()/assign_issue().
create policy "issues: update own" on public.issues
  for update to authenticated using (
    student_id = auth.uid() and status = 'OPEN'
  );
create policy "issues: staff update guarded" on public.issues
  for update to authenticated using (
    public.is_dept_staff_of_issue(id)
  );
create policy "issues: super admin update" on public.issues
  for update to authenticated using (public.is_super_admin());
create policy "issues: delete super admin" on public.issues
  for delete to authenticated using (public.is_super_admin());

-- ---------- ISSUE_IMAGES ----------
alter table public.issue_images enable row level security;
-- EVIDENCE: visible to anyone who can view the issue.
-- RESOLUTION_PROOF: visible to staff+, the uploader, or the issue's student owner.
create policy "issue_images: view" on public.issue_images
  for select to authenticated using (
    public.can_view_issue(issue_id)
    and (
      kind = 'EVIDENCE'
      or public.is_staff_or_above()
      or uploaded_by = auth.uid()
      or auth.uid() = (select student_id from public.issues i where i.id = issue_id)
    )
  );
create policy "issue_images: insert own upload" on public.issue_images
  for insert to authenticated with check (
    uploaded_by = auth.uid()
    and storage_path like issue_id::text || '/' || auth.uid()::text || '/%'
  );
create policy "issue_images: delete super admin" on public.issue_images
  for delete to authenticated using (public.is_super_admin());

-- ---------- ISSUE_VOTES ----------
alter table public.issue_votes enable row level security;
create policy "issue_votes: view" on public.issue_votes
  for select to authenticated using (public.can_view_issue(issue_id));
create policy "issue_votes: insert via rpc only" on public.issue_votes
  for insert to authenticated with check (false);  -- blocked: cast_vote() RPC only

-- ---------- ISSUE_ASSIGNMENTS (written via assign_issue only) ----------
alter table public.issue_assignments enable row level security;
create policy "issue_assignments: view" on public.issue_assignments
  for select to authenticated using (public.can_view_issue(issue_id));
create policy "issue_assignments: no direct insert" on public.issue_assignments
  for insert to authenticated with check (false);
create policy "issue_assignments: no direct update" on public.issue_assignments
  for update to authenticated using (false);
create policy "issue_assignments: delete super admin" on public.issue_assignments
  for delete to authenticated using (public.is_super_admin());

-- ---------- ISSUE_STATUS_HISTORY (written by RPC only) ----------
alter table public.issue_status_history enable row level security;
create policy "status_history: view" on public.issue_status_history
  for select to authenticated using (public.can_view_issue(issue_id));
create policy "status_history: no direct insert" on public.issue_status_history
  for insert to authenticated with check (false);
create policy "status_history: no direct update" on public.issue_status_history
  for update to authenticated using (false);

-- ---------- ISSUE_COMMENTS ----------
alter table public.issue_comments enable row level security;
create policy "comments: view" on public.issue_comments
  for select to authenticated using (
    public.can_view_issue(issue_id)
    and (
      is_internal = false
      or public.is_dept_staff_of_issue(issue_id)
      or public.is_super_admin()
    )
  );
create policy "comments: insert via rpc only" on public.issue_comments
  for insert to authenticated with check (false);  -- add_comment() RPC only
create policy "comments: delete super admin" on public.issue_comments
  for delete to authenticated using (public.is_super_admin());

-- ---------- NOTIFICATIONS ----------
alter table public.notifications enable row level security;
create policy "notifications: read own" on public.notifications
  for select to authenticated using (user_id = auth.uid() or public.is_super_admin());
create policy "notifications: update own" on public.notifications
  for update to authenticated using (user_id = auth.uid());
create policy "notifications: no direct insert" on public.notifications
  for insert to authenticated with check (false);
create policy "notifications: delete own or super" on public.notifications
  for delete to authenticated using (user_id = auth.uid() or public.is_super_admin());

-- ---------- AUDIT_LOGS (super admin read only) ----------
alter table public.audit_logs enable row level security;
create policy "audit_logs: read super admin" on public.audit_logs
  for select to authenticated using (public.is_super_admin());
create policy "audit_logs: no direct insert" on public.audit_logs
  for insert to authenticated with check (false);
create policy "audit_logs: no direct update" on public.audit_logs
  for update to authenticated using (false);
create policy "audit_logs: no direct delete" on public.audit_logs
  for delete to authenticated using (false);
