-- ============================================================
-- MaldaOS 0009: Department complaint & improvement workflow (Stage 1)
-- ------------------------------------------------------------
-- ADDITIVE ONLY. This migration MUST NOT:
--   * alter the public.issue_status enum (OPEN/ASSIGNED/IN_PROGRESS/
--     RESOLVED/CLOSED stay exactly as-is — schema.test.ts enforces this)
--   * alter the public.issue_category enum (6 values stay as-is)
--   * modify existing tables' existing columns, existing RPCs' existing
--     parameters, existing RLS policies, or existing triggers.
--
-- What it ADDS:
--   1. issues.report_type  (COMPLAINT | SUGGESTION, default COMPLAINT)
--   2. issues.subcategory  (free text 2-80 chars, nullable)
--   3. department_categories table (configurable per-department
--      category/subcategory catalog — staff pool is data, never hard-coded)
--   4. report_reviews table (STAFF_REVIEW / ADMIN_REVIEW decisions with
--      MANDATORY reason — the approval layer WITHOUT touching the
--      5-state status machine)
--   5. create_issue(): two OPTIONAL trailing params (p_report_type,
--      p_subcategory). Old named-notation calls keep working unchanged.
--      Also sets app.rpc='on' before its INSERT, which 0008 documents as
--      the trusted-RPC path ("create_issue() sets its own validated column
--      values"). Without this flag the 0008 insert guard rejects any
--      student-chosen department_id — which the department-first report
--      flow requires.
--   6. review_report() RPC — staff confirm/reject/escalate on OPEN issues.
--   7. admin_decide_report() RPC — dept-head approve/reject/return, gated
--      on an existing staff CONFIRM (super admin may override).
--
-- Review-layer <-> status-machine mapping (no status change on review):
--   SUBMITTED / STAFF_REVIEW  = OPEN, no CONFIRM review yet
--   STAFF_CONFIRMED            = OPEN + latest STAFF_REVIEW = CONFIRM
--   STAFF_REJECTED             = OPEN + latest STAFF_REVIEW = REJECT (reason)
--   ADMIN_APPROVED             = OPEN + staff CONFIRM + ADMIN_REVIEW APPROVE
--                              (then existing assign_issue() -> ASSIGNED)
--   ADMIN_REJECTED / RETURNED  = OPEN + ADMIN_REVIEW REJECT/RETURN (reason)
--   STUDENT_VERIFICATION       = existing RESOLVED + 7-day reopen window
--   COMPLETED                  = existing CLOSED (super admin only)
-- ============================================================

-- ---------- 1. issues: report_type + subcategory (additive columns) ----------
alter table public.issues
  add column if not exists report_type text not null default 'COMPLAINT';

alter table public.issues
  add column if not exists subcategory text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'issues_report_type_check'
  ) then
    alter table public.issues
      add constraint issues_report_type_check
      check (report_type in ('COMPLAINT', 'SUGGESTION'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'issues_subcategory_check'
  ) then
    alter table public.issues
      add constraint issues_subcategory_check
      check (subcategory is null or char_length(subcategory) between 2 and 80);
  end if;
end
$$;

create index if not exists idx_issues_report_type
  on public.issues(college_id, report_type, status);

-- ---------- 2. department_categories: configurable catalog ----------
create table if not exists public.department_categories (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  category public.issue_category not null,
  subcategory text not null check (char_length(subcategory) between 2 and 80),
  kind text not null default 'COMPLAINT' check (kind in ('COMPLAINT', 'SUGGESTION')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (department_id, category, subcategory, kind)
);

create index if not exists idx_dept_cats_dept
  on public.department_categories(department_id, is_active);

alter table public.department_categories enable row level security;

drop policy if exists "department_categories: read same college" on public.department_categories;
create policy "department_categories: read same college" on public.department_categories
  for select to authenticated using (
    exists (
      select 1 from public.departments d
      where d.id = department_categories.department_id
        and d.college_id = public.user_college_id()
    )
  );

drop policy if exists "department_categories: super admin insert" on public.department_categories;
create policy "department_categories: super admin insert" on public.department_categories
  for insert to authenticated with check (public.is_super_admin());
drop policy if exists "department_categories: super admin update" on public.department_categories;
create policy "department_categories: super admin update" on public.department_categories
  for update to authenticated using (public.is_super_admin());
drop policy if exists "department_categories: super admin delete" on public.department_categories;
create policy "department_categories: super admin delete" on public.department_categories
  for delete to authenticated using (public.is_super_admin());

-- ---------- 3. report_reviews: staff + admin approval layer ----------
create table if not exists public.report_reviews (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id),
  stage text not null check (stage in ('STAFF_REVIEW', 'ADMIN_REVIEW')),
  decision text not null check (decision in ('CONFIRM', 'REJECT', 'ESCALATE', 'APPROVE', 'RETURN')),
  reason text not null check (char_length(reason) between 5 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists idx_report_reviews_issue
  on public.report_reviews(issue_id, created_at);

alter table public.report_reviews enable row level security;

-- Visible to anyone who can view the issue (same rule as status history).
drop policy if exists "report_reviews: view" on public.report_reviews;
create policy "report_reviews: view" on public.report_reviews
  for select to authenticated using (public.can_view_issue(issue_id));

-- Written via review_report()/admin_decide_report() RPCs only.
drop policy if exists "report_reviews: no direct insert" on public.report_reviews;
create policy "report_reviews: no direct insert" on public.report_reviews
  for insert to authenticated with check (false);
drop policy if exists "report_reviews: no direct update" on public.report_reviews;
create policy "report_reviews: no direct update" on public.report_reviews
  for update to authenticated using (false);
drop policy if exists "report_reviews: delete super admin" on public.report_reviews;
create policy "report_reviews: delete super admin" on public.report_reviews
  for delete to authenticated using (public.is_super_admin());

-- Privileges for the new tables (mirrors test-bootstrap.sh grants so that
-- upgraded databases — not just fresh bootstraps — stay consistent).
grant all privileges on table public.department_categories, public.report_reviews
  to postgres, anon, authenticated, service_role;

-- ---------- 4. create_issue(): optional report_type + subcategory ----------
-- NOTE: Postgres treats a new trailing-arg signature as an OVERLOAD, not a
-- replacement — so the old 7-arg function must be dropped first. After the
-- drop a single 9-arg function remains; existing named-notation calls with
-- 7 args keep working because the two new trailing params have defaults.
drop function if exists public.create_issue(
  text, text, public.issue_category, uuid, public.priority, uuid, boolean
);
create or replace function public.create_issue(
  p_title text, p_description text, p_category public.issue_category,
  p_location_id uuid, p_priority public.priority default 'LOW',
  p_department_id uuid default null, p_is_anonymous boolean default false,
  p_report_type text default 'COMPLAINT', p_subcategory text default null
)
returns public.issues
language plpgsql security definer set search_path = public
as $$
declare
  v_me public.profiles;
  v_issue public.issues;
begin
  select * into v_me from public.profiles where id = auth.uid();
  if v_me is null then
    raise exception 'AUTH_REQUIRED: must be signed in';
  end if;
  if v_me.role <> 'STUDENT' then
    raise exception 'FORBIDDEN: only students can create issues';
  end if;
  if char_length(coalesce(p_title,'')) not between 5 and 200 then
    raise exception 'INVALID_TITLE: title must be 5-200 characters';
  end if;
  if char_length(coalesce(p_description,'')) not between 10 and 5000 then
    raise exception 'INVALID_DESCRIPTION: description must be 10-5000 characters';
  end if;
  if p_department_id is not null and not exists (
    select 1 from public.departments d where d.id = p_department_id and d.college_id = v_me.college_id
  ) then
    raise exception 'INVALID_DEPARTMENT: department not in your college';
  end if;
  if not exists (
    select 1 from public.locations l where l.id = p_location_id and l.college_id = v_me.college_id
  ) then
    raise exception 'INVALID_LOCATION: location not in your college';
  end if;
  if p_report_type not in ('COMPLAINT', 'SUGGESTION') then
    raise exception 'INVALID_REPORT_TYPE: must be COMPLAINT or SUGGESTION';
  end if;
  if p_subcategory is not null and char_length(p_subcategory) not between 2 and 80 then
    raise exception 'INVALID_SUBCATEGORY: subcategory must be 2-80 characters';
  end if;

  -- Trusted RPC path for the 0008 issues_insert_guard trigger (which
  -- documents create_issue() as setting its own validated column values,
  -- including the student-chosen department_id). Column values above are
  -- already validated; the trigger must not second-guess them.
  perform set_config('app.rpc', 'on', true);

  insert into public.issues (college_id, student_id, department_id, location_id, title, description, category, priority, is_anonymous, report_type, subcategory)
  values (v_me.college_id, v_me.id, p_department_id, p_location_id, p_title, p_description, p_category, p_priority, p_is_anonymous, p_report_type, p_subcategory)
  returning * into v_issue;

  return v_issue;
end;
$$;

-- ---------- 5. review_report(): staff confirm / reject / escalate ----------
-- Staff review happens while the issue is OPEN (pre-assignment). The review
-- NEVER changes issues.status — it only records the decision + mandatory
-- reason. Assignment still flows through the existing assign_issue().
create or replace function public.review_report(
  p_issue_id uuid, p_decision text, p_reason text default null
)
returns public.report_reviews
language plpgsql security definer set search_path = public
as $$
declare
  v_me public.profiles;
  v_issue public.issues;
  v_row public.report_reviews;
begin
  select * into v_me from public.profiles where id = auth.uid();
  if v_me is null then
    raise exception 'AUTH_REQUIRED: must be signed in';
  end if;

  select * into v_issue from public.issues where id = p_issue_id for update;
  if not found then
    raise exception 'NOT_FOUND: issue not found';
  end if;

  -- mark this transaction as a trusted RPC path for the guard triggers
  perform set_config('app.rpc', 'on', true);

  -- Authorization: staff / dept admin of the issue's department, or super admin.
  -- (Existing role system reused — no parallel permission model.)
  if v_me.role not in ('STAFF', 'DEPARTMENT_ADMIN', 'SUPER_ADMIN') then
    raise exception 'FORBIDDEN: only department staff or admins can review reports';
  end if;
  if v_me.role <> 'SUPER_ADMIN' and not public.is_dept_staff_of_issue(p_issue_id) then
    raise exception 'FORBIDDEN: not a staff member of the assigned department';
  end if;

  -- Staff review is the pre-assignment gate: only OPEN issues are reviewable.
  if v_issue.status <> 'OPEN' then
    raise exception 'INVALID_TRANSITION: only OPEN issues can be staff-reviewed (status %)', v_issue.status;
  end if;

  if p_decision not in ('CONFIRM', 'REJECT', 'ESCALATE') then
    raise exception 'INVALID_DECISION: staff decision must be CONFIRM, REJECT or ESCALATE';
  end if;
  if char_length(coalesce(p_reason, '')) not between 5 and 2000 then
    raise exception 'REVIEW_REASON_REQUIRED: a reason (5-2000 characters) is mandatory for every review decision';
  end if;

  insert into public.report_reviews(issue_id, reviewer_id, stage, decision, reason)
  values (p_issue_id, v_me.id, 'STAFF_REVIEW', p_decision, p_reason)
  returning * into v_row;

  perform public.audit_log(v_me.id, 'STAFF_REVIEW', 'issues', v_issue.id,
    jsonb_build_object('status', v_issue.status),
    jsonb_build_object('staff_decision', p_decision, 'reason', p_reason));

  -- Student timeline event (reuses STATUS_CHANGED — no notification enum change).
  perform public.notify_user(v_issue.student_id, 'STATUS_CHANGED', v_issue.id,
    jsonb_build_object('status', v_issue.status, 'event', 'STAFF_' || p_decision));

  -- A CONFIRM pushes the report into the department-head approval queue.
  if p_decision = 'CONFIRM' then
    insert into public.notifications(user_id, issue_id, type, payload)
    select p.id, v_issue.id, 'GENERAL',
      jsonb_build_object('event', 'STAFF_CONFIRMED_AWAITS_APPROVAL', 'issue_id', v_issue.id)
    from public.profiles p
    where p.department_id = v_issue.department_id
      and p.role = 'DEPARTMENT_ADMIN'
      and p.is_active
      and p.id <> v_me.id;
  end if;

  return v_row;
end;
$$;

-- ---------- 6. admin_decide_report(): head approve / reject / return ----------
-- Dept-head decision on a staff-confirmed OPEN issue. APPROVE does NOT assign
-- by itself — the head (or super admin) then calls the existing assign_issue().
create or replace function public.admin_decide_report(
  p_issue_id uuid, p_decision text, p_reason text default null
)
returns public.report_reviews
language plpgsql security definer set search_path = public
as $$
declare
  v_me public.profiles;
  v_issue public.issues;
  v_row public.report_reviews;
begin
  select * into v_me from public.profiles where id = auth.uid();
  if v_me is null then
    raise exception 'AUTH_REQUIRED: must be signed in';
  end if;

  select * into v_issue from public.issues where id = p_issue_id for update;
  if not found then
    raise exception 'NOT_FOUND: issue not found';
  end if;

  -- mark this transaction as a trusted RPC path for the guard triggers
  perform set_config('app.rpc', 'on', true);

  -- Authorization: department admin of the issue's department, or super admin.
  if v_me.role not in ('DEPARTMENT_ADMIN', 'SUPER_ADMIN') then
    raise exception 'FORBIDDEN: only department heads or super admins can decide reports';
  end if;
  if v_me.role = 'DEPARTMENT_ADMIN' and v_me.department_id is distinct from v_issue.department_id then
    raise exception 'FORBIDDEN: department heads can decide only their own department reports';
  end if;

  -- Admin decision is the pre-assignment gate: only OPEN issues are decidable.
  if v_issue.status <> 'OPEN' then
    raise exception 'INVALID_TRANSITION: only OPEN issues await admin decision (status %)', v_issue.status;
  end if;

  -- Staff-confirmation gate (super admin may override for legacy/unreviewed rows).
  if v_me.role <> 'SUPER_ADMIN' and not exists (
    select 1 from public.report_reviews r
    where r.issue_id = p_issue_id
      and r.stage = 'STAFF_REVIEW'
      and r.decision = 'CONFIRM'
  ) then
    raise exception 'STAFF_CONFIRM_REQUIRED: a staff CONFIRM review is required before admin decision';
  end if;

  if p_decision not in ('APPROVE', 'REJECT', 'RETURN') then
    raise exception 'INVALID_DECISION: admin decision must be APPROVE, REJECT or RETURN';
  end if;
  if char_length(coalesce(p_reason, '')) not between 5 and 2000 then
    raise exception 'REVIEW_REASON_REQUIRED: a reason (5-2000 characters) is mandatory for every admin decision';
  end if;

  insert into public.report_reviews(issue_id, reviewer_id, stage, decision, reason)
  values (p_issue_id, v_me.id, 'ADMIN_REVIEW', p_decision, p_reason)
  returning * into v_row;

  perform public.audit_log(v_me.id, 'ADMIN_DECISION', 'issues', v_issue.id,
    jsonb_build_object('status', v_issue.status),
    jsonb_build_object('admin_decision', p_decision, 'reason', p_reason));

  -- Student timeline event (reuses STATUS_CHANGED — no notification enum change).
  perform public.notify_user(v_issue.student_id, 'STATUS_CHANGED', v_issue.id,
    jsonb_build_object('status', v_issue.status, 'event', 'ADMIN_' || p_decision));

  -- APPROVE wakes the staff pool (ready to be assigned via assign_issue()).
  -- RETURN sends it back to the reviewing staff pool.
  if p_decision in ('APPROVE', 'RETURN') then
    insert into public.notifications(user_id, issue_id, type, payload)
    select p.id, v_issue.id, 'GENERAL',
      jsonb_build_object('event', 'ADMIN_' || p_decision, 'issue_id', v_issue.id)
    from public.profiles p
    where p.department_id = v_issue.department_id
      and p.role in ('STAFF', 'DEPARTMENT_ADMIN')
      and p.is_active
      and p.id <> v_me.id;
  end if;

  return v_row;
end;
$$;

-- ---------- 7. Default catalog seed (idempotent, existing departments) ----------
-- Fresh bootstraps get their catalog from seed.ts (Stage 2); this block covers
-- UPGRADED databases that already have departments but no catalog rows.
-- Facility complaints mirror the existing 6-category taxonomy (no replacement).
do $$
declare
  v_dept record;
begin
  for v_dept in select id from public.departments loop
    -- COMPLAINT subcategories (existing taxonomy, extended per facility)
    insert into public.department_categories (department_id, category, subcategory, kind)
    values
      (v_dept.id, 'ACADEMICS', 'Classroom Problem', 'COMPLAINT'),
      (v_dept.id, 'INFRASTRUCTURE', 'Electrical', 'COMPLAINT'),
      (v_dept.id, 'INFRASTRUCTURE', 'Plumbing / Water', 'COMPLAINT'),
      (v_dept.id, 'CLEANLINESS', 'Cleanliness', 'COMPLAINT'),
      (v_dept.id, 'INFRASTRUCTURE', 'Furniture', 'COMPLAINT'),
      (v_dept.id, 'ACADEMICS', 'Lab / IT', 'COMPLAINT'),
      (v_dept.id, 'ACADEMICS', 'Library', 'COMPLAINT'),
      (v_dept.id, 'SAFETY', 'Security / Safety', 'COMPLAINT'),
      (v_dept.id, 'SAFETY', 'Parking / Accessibility', 'COMPLAINT'),
      (v_dept.id, 'CLEANLINESS', 'Waste / Environment', 'COMPLAINT'),
      (v_dept.id, 'HOSTEL', 'Hostel Facility', 'COMPLAINT'),
      (v_dept.id, 'OTHER', 'Other', 'COMPLAINT'),
      -- SUGGESTION subcategories (constructive wording — improvement, not blame)
      (v_dept.id, 'ACADEMICS', 'Teaching & Class Improvement', 'SUGGESTION'),
      (v_dept.id, 'ACADEMICS', 'Study Material Request', 'SUGGESTION'),
      (v_dept.id, 'ACADEMICS', 'Lab Improvement', 'SUGGESTION'),
      (v_dept.id, 'ACADEMICS', 'Timetable / Class Suggestion', 'SUGGESTION'),
      (v_dept.id, 'INFRASTRUCTURE', 'Classroom Environment', 'SUGGESTION'),
      (v_dept.id, 'OTHER', 'Department Facility Suggestion', 'SUGGESTION'),
      (v_dept.id, 'OTHER', 'Other Suggestion', 'SUGGESTION')
    on conflict (department_id, category, subcategory, kind) do nothing;
  end loop;
end
$$;
