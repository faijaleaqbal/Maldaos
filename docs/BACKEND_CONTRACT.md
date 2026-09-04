# MaldaOS — Frontend ↔ Backend Contract

The PostgreSQL database (via Supabase) is the **single source of truth**. The frontend calls ONLY anon-key + user-session requests against PostgREST/RPCs/Storage — no service-role keys in the browser, no competing enum systems.

## Modes

| Flag | Behavior |
|---|---|
| `NEXT_PUBLIC_USE_MOCK_DATA=true` | localStorage/mock layer (demo only) |
| `NEXT_PUBLIC_USE_MOCK_DATA=false` (default) | LIVE: real Supabase; **no silent mock fallback** — failures throw typed errors, UI shows error/empty states |

Role switching (RoleSwitcherModal) is **mock-mode only**. In live mode the role comes from `profiles.role` (DB) — never from browser-supplied metadata (verified by an integration test: signup with `role: SUPER_ADMIN` in metadata still creates a STUDENT profile).

## Enums (DB truth — `supabase/migrations/0001_schema.sql`)

| Type | Values |
|---|---|
| `user_role` | STUDENT · STAFF · DEPARTMENT_ADMIN · SUPER_ADMIN |
| `issue_status` | OPEN · ASSIGNED · IN_PROGRESS · RESOLVED · CLOSED |
| `issue_category` | INFRASTRUCTURE · ACADEMICS · HOSTEL · CLEANLINESS · SAFETY · OTHER |
| `priority` | LOW · MEDIUM · HIGH · URGENT |
| `image_kind` | EVIDENCE · RESOLUTION_PROOF |
| `notification_type` | ISSUE_ASSIGNED · STATUS_CHANGED · COMMENT_ADDED · RESOLVED · REOPENED · GENERAL |

Legacy UI-state mapping (display only): `REPORTED`→OPEN, `AI_ANALYZED`→OPEN (+AI badge), `RESOLUTION_SUBMITTED`→RESOLVED. `CRITICAL`→URGENT.

## Status transition map (enforced in `transition_issue_status()`)

```
OPEN → ASSIGNED                (dept-admin/super via assign_issue)
ASSIGNED → IN_PROGRESS         (staff of assigned dept / admin)
IN_PROGRESS → RESOLVED         (staff of dept; reason REQUIRED)
RESOLVED → CLOSED              (super admin)
RESOLVED → OPEN                (student owner ≤7 days, or staff+/admin)
CLOSED → OPEN                  (super admin only)
```

Frontend renders next-status options from this map; illegal jumps surface `INVALID_TRANSITION` from the DB and are shown as errors.

## Operations

All errors use the envelope `{ error: { code, message, details? } }`.

| Operation | Call | Auth | Notes |
|---|---|---|---|
| Register | `auth.signUp({email,password, full_name})` | anon | trigger creates STUDENT profile |
| Login | `auth.signInWithPassword` → `from('profiles')` | anon | role/department from DB only |
| Create issue | `rpc('create_issue', {p_title, p_description, p_category, p_priority, p_location_id, p_department_id, p_is_anonymous})` | student | returns issue row; title 5–200, desc 10–5000 |
| List issues | `from('issues').select(locations(...), departments(...), issue_votes(count), issue_comments(...), issue_status_history(...))` | RLS | viewer sees own + non-anonymous same-college + staff dept scope |
| Update own issue | `from('issues').update({title/description})` | owner, status=OPEN | protected columns blocked by trigger |
| Assign | `rpc('assign_issue', {p_issue_id, p_department_id, p_staff_id?, p_note?})` | dept-admin of target dept / super | OPEN|ASSIGNED only; audit+notify |
| Transition | `rpc('transition_issue_status', {p_issue_id, p_new_status, p_reason?})` | per map above | row-locked; audit+history+notify |
| Comment | `rpc('add_comment', {p_issue_id, p_body, p_is_internal})` | student: visible issues, never internal; staff+: dept issues | body 1–2000 |
| Vote | `rpc('cast_vote', {p_issue_id})` | student; not own/anonymous | idempotent, single vote (no un-vote) |
| Evidence upload | `storage.from('issue-photos').upload({issueId}/{userId}/{name}.ext)` → `rpc('register_issue_image', {p_kind:'EVIDENCE', ...})` | owner student / staff+ | jpg/jpeg/png/webp, ≤5MB, path ownership enforced |
| Resolution proof | same, bucket `resolution-proofs`, kind RESOLUTION_PROOF | staff+ of assigned dept | |
| Notifications | `from('notifications')` + `rpc('read_notification')` | own rows | types per enum above |
| Admin analytics | `rpc('admin_stats')` | dept-admin (dept scope) / super (college) | by_status, by_category, avg minutes |
| Audit log | `from('audit_logs')` | super admin | entity_id filter per issue |

## Storage

Private buckets `issue-photos` and `resolution-proofs`. Path convention `{issue_id}/{uploader_id}/{filename}` — enforced by RLS policies AND `register_issue_image` (path regex + MIME + size). Client validates before upload; server re-validates.

## Known limitations / gaps

- **Coordinates**: DB `locations` has no lat/lng; campus-map coordinates remain a UI-only nicety. Location selection uses real `locations` rows (`location_id`).
- **ticketNumber**: no DB column; derived client-side deterministically from the issue row (see mappers).
- **Un-vote**: DB votes are permanent (unique constraint); UI shows "Endorsed" state and repeat casts are idempotent no-ops.
- **AI analysis** stays as the existing ai-gateway route; it is advisory and does not alter the DB lifecycle.
- Anonymous issues hide reporter identity by RLS (other students see nothing).

## Test coverage

- Backend suite: `cd campus-pulse-backend && npx vitest run` → **53 passing** (rls 37 + e2e 1 + integration 15 — frontend-path scenarios incl. anonymous privacy, role-metadata elevation attempt, image reject paths).
- Smoke (live-mode browser-equivalent): `npx tsx scripts/smoke-frontend-path.ts` → 14 PASS steps (student → create → upload → assign → in-progress → proof → resolve → close → audit/history).
