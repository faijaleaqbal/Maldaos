-- ============================================================
-- CampusPulse 0003: SECURITY DEFINER RPCs — the guarded write paths
-- All admin/protected mutations flow through these functions.
-- ============================================================

-- Internal audit helper
create or replace function public.audit_log(
  p_actor uuid, p_action text, p_entity text, p_entity_id uuid,
  p_old jsonb default null, p_new jsonb default null
)
returns void
language sql security definer set search_path = public
as $$
  insert into public.audit_logs(actor_id, action, entity, entity_id, old_values, new_values)
  values (p_actor, p_action, p_entity, p_entity_id, p_old, p_new);
$$;

-- Internal notification helper
create or replace function public.notify_user(
  p_user uuid, p_type public.notification_type, p_issue uuid, p_payload jsonb default '{}'
)
returns void
language sql security definer set search_path = public
as $$
  insert into public.notifications(user_id, issue_id, type, payload)
  values (p_user, p_issue, p_type, coalesce(p_payload, '{}'));
$$;

-- ------------------------------------------------------------
-- CREATE ISSUE (students only)
-- ------------------------------------------------------------
create or replace function public.create_issue(
  p_title text, p_description text, p_category public.issue_category,
  p_location_id uuid, p_priority public.priority default 'LOW',
  p_department_id uuid default null, p_is_anonymous boolean default false
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

  insert into public.issues (college_id, student_id, department_id, location_id, title, description, category, priority, is_anonymous)
  values (v_me.college_id, v_me.id, p_department_id, p_location_id, p_title, p_description, p_category, p_priority, p_is_anonymous)
  returning * into v_issue;

  return v_issue;
end;
$$;

-- ------------------------------------------------------------
-- ASSIGN ISSUE to a department (dept admin of that dept, or super admin)
-- OPEN -> ASSIGNED
-- ------------------------------------------------------------
create or replace function public.assign_issue(
  p_issue_id uuid, p_department_id uuid, p_staff_id uuid default null, p_note text default null
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_issue public.issues;
  v_me public.profiles;
  v_old_status public.issue_status;
begin
  select * into v_me from public.profiles where id = auth.uid();
  if v_me is null then
    raise exception 'AUTH_REQUIRED: must be signed in';
  end if;

  select * into v_issue from public.issues where id = p_issue_id for update;
  if not found then
    raise exception 'NOT_FOUND: issue not found';
  end if;

  -- mark this transaction as a trusted RPC path for the issues guard trigger
  perform set_config('app.rpc', 'on', true);

  -- Authorization: super admin OR department admin of the TARGET department at the issue's college
  if v_me.role <> 'SUPER_ADMIN' then
    if v_me.role <> 'DEPARTMENT_ADMIN' then
      raise exception 'FORBIDDEN: only department admins or super admins can assign issues';
    end if;
    if v_me.department_id is distinct from p_department_id then
      raise exception 'FORBIDDEN: department admins can assign only to their own department';
    end if;
    if v_me.college_id <> v_issue.college_id then
      raise exception 'FORBIDDEN: issue belongs to another college';
    end if;
  end if;

  if v_issue.status not in ('OPEN','ASSIGNED') then
    raise exception 'INVALID_TRANSITION: cannot assign from status %', v_issue.status;
  end if;
  if not exists (
    select 1 from public.departments d where d.id = p_department_id and d.college_id = v_issue.college_id
  ) then
    raise exception 'INVALID_DEPARTMENT: department not in the issue''s college';
  end if;

  if p_staff_id is not null then
    if not exists (
      select 1 from public.profiles p
      where p.id = p_staff_id and p.department_id = p_department_id
        and p.role in ('STAFF','DEPARTMENT_ADMIN') and p.is_active
    ) then
      raise exception 'INVALID_ASSIGNEE: staff must belong to the assigned department';
    end if;
  end if;

  v_old_status := v_issue.status;

  perform public.audit_log(v_me.id, 'ISSUE_ASSIGNED', 'issues', v_issue.id,
    jsonb_build_object('department_id', v_issue.department_id, 'status', v_issue.status),
    jsonb_build_object('department_id', p_department_id, 'assigned_to', p_staff_id));

  insert into public.issue_assignments(issue_id, department_id, assigned_to, assigned_by, note)
  values (v_issue.id, p_department_id, p_staff_id, v_me.id, p_note);

  update public.issues
     set department_id = p_department_id,
         status = 'ASSIGNED',
         updated_at = now()
   where id = v_issue.id;

  insert into public.issue_status_history(issue_id, old_status, new_status, changed_by, reason)
  values (v_issue.id, v_old_status, 'ASSIGNED', v_me.id, coalesce(p_note, 'Assigned to department'));

  perform public.notify_user(v_issue.student_id, 'ISSUE_ASSIGNED', v_issue.id,
    jsonb_build_object('department_id', p_department_id));
  if p_staff_id is not null then
    perform public.notify_user(p_staff_id, 'ISSUE_ASSIGNED', v_issue.id,
      jsonb_build_object('issue_id', v_issue.id, 'by', v_me.id));
  end if;
end;
$$;

-- ------------------------------------------------------------
-- TRANSITION ISSUE STATUS — lifecycle + role enforced here
--   OPEN -> ASSIGNED
--   ASSIGNED -> IN_PROGRESS
--   IN_PROGRESS -> RESOLVED (requires reason/resolution summary)
--   RESOLVED -> CLOSED
--   RESOLVED -> OPEN (reopen: student owner within 7 days, or staff+/admin)
--   CLOSED -> OPEN (super admin only)
-- ------------------------------------------------------------
create or replace function public.transition_issue_status(
  p_issue_id uuid, p_new_status public.issue_status, p_reason text default null
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_issue public.issues;
  v_me public.profiles;
  v_allowed boolean := false;
begin
  select * into v_me from public.profiles where id = auth.uid();
  if v_me is null then
    raise exception 'AUTH_REQUIRED: must be signed in';
  end if;

  select * into v_issue from public.issues where id = p_issue_id for update;
  if not found then
    raise exception 'NOT_FOUND: issue not found';
  end if;

  -- mark this transaction as a trusted RPC path for the issues guard trigger
  perform set_config('app.rpc', 'on', true);

  -- Transition legality (graph)
  if not (
    (v_issue.status = 'OPEN' and p_new_status in ('ASSIGNED'))
    or (v_issue.status = 'ASSIGNED' and p_new_status in ('IN_PROGRESS'))
    or (v_issue.status = 'IN_PROGRESS' and p_new_status in ('RESOLVED'))
    or (v_issue.status = 'RESOLVED' and p_new_status in ('CLOSED','OPEN'))
    or (v_issue.status = 'CLOSED' and p_new_status in ('OPEN'))
  ) then
    raise exception 'INVALID_TRANSITION: % -> % is not allowed', v_issue.status, p_new_status;
  end if;

  -- Actor authorization per transition
  if v_issue.status = 'OPEN' and p_new_status = 'ASSIGNED' then
    v_allowed := v_me.role in ('DEPARTMENT_ADMIN','SUPER_ADMIN');  -- use assign_issue normally
  elsif v_issue.status = 'ASSIGNED' and p_new_status = 'IN_PROGRESS' then
    v_allowed := public.is_dept_staff_of_issue(p_issue_id) and v_me.role in ('STAFF','DEPARTMENT_ADMIN','SUPER_ADMIN');
  elsif v_issue.status = 'IN_PROGRESS' and p_new_status = 'RESOLVED' then
    v_allowed := public.is_dept_staff_of_issue(p_issue_id) and v_me.role in ('STAFF','DEPARTMENT_ADMIN','SUPER_ADMIN');
    if coalesce(p_reason, '') = '' then
      raise exception 'RESOLUTION_REASON_REQUIRED: a reason/resolution summary is required to resolve';
    end if;
  elsif v_issue.status = 'RESOLVED' and p_new_status = 'CLOSED' then
    v_allowed := v_me.role = 'SUPER_ADMIN';
  elsif v_issue.status = 'RESOLVED' and p_new_status = 'OPEN' then
    -- student owner within 7 days OR staff+ of dept OR super admin
    if v_me.id = v_issue.student_id and v_me.role = 'STUDENT' then
      v_allowed := v_issue.resolved_at > now() - interval '7 days';
      if not v_allowed then
        raise exception 'REOPEN_WINDOW_EXPIRED: reopen allowed within 7 days of resolution';
      end if;
    else
      v_allowed := public.is_dept_staff_of_issue(p_issue_id) or v_me.role = 'SUPER_ADMIN';
    end if;
  elsif v_issue.status = 'CLOSED' and p_new_status = 'OPEN' then
    v_allowed := v_me.role = 'SUPER_ADMIN';
  end if;

  if not v_allowed then
    raise exception 'FORBIDDEN: you are not allowed to perform this transition';
  end if;

  perform public.audit_log(v_me.id, 'STATUS_CHANGED', 'issues', v_issue.id,
    jsonb_build_object('status', v_issue.status),
    jsonb_build_object('status', p_new_status, 'reason', p_reason));

  update public.issues
     set status = p_new_status,
         resolution_summary = case when p_new_status = 'RESOLVED' then coalesce(p_reason, resolution_summary)
                                   when p_new_status = 'OPEN' and v_issue.status = 'RESOLVED' then resolution_summary
                                   else resolution_summary end,
         resolved_at = case when p_new_status = 'RESOLVED' then now()
                            when p_new_status = 'OPEN' then null
                            else resolved_at end,
         updated_at = now()
   where id = v_issue.id;

  insert into public.issue_status_history(issue_id, old_status, new_status, changed_by, reason)
  values (v_issue.id, v_issue.status, p_new_status, v_me.id, p_reason);

  perform public.notify_user(v_issue.student_id,
    (case p_new_status
      when 'RESOLVED' then 'RESOLVED'
      when 'OPEN' then 'REOPENED'
      else 'STATUS_CHANGED' end)::public.notification_type,
    v_issue.id, jsonb_build_object('status', p_new_status));
end;
$$;

-- ------------------------------------------------------------
-- CAST VOTE (students, idempotent via unique constraint)
-- ------------------------------------------------------------
create or replace function public.cast_vote(p_issue_id uuid)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_me public.profiles;
begin
  select * into v_me from public.profiles where id = auth.uid();
  if v_me is null then
    raise exception 'AUTH_REQUIRED: must be signed in';
  end if;
  if not public.can_vote_issue(p_issue_id) then
    raise exception 'FORBIDDEN: cannot vote on this issue';
  end if;

  insert into public.issue_votes(issue_id, voter_id)
  values (p_issue_id, v_me.id)
  on conflict (issue_id, voter_id) do nothing;

  return (select count(*) from public.issue_votes where issue_id = p_issue_id);
end;
$$;

-- ------------------------------------------------------------
-- ADD COMMENT
--   students: visible issues only, never internal
--   staff+: their department's issues (internal allowed)
--   super admin: anywhere
-- ------------------------------------------------------------
create or replace function public.add_comment(
  p_issue_id uuid, p_body text, p_is_internal boolean default false
)
returns public.issue_comments
language plpgsql security definer set search_path = public
as $$
declare
  v_me public.profiles;
  v_issue public.issues;
  v_row public.issue_comments;
begin
  select * into v_me from public.profiles where id = auth.uid();
  if v_me is null then
    raise exception 'AUTH_REQUIRED: must be signed in';
  end if;
  if char_length(coalesce(p_body,'')) not between 1 and 2000 then
    raise exception 'INVALID_BODY: comment must be 1-2000 characters';
  end if;

  select * into v_issue from public.issues where id = p_issue_id;
  if not found then
    raise exception 'NOT_FOUND: issue not found';
  end if;

  if v_me.role = 'STUDENT' then
    if p_is_internal then
      raise exception 'FORBIDDEN: students cannot post internal comments';
    end if;
    if not public.can_view_issue(p_issue_id) then
      raise exception 'FORBIDDEN: cannot comment on this issue';
    end if;
  elsif v_me.role in ('STAFF','DEPARTMENT_ADMIN') then
    if not public.is_dept_staff_of_issue(p_issue_id) then
      raise exception 'FORBIDDEN: not a staff member of the assigned department';
    end if;
  end if;

  insert into public.issue_comments(issue_id, author_id, body, is_internal)
  values (p_issue_id, v_me.id, p_body, p_is_internal)
  returning * into v_row;

  perform public.notify_user(v_issue.student_id, 'COMMENT_ADDED', v_issue.id,
    jsonb_build_object('comment_id', v_row.id, 'internal', p_is_internal));
  return v_row;
end;
$$;

-- ------------------------------------------------------------
-- REGISTER IMAGE METADATA (after actual storage upload)
--   EVIDENCE: owner student (or staff+ of dept)
--   RESOLUTION_PROOF: staff+ only
--   Validates extension/content_type/size + path ownership
-- ------------------------------------------------------------
create or replace function public.register_issue_image(
  p_issue_id uuid, p_kind public.image_kind, p_storage_path text,
  p_file_size_bytes bigint, p_content_type text
)
returns public.issue_images
language plpgsql security definer set search_path = public
as $$
declare
  v_me public.profiles;
  v_row public.issue_images;
  v_ext text;
begin
  select * into v_me from public.profiles where id = auth.uid();
  if v_me is null then
    raise exception 'AUTH_REQUIRED: must be signed in';
  end if;

  if not exists (select 1 from public.issues where id = p_issue_id) then
    raise exception 'NOT_FOUND: issue not found';
  end if;

  if p_content_type not in ('image/jpeg','image/png','image/webp') then
    raise exception 'INVALID_CONTENT_TYPE: allowed: image/jpeg, image/png, image/webp';
  end if;
  if p_file_size_bytes is null or p_file_size_bytes <= 0 or p_file_size_bytes > 5242880 then
    raise exception 'INVALID_FILE_SIZE: max 5 MB';
  end if;

  v_ext := lower(regexp_replace(p_storage_path, '^.*\.', ''));
  if v_ext not in ('jpg','jpeg','png','webp') then
    raise exception 'INVALID_EXTENSION: allowed: jpg, jpeg, png, webp';
  end if;

  -- Path ownership: {issue_id}/{uploader_id}/...
  if p_storage_path !~ ('^' || p_issue_id::text || '/' || v_me.id::text || '/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$') then
    raise exception 'INVALID_PATH: must be {issue_id}/{your_user_id}/{name}.{ext}';
  end if;

  if p_kind = 'RESOLUTION_PROOF' then
    if v_me.role not in ('STAFF','DEPARTMENT_ADMIN','SUPER_ADMIN') then
      raise exception 'FORBIDDEN: only staff or admins can upload resolution proofs';
    end if;
    if not public.is_dept_staff_of_issue(p_issue_id) then
      raise exception 'FORBIDDEN: not a staff member of the assigned department';
    end if;
  else
    -- EVIDENCE: issue owner, or staff+ of assigned dept
    if not (
      v_me.id = (select student_id from public.issues where id = p_issue_id)
      or public.is_dept_staff_of_issue(p_issue_id)
      or v_me.role = 'SUPER_ADMIN'
    ) then
      raise exception 'FORBIDDEN: cannot attach evidence to this issue';
    end if;
  end if;

  insert into public.issue_images(issue_id, uploaded_by, kind, storage_path, file_size_bytes, content_type)
  values (p_issue_id, v_me.id, p_kind, p_storage_path, p_file_size_bytes, p_content_type)
  returning * into v_row;
  return v_row;
end;
$$;

-- ------------------------------------------------------------
-- MARK NOTIFICATION READ (own only)
-- ------------------------------------------------------------
create or replace function public.read_notification(p_notification_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.notifications
     set read_at = now()
   where id = p_notification_id and user_id = auth.uid();
  if not found then
    raise exception 'NOT_FOUND: notification not found or not yours';
  end if;
end;
$$;

-- ------------------------------------------------------------
-- CHANGE PROFILE ROLE (super admin only) — audited
-- ------------------------------------------------------------
create or replace function public.change_profile_role(
  p_profile_id uuid, p_role public.user_role, p_department_id uuid default null
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_me public.profiles;
  v_old public.profiles;
begin
  select * into v_me from public.profiles where id = auth.uid();
  if v_me is null or v_me.role <> 'SUPER_ADMIN' then
    raise exception 'FORBIDDEN: super admin only';
  end if;
  select * into v_old from public.profiles where id = p_profile_id;
  if not found then
    raise exception 'NOT_FOUND: profile not found';
  end if;
  if p_role in ('STAFF','DEPARTMENT_ADMIN') and p_department_id is null then
    raise exception 'INVALID_ROLE_TARGET: staff roles require a department';
  end if;

  -- trusted path flag for the profiles guard trigger
  perform set_config('app.rpc', 'on', true);

  perform public.audit_log(v_me.id, 'ROLE_CHANGED', 'profiles', p_profile_id,
    jsonb_build_object('role', v_old.role, 'department_id', v_old.department_id),
    jsonb_build_object('role', p_role, 'department_id', p_department_id));

  update public.profiles
     set role = p_role, department_id = p_department_id, updated_at = now()
   where id = p_profile_id;
end;
$$;

-- ------------------------------------------------------------
-- ADMIN ANALYTICS (super admin: college-wide; dept admin: own dept)
-- ------------------------------------------------------------
create or replace function public.admin_stats()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_me public.profiles;
  v_dept uuid;
  v_is_super boolean;
  v_by_status jsonb;
  v_by_category jsonb;
  v_avg_minutes numeric;
begin
  select * into v_me from public.profiles where id = auth.uid();
  if v_me is null then
    raise exception 'AUTH_REQUIRED: must be signed in';
  end if;
  if v_me.role not in ('DEPARTMENT_ADMIN','SUPER_ADMIN') then
    raise exception 'FORBIDDEN: department admins and super admins only';
  end if;

  v_is_super := v_me.role = 'SUPER_ADMIN';
  v_dept := v_me.department_id;

  select jsonb_object_agg(status, cnt) into v_by_status
  from (
    select status, count(*) as cnt from public.issues
    where college_id = v_me.college_id
      and (v_is_super or department_id = v_dept)
    group by status
  ) s;

  select jsonb_object_agg(category, cnt) into v_by_category
  from (
    select category, count(*) as cnt from public.issues
    where college_id = v_me.college_id
      and (v_is_super or department_id = v_dept)
    group by category
  ) c;

  select round(avg(extract(epoch from (resolved_at - created_at)) / 60.0), 1) into v_avg_minutes
  from public.issues
  where college_id = v_me.college_id
    and (v_is_super or department_id = v_dept)
    and resolved_at is not null;

  return jsonb_build_object(
    'scope', case when v_is_super then 'COLLEGE' else 'DEPARTMENT' end,
    'by_status', coalesce(v_by_status, '{}'::jsonb),
    'by_category', coalesce(v_by_category, '{}'::jsonb),
    'avg_resolution_minutes', v_avg_minutes
  );
end;
$$;
