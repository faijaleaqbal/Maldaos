-- ============================================================
-- CampusPulse 0008: issues INSERT guard trigger (F-2 remediation)
--
-- Closes the direct-INSERT authorization bypass where a STUDENT could
-- PostgREST-INSERT an issue with a fabricated state (status='RESOLVED',
-- arbitrary resolution_summary / resolved_at / department_id) — skipping
-- issue_status_history, issue_assignments, audit_logs and notifications.
--
-- Rules enforced on direct INSERT into public.issues:
--   * service-role / trusted server path (auth.uid() IS NULL): allowed
--     (seed scripts, SECURITY DEFINER RPCs).
--   * RPC trusted path (app.rpc = 'on'): allowed — create_issue() sets
--     its own validated column values.
--   * Otherwise (any authenticated direct PostgREST INSERT):
--       - only STUDENT role may insert (RLS already requires this),
--       - status MUST be 'OPEN' (the only legitimate initial state),
--       - department_id MUST be NULL (assignment happens via assign_issue()),
--       - resolution_summary MUST be NULL,
--       - resolved_at MUST be NULL.
-- ============================================================

create or replace function public.issues_insert_guard()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_is_rpc boolean;
  v_role public.user_role;
begin
  -- Trusted server path (service-role / migrations / seed): allow.
  if auth.uid() is null then
    return new;
  end if;

  -- Trusted RPC path (SECURITY DEFINER functions set app.rpc = 'on').
  v_is_rpc := coalesce(current_setting('app.rpc', true) = 'on', false);
  if v_is_rpc then
    return new;
  end if;

  -- Direct authenticated (PostgREST) INSERT: only a legitimate initial
  -- issue state is accepted. RLS already restricts this path to the owning
  -- STUDENT; this trigger makes the *state* itself non-fabricable.
  select role into v_role from public.profiles where id = auth.uid();
  if coalesce(v_role, 'STUDENT') <> 'STUDENT' then
    raise exception 'FORBIDDEN: only students can create issues (use create_issue())';
  end if;

  if new.status is distinct from 'OPEN' then
    raise exception 'FORBIDDEN: new issues must start as OPEN (status cannot be set directly)';
  end if;
  if new.department_id is not null then
    raise exception 'FORBIDDEN: department assignment is only possible through assign_issue()';
  end if;
  if new.resolution_summary is not null then
    raise exception 'FORBIDDEN: resolution_summary cannot be set at issue creation';
  end if;
  if new.resolved_at is not null then
    raise exception 'FORBIDDEN: resolved_at cannot be set at issue creation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_issues_insert_guard on public.issues;
create trigger trg_issues_insert_guard
  before insert on public.issues
  for each row execute function public.issues_insert_guard();
