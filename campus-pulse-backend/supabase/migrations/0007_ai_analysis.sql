-- ============================================================
-- CampusPulse 0007: AI analysis persistence
-- Stores AI recommendations linked to issues. AI output is ALWAYS
-- a recommendation: it never auto-resolves/closes/assigns. The
-- application code decides whether to apply the recommendation.
-- ============================================================

create table public.ai_analysis (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete cascade,
  college_id uuid not null references public.colleges(id) on delete cascade,
  -- The AI-recommended values. Storing recommendations; the actual issue
  -- row's category/priority remain whatever the user/admin chose.
  category_recommended public.issue_category not null,
  severity_recommended text,
  priority_recommended public.priority not null,
  summary text not null,
  confidence real,
  reasoning text,
  -- Provenance
  provider text not null,
  model text not null,
  -- 'ok' = at least one real provider responded.
  -- 'fallback' = every provider failed; the row still exists so the
  -- frontend can show "AI analysis unavailable." and the admin can
  -- triage manually.
  status text not null check (status in ('ok','fallback')),
  latency_ms integer not null,
  attempts integer not null,
  feature text not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);

create index idx_ai_analysis_issue on public.ai_analysis(issue_id, created_at desc);
create index idx_ai_analysis_college on public.ai_analysis(college_id, created_at desc);

-- ------------------------------------------------------------
-- save_ai_analysis — SECURITY DEFINER so any signed-in user can
-- attach an analysis to an issue they can already see. We still
-- validate college alignment inside the function so a user cannot
-- write an analysis against an issue in another college.
-- ------------------------------------------------------------
create or replace function public.save_ai_analysis(
  p_issue_id uuid, p_college_id uuid,
  p_category public.issue_category, p_severity text, p_priority public.priority,
  p_summary text, p_confidence real, p_reasoning text,
  p_provider text, p_model text, p_status text,
  p_latency_ms integer, p_attempts integer, p_feature text
)
returns public.ai_analysis
language plpgsql security definer set search_path = public
as $$
declare
  v_row public.ai_analysis;
  v_issue public.issues;
begin
  if p_status not in ('ok','fallback') then
    raise exception 'INVALID_STATUS: must be ok or fallback';
  end if;
  if char_length(coalesce(p_summary,'')) > 4000 then
    raise exception 'INVALID_SUMMARY: too long';
  end if;

  select * into v_issue from public.issues where id = p_issue_id for update;
  if not found then raise exception 'NOT_FOUND: issue not found'; end if;
  if v_issue.college_id <> p_college_id then
    raise exception 'FORBIDDEN: cross-college write';
  end if;
  if not public.can_view_issue(p_issue_id) then
    raise exception 'FORBIDDEN: cannot view this issue';
  end if;

  insert into public.ai_analysis(
    issue_id, college_id, category_recommended, severity_recommended,
    priority_recommended, summary, confidence, reasoning,
    provider, model, status, latency_ms, attempts, feature, created_by
  ) values (
    p_issue_id, p_college_id, p_category, p_severity, p_priority,
    p_summary, p_confidence, p_reasoning,
    p_provider, p_model, p_status, p_latency_ms, p_attempts, p_feature, auth.uid()
  )
  returning * into v_row;
  return v_row;
end;
$$;

-- ------------------------------------------------------------
-- latest_ai_analysis — convenience RPC for the frontend.
-- ------------------------------------------------------------
create or replace function public.latest_ai_analysis(p_issue_id uuid)
returns public.ai_analysis
language sql stable security definer set search_path = public
as $$
  select * from public.ai_analysis
  where issue_id = p_issue_id
  order by created_at desc
  limit 1;
$$;

-- ------------------------------------------------------------
-- RLS for ai_analysis: only the same people who can view the
-- parent issue can read its analyses; only the application
-- (via SECURITY DEFINER) writes rows.
-- ------------------------------------------------------------
alter table public.ai_analysis enable row level security;

-- Read: must be able to view the parent issue.
create policy ai_analysis_select on public.ai_analysis
  for select to authenticated
  using (public.can_view_issue(issue_id));

-- No insert/update/delete policies: writes go through the
-- SECURITY DEFINER RPC save_ai_analysis() which enforces
-- visibility + cross-college checks itself.

-- ------------------------------------------------------------
-- Optional: pgvector hook for future duplicate-detection
-- embeddings. The migration does NOT require the extension
-- to be installed; the comment + check below document the
-- intended shape and degrade gracefully if pgvector is absent.
--
--   create extension if not exists vector;
--   alter table public.ai_analysis
--     add column embedding vector(1536);
--   create index idx_ai_analysis_embedding
--     on public.ai_analysis using ivfflat (embedding vector_cosine_ops);
--
-- The application layer should query via:
--   select id, issue_id from public.ai_analysis
--   order by embedding <=> $1 limit 20;
-- ============================================================