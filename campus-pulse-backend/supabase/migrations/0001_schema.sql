-- ============================================================
-- CampusPulse 0001: Enums, core schema, constraints, indexes
-- ============================================================

-- ENUMS ------------------------------------------------------
create type public.user_role as enum ('STUDENT','STAFF','DEPARTMENT_ADMIN','SUPER_ADMIN');
create type public.issue_status as enum ('OPEN','ASSIGNED','IN_PROGRESS','RESOLVED','CLOSED');
create type public.issue_category as enum ('INFRASTRUCTURE','ACADEMICS','HOSTEL','CLEANLINESS','SAFETY','OTHER');
create type public.priority as enum ('LOW','MEDIUM','HIGH','URGENT');
create type public.image_kind as enum ('EVIDENCE','RESOLUTION_PROOF');
create type public.notification_type as enum ('ISSUE_ASSIGNED','STATUS_CHANGED','COMMENT_ADDED','RESOLVED','REOPENED','GENERAL');

-- COLLEGES (future multi-college config root) ----------------
create table public.colleges (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

-- DEPARTMENTS ------------------------------------------------
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references public.colleges(id) on delete cascade,
  name text not null,
  code text not null,
  unique (college_id, code)
);

-- LOCATIONS (self-referencing hierarchy allowed) --------------
create table public.locations (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references public.colleges(id) on delete cascade,
  parent_location_id uuid references public.locations(id) on delete set null,
  name text not null,
  code text not null,
  unique (college_id, code)
);

-- PROFILES ---------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  college_id uuid not null references public.colleges(id),
  department_id uuid references public.departments(id) on delete set null,
  role public.user_role not null default 'STUDENT',
  full_name text not null default '',
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ISSUES -----------------------------------------------------
create table public.issues (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references public.colleges(id),
  student_id uuid not null references public.profiles(id),
  department_id uuid references public.departments(id) on delete set null,
  location_id uuid not null references public.locations(id),
  title text not null check (char_length(title) between 5 and 200),
  description text not null check (char_length(description) between 10 and 5000),
  category public.issue_category not null,
  priority public.priority not null default 'LOW',
  status public.issue_status not null default 'OPEN',
  is_anonymous boolean not null default false,
  resolution_summary text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_issues_college_status on public.issues(college_id, status);
create index idx_issues_department on public.issues(department_id);
create index idx_issues_student on public.issues(student_id);

-- ISSUE IMAGES -----------------------------------------------
create table public.issue_images (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id),
  kind public.image_kind not null default 'EVIDENCE',
  storage_path text not null unique,
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 5242880),
  content_type text not null check (content_type in ('image/jpeg','image/png','image/webp')),
  created_at timestamptz not null default now()
);
create index idx_issue_images_issue on public.issue_images(issue_id, kind);

-- ISSUE VOTES (one vote per user per issue) ------------------
create table public.issue_votes (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete cascade,
  voter_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (issue_id, voter_id)
);

-- ISSUE ASSIGNMENTS (history-preserving) ---------------------
create table public.issue_assignments (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete cascade,
  department_id uuid not null references public.departments(id),
  assigned_to uuid references public.profiles(id) on delete set null,
  assigned_by uuid not null references public.profiles(id),
  note text,
  created_at timestamptz not null default now()
);
create index idx_issue_assignments_issue on public.issue_assignments(issue_id);

-- ISSUE STATUS HISTORY (written only via RPC/trigger) --------
create table public.issue_status_history (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete cascade,
  old_status public.issue_status,
  new_status public.issue_status not null,
  changed_by uuid not null references public.profiles(id),
  reason text,
  created_at timestamptz not null default now()
);
create index idx_status_history_issue on public.issue_status_history(issue_id, created_at);

-- ISSUE COMMENTS ---------------------------------------------
create table public.issue_comments (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  body text not null check (char_length(body) between 1 and 2000),
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_issue_comments_issue on public.issue_comments(issue_id, created_at);

-- NOTIFICATIONS ----------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  issue_id uuid references public.issues(id) on delete cascade,
  type public.notification_type not null default 'GENERAL',
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_notifications_user on public.notifications(user_id, read_at);

-- AUDIT LOGS (super-admin read only; trigger/RPC writes) ------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);
create index idx_audit_entity on public.audit_logs(entity, entity_id, created_at);
