-- ============================================================
-- CampusPulse 0007: AI analysis persistence
--
-- Stores AI recommendations linked to issues. AI output is ALWAYS a
-- recommendation — it never auto-resolves/closes/assigns. The
-- application code decides whether to apply the recommendation.
--
-- Enums: we store category/priority as TEXT rather than the DB enums
-- because the AI gateway and the product use richer vocabularies
-- (e.g. ELECTRICAL, PLUMBING, IT_NETWORK) than the 6-value DB enum
-- (INFRASTRUCTURE, ACADEMICS, HOSTEL, ...). Mapping is the
-- responsibility of the application layer.
-- ============================================================

create table public.ai_analysis (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete cascade,
  college_id uuid not null references public.colleges(id) on delete cascade,
  -- AI-recommended values. Always persisted as recommendations only;
  -- the live issues row keeps whatever the user/admin chose.
  category_recommended text not null,
  priority_recommended text not null,
  severity_recommended text,
  summary text not null,
  reasoning text,
  confidence real,
  -- Provenance.
  provider text not null,         -- 'groq' | 'openrouter' | 'nvidia' | 'google' | 'deterministic'
  model text not null,            -- free-form model id
  -- The integrity signal the report demanded.
  -- 'REAL_PROVIDER' = a real upstream provider responded and the
  --   payload passed schema validation. May be acted on as a
  --   recommendation.
  -- 'RULE_BASED_FALLBACK' = the gateway was unreachable / every
  --   provider failed / validation rejected the response. The
  --   application must NEVER present this as "real AI" — UI must
  --   label it as a rule-based fallback with confidence=0.
  status text not null check (status in ('REAL_PROVIDER','RULE_BASED_FALLBACK')),
  latency_ms integer not null,
  attempts integer not null,
  feature text not null,
  possible_duplicates jsonb not null default '[]'::jsonb,
  urgency_factors jsonb not null default '[]'::jsonb,
  raw_response text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);

create index idx_ai_analysis_issue on public.ai_analysis(issue_id, created_at desc);
create index idx_ai_analysis_college on public.ai_analysis(college_id, created_at desc);
create index idx_ai_analysis_provider on public.ai_analysis(provider, status);

-- ------------------------------------------------------------
-- save_ai_analysis — SECURITY DEFINER. Server-only call from
-- the Next.js /api/ai/* route. The route uses the service-role
-- key; the SECURITY DEFINER lets it bypass RLS to write rows
-- while still validating that the issue exists and belongs to
-- the caller's college.
-- ------------------------------------------------------------
create or replace function public.save_ai_analysis(
  p_issue_id uuid,
  p_college_id uuid,
  p_category text,
  p_priority text,
  p_severity text,
  p_summary text,
  p_reasoning text,
  p_confidence real,
  p_provider text,
  p_model text,
  p_status text,
  p_latency_ms integer,
  p_attempts integer,
  p_feature text,
  p_possible_duplicates jsonb default '[]'::jsonb,
  p_urgency_factors jsonb default '[]'::jsonb,
  p_raw_response text default null
)
returns public.ai_analysis
language plpgsql security definer set search_path = public
as $$
declare
  v_row public.ai_analysis;
  v_issue public.issues;
begin
  if p_status not in ('REAL_PROVIDER','RULE_BASED_FALLBACK') then
    raise exception 'INVALID_STATUS: must be REAL_PROVIDER or RULE_BASED_FALLBACK';
  end if;
  if char_length(coalesce(p_summary,'')) > 4000 then
    raise exception 'INVALID_SUMMARY: too long';
  end if;

  select * into v_issue from public.issues where id = p_issue_id;
  if not found then raise exception 'NOT_FOUND: issue not found'; end if;
  if v_issue.college_id <> p_college_id then
    raise exception 'FORBIDDEN: cross-college write';
  end if;

  insert into public.ai_analysis(
    issue_id, college_id, category_recommended, priority_recommended,
    severity_recommended, summary, reasoning, confidence,
    provider, model, status, latency_ms, attempts, feature,
    possible_duplicates, urgency_factors, raw_response
  ) values (
    p_issue_id, p_college_id, p_category, p_priority,
    p_severity, p_summary, p_reasoning, p_confidence,
    p_provider, p_model, p_status, p_latency_ms, p_attempts, p_feature,
    coalesce(p_possible_duplicates, '[]'::jsonb),
    coalesce(p_urgency_factors, '[]'::jsonb),
    p_raw_response
  )
  returning * into v_row;
  return v_row;
end;
$$;

-- ------------------------------------------------------------
-- latest_ai_analysis — read the freshest row for an issue.
-- Returns the full row (including status, provider, model,
-- latency, attempts, confidence, possible_duplicates).
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
-- ai_health_snapshot — used by /api/ai/health. Returns the
-- last 24 hours of provider activity so the admin settings page
-- can show the actual gateway state (replacing the hardcoded
-- "GATEWAY ACTIVE" badge).
-- ------------------------------------------------------------
create or replace function public.ai_health_snapshot()
returns jsonb
language sql stable security definer set search_path = public
as $$
  with recent as (
    select provider, status, count(*) as n,
           max(created_at) as last_at,
           avg(latency_ms)::int as avg_latency_ms
    from public.ai_analysis
    where created_at > now() - interval '24 hours'
    group by provider, status
  )
  select coalesce(jsonb_agg(row_to_json(recent)), '[]'::jsonb) from recent;
$$;

-- ------------------------------------------------------------
-- RLS: only callers who can view the parent issue can read
-- the analyses. Writes go through save_ai_analysis() only.
-- ------------------------------------------------------------
alter table public.ai_analysis enable row level security;

create policy ai_analysis_select on public.ai_analysis
  for select to authenticated
  using (public.can_view_issue(issue_id));
