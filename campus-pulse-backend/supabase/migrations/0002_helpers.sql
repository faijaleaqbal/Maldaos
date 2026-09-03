-- ============================================================
-- CampusPulse 0002: Security helper functions (SECURITY DEFINER, STABLE)
-- ============================================================

-- Current user's profile row (or null when not authenticated)
create or replace function public.current_profile()
returns public.profiles
language sql stable security definer set search_path = public
as $$
  select * from public.profiles where id = auth.uid();
$$;

create or replace function public.current_role()
returns public.user_role
language sql stable security definer set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'STUDENT'::public.user_role);
$$;

create or replace function public.is_super_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'SUPER_ADMIN');
$$;

create or replace function public.is_staff_or_above()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and role in ('STAFF','DEPARTMENT_ADMIN','SUPER_ADMIN')
  );
$$;

create or replace function public.user_college_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select college_id from public.profiles where id = auth.uid();
$$;

create or replace function public.user_department_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select department_id from public.profiles where id = auth.uid();
$$;

-- Visibility rule:
--   owner OR (same college AND issue is not anonymous) OR
--   staff/dept-admin of the assigned department OR super admin.
-- Anonymous issues never leak identity via RLS-visible rows.
create or replace function public.can_view_issue(p_issue_id uuid)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare
  v_issue public.issues;
  v_me public.profiles;
begin
  select * into v_issue from public.issues where id = p_issue_id;
  if not found then return false; end if;

  select * into v_me from public.profiles where id = auth.uid();
  if v_me is null then return false; end if;

  if v_me.role = 'SUPER_ADMIN' then return true; end if;
  if v_issue.student_id = v_me.id then return true; end if;

  if v_me.role in ('STAFF','DEPARTMENT_ADMIN') then
    return v_issue.department_id = v_me.department_id and v_issue.college_id = v_me.college_id;
  end if;

  -- student: same college, non-anonymous only
  return v_issue.college_id = v_me.college_id and v_issue.is_anonymous = false;
end;
$$;

-- Can the current user vote on this issue (student, same college, issue visible)
create or replace function public.can_vote_issue(p_issue_id uuid)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare
  v_issue public.issues;
  v_me public.profiles;
begin
  select * into v_issue from public.issues where id = p_issue_id;
  if not found then return false; end if;
  select * into v_me from public.profiles where id = auth.uid();
  if v_me is null then return false; end if;
  return v_me.role = 'STUDENT'
     and v_issue.college_id = v_me.college_id
     and v_issue.is_anonymous = false
     and v_issue.student_id <> v_me.id;
end;
$$;

-- Can current user act as staff on this issue (assigned dept + same college)
create or replace function public.is_dept_staff_of_issue(p_issue_id uuid)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare
  v_issue public.issues;
  v_me public.profiles;
begin
  select * into v_issue from public.issues where id = p_issue_id;
  if not found then return false; end if;
  select * into v_me from public.profiles where id = auth.uid();
  if v_me is null then return false; end if;
  if v_me.role = 'SUPER_ADMIN' then return true; end if;
  if v_me.role not in ('STAFF','DEPARTMENT_ADMIN') then return false; end if;
  return v_issue.department_id = v_me.department_id and v_issue.college_id = v_me.college_id;
end;
$$;
