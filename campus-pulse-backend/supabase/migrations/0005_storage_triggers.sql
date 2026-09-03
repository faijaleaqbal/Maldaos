-- ============================================================
-- CampusPulse 0005: Storage buckets, storage policies, guard triggers
-- ============================================================

-- ---------- Buckets (private; no public access) ----------
insert into storage.buckets (id, name, public)
values ('issue-photos', 'issue-photos', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('resolution-proofs', 'resolution-proofs', false)
on conflict (id) do nothing;

-- Path convention: {issue_id}/{uploader_id}/{uuid}.ext

-- issue-photos: read if you can view the issue
drop policy if exists "issue-photos: read via issue visibility" on storage.objects;
create policy "issue-photos: read via issue visibility" on storage.objects
  for select to authenticated using (
    bucket_id = 'issue-photos'
    and public.can_view_issue((string_to_array(name, '/'))[1]::uuid)
  );

-- issue-photos: upload only into your own namespace under an issue you own/staff
drop policy if exists "issue-photos: upload own path" on storage.objects;
create policy "issue-photos: upload own path" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'issue-photos'
    and name like (string_to_array(name, '/'))[1] || '/' || auth.uid()::text || '/%'
    and (
      (string_to_array(name, '/'))[1]::uuid in (
        select i.id from public.issues i
        where i.student_id = auth.uid()
          and i.college_id = public.user_college_id()
      )
      or public.is_staff_or_above()
    )
  );

-- issue-photos: delete by owner of path or super admin
drop policy if exists "issue-photos: delete own" on storage.objects;
create policy "issue-photos: delete own" on storage.objects
  for delete to authenticated using (
    bucket_id = 'issue-photos'
    and name like (string_to_array(name, '/'))[1] || '/' || auth.uid()::text || '/%'
  );
drop policy if exists "issue-photos: delete super admin" on storage.objects;
create policy "issue-photos: delete super admin" on storage.objects
  for delete to authenticated using (
    bucket_id = 'issue-photos' and public.is_super_admin()
  );

-- resolution-proofs: read only staff+ (department visibility of proof is
-- enforced at metadata level via issue_images; storage keeps it staff-wide
-- read but students never see paths thanks to issue_images RLS)
drop policy if exists "resolution-proofs: read staff+" on storage.objects;
create policy "resolution-proofs: read staff+" on storage.objects
  for select to authenticated using (
    bucket_id = 'resolution-proofs'
    and public.is_staff_or_above()
  );

-- resolution-proofs: upload staff+ into their own namespace
drop policy if exists "resolution-proofs: upload staff+ own path" on storage.objects;
create policy "resolution-proofs: upload staff+ own path" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'resolution-proofs'
    and public.is_staff_or_above()
    and name like (string_to_array(name, '/'))[1] || '/' || auth.uid()::text || '/%'
  );

-- resolution-proofs: delete own path or super admin
drop policy if exists "resolution-proofs: delete own" on storage.objects;
create policy "resolution-proofs: delete own" on storage.objects
  for delete to authenticated using (
    bucket_id = 'resolution-proofs'
    and name like (string_to_array(name, '/'))[1] || '/' || auth.uid()::text || '/%'
  );
drop policy if exists "resolution-proofs: delete super admin" on storage.objects;
create policy "resolution-proofs: delete super admin" on storage.objects
  for delete to authenticated using (
    bucket_id = 'resolution-proofs' and public.is_super_admin()
  );

-- ============================================================
-- GUARD TRIGGERS on public tables
-- ============================================================

-- issues: block direct changes to protected columns.
-- status / department_id / student_id / college_id changes are allowed
-- ONLY inside the SECURITY DEFINER RPCs (they set app.rpc = 'on').
create or replace function public.issues_protected_columns_guard()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_is_rpc boolean;
  v_me public.profiles;
begin
  -- no authenticated user context (service-role / trusted server path): allow
  if auth.uid() is null then
    return new;
  end if;

  v_is_rpc := coalesce(current_setting('app.rpc', true) = 'on', false);

  if v_is_rpc then
    return new;  -- trusted path: RPCs enforce their own permissions
  end if;

  select * into v_me from public.profiles where id = auth.uid();

  -- any change to protected columns outside RPC => deny
  if new.status is distinct from old.status
     or new.department_id is distinct from old.department_id
     or new.student_id is distinct from old.student_id
     or new.college_id is distinct from old.college_id
     or new.resolved_at is distinct from old.resolved_at
     or new.resolution_summary is distinct from old.resolution_summary then
    raise exception 'FORBIDDEN: protected columns (status, department, resolution) can only be changed through assign_issue()/transition_issue_status()';
  end if;

  -- students: only their own OPEN issues, only title/description
  if v_me.role = 'STUDENT' then
    if old.student_id <> v_me.id then
      raise exception 'FORBIDDEN: not your issue';
    end if;
    if old.status <> 'OPEN' then
      raise exception 'FORBIDDEN: issue can only be edited while OPEN';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_issues_guard on public.issues;
create trigger trg_issues_guard
  before update on public.issues
  for each row execute function public.issues_protected_columns_guard();

-- issue_votes: voter_id must be the caller (defense in depth; insert blocked by RLS anyway)
create or replace function public.issue_votes_guard()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;  -- trusted service path
  end if;
  if new.voter_id is distinct from auth.uid() then
    raise exception 'FORBIDDEN: voter_id must be your own id';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_issue_votes_guard on public.issue_votes;
create trigger trg_issue_votes_guard
  before insert on public.issue_votes
  for each row execute function public.issue_votes_guard();

-- issue_images: uploaded_by must be the caller (RLS also enforces)
create or replace function public.issue_images_guard()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;  -- trusted service path
  end if;
  if new.uploaded_by is distinct from auth.uid() then
    raise exception 'FORBIDDEN: uploaded_by must be your own id';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_issue_images_guard on public.issue_images;
create trigger trg_issue_images_guard
  before insert on public.issue_images
  for each row execute function public.issue_images_guard();

-- issue_status_history / issue_assignments: direct inserts blocked by RLS
-- (with check (false)); no trigger needed.

-- profiles: role/college/department are protected — direct UPDATE blocked
-- (super admin uses change_profile_role() RPC, which is audited)
create or replace function public.profiles_protected_columns_guard()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_is_rpc boolean;
begin
  -- no authenticated user context (service-role / trusted server path): allow
  if auth.uid() is null then
    return new;
  end if;
  v_is_rpc := coalesce(current_setting('app.rpc', true) = 'on', false);
  if v_is_rpc then
    return new;  -- change_profile_role() RPC path
  end if;
  if new.role is distinct from old.role
     or new.college_id is distinct from old.college_id
     or new.department_id is distinct from old.department_id then
    raise exception 'FORBIDDEN: role/college/department can only be changed through change_profile_role()';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_guard on public.profiles;
create trigger trg_profiles_guard
  before update on public.profiles
  for each row execute function public.profiles_protected_columns_guard();

-- updated_at maintenance
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_touch on public.profiles;
create trigger trg_profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
drop trigger if exists trg_issues_touch on public.issues;
create trigger trg_issues_touch before update on public.issues
  for each row execute function public.touch_updated_at();
