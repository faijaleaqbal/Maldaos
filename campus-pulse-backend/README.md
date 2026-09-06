# MaldaOS — Backend Foundation

Campus issue-reporting platform backend: students report campus issues with
evidence, staff/departments resolve them, everything enforced at the database
level with PostgreSQL Row Level Security.

**Stack:** Supabase (Auth + Postgres + Storage) · PostgreSQL RLS · SECURITY
DEFINER RPCs · TypeScript services · Vitest.

---

## Architecture

```
                ┌──────────────────────────────────────────────┐
                │                SUPABASE (local)              │
┌──────────┐    │  ┌─────────┐  ┌───────────────────────────┐  │
│ Frontend  │───▶│  │  Auth   │─▶│  Postgres + RLS          │  │
│ (future)  │    │  └─────────┘  │   • tables (12)          │  │
└──────────┘    │  ┌─────────┐   │   • SECURITY DEFINER    │  │
                │  │ Storage │   │     RPCs (guarded paths) │  │
┌──────────┐    │  │ 2 buckets│  │   • triggers (guards)    │  │
│ Backend   │───▶│  └─────────┘  └───────────────────────────┘  │
│ services  │    │  ┌────────────────────┐                     │
│ (src/)    │    │  │ Edge Functions     │  thin JWT wrappers  │
└──────────┘    │  │ assign-issue       │  over the RPCs      │
                │  │ transition-status  │                     │
┌──────────┐    │  └────────────────────┘                     │
│ AI layer  │───▶│  (future: calls the SAME backend services; │
│ (future)  │    │   never Frontend → AI directly)            │
└──────────┘    └──────────────────────────────────────────────┘
```

**Authorization lives in the database** (RLS policies + guard triggers +
permission-checked RPCs). Application code is a thin, typed layer — even a
compromised client cannot bypass it.

## Issue lifecycle

```
OPEN → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED
                       ▲            │
                       └── reopen ──┘   (student owner ≤7 days, or staff+/admin)
CLOSED → OPEN  (SUPER_ADMIN only)
```

Enforced in `transition_issue_status()` (SQL) — including the
`RESOLVED → OPEN` reopen window and the "reason required to resolve" rule.

## Roles

| Role | Can do |
|---|---|
| STUDENT | create/vote/comment on own-college non-anonymous issues; edit own OPEN issue; reopen own RESOLVED issue (≤ 7 days) |
| STAFF | see/act on own department's issues; IN_PROGRESS/RESOLVED transitions; internal comments; upload resolution proofs |
| DEPARTMENT_ADMIN | everything staff can, + assign issues to own department/staff; dept analytics |
| SUPER_ADMIN | campus-wide: any transition (incl. CLOSE / reopen CLOSED), role changes (audited), audit log, analytics |

Anonymous issues: the student's identity never leaks — other students cannot
see the row at all (see `can_view_issue()`).

## Security model (DB-enforced)

- **RLS on every table** (12/12 user tables + 8 storage policies on 2 buckets).
- **Protected columns**: direct `UPDATE issues SET status/department_id/...`
  is blocked by the `issues_protected_columns_guard` trigger for everyone;
  only the guarded RPCs (which set `app.rpc`) may change them.
- **Assignments/status** only via `assign_issue()` / `transition_issue_status()`
  (permission + lifecycle + row-lock checked in SQL).
- **Votes**: unique(issue_id, voter_id) + idempotent `cast_vote()` + RLS blocks
  raw inserts.
- **Audit**: assignments, status changes, role changes → `audit_logs`
  (super-admin read only).
- **Files**: private buckets, path convention `{issue_id}/{uploader_id}/{name}.ext`,
  storage policies + RPC validation (ext/mime ≤5MB), RESOLUTION_PROOF = staff+.
- **Anon key**: sees nothing, can do nothing.
- Service-role key stays server-side only (`.env`, never shipped to client).

## Schema (12 tables)

`colleges, departments, locations, profiles, issues, issue_images, issue_votes,
issue_assignments, issue_status_history, issue_comments, notifications,
audit_logs` — plus enums `user_role, issue_status, issue_category, priority,
image_kind, notification_type`. See `supabase/migrations/`.

Future AI tables (`ai_analysis`, `issue_embeddings`) are intentionally NOT
created; naming/design leaves room for them (see `0001` header).

## Setup (local)

```bash
# 1. prerequisites: Docker running, Node 22+
cd campus-pulse-backend
npm install

# 2. start the local Supabase stack (first time: supabase init)
supabase start
supabase status -o env   # copy keys into .env (see .env.example)

# 3. apply migrations + seed
cp .env.example .env     # fill SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
psql "$DATABASE_URL" -f supabase/migrations/0001_schema.sql   # or loop all files:
for f in supabase/migrations/*.sql; do psql "$DATABASE_URL" -f "$f"; done
npm run seed             # auth users + demo data (idempotent)

# 4. run all tests (RLS suite + E2E journey)
npm test

```

### Test users (LOCAL TEST ONLY — password `TestPass123!`)

| Email | Role |
|---|---|
| student1@campus.test / student2@campus.test | STUDENT |
| staff.cse@ / staff.ece@ / staff.fac@campus.test | STAFF (CSE/ECE/FAC) |
| admin.cse@campus.test | DEPARTMENT_ADMIN (CSE) |
| super@campus.test | SUPER_ADMIN |

## Tests — what's covered (38 passing)

`tests/rls.test.ts` — the 12 mandated areas:
1. Student permissions (create/view anonymous/edit-OPEN rules)
2. Staff permissions (dept scoping, transitions, no assign)
3. Department admin permissions (assign own dept only)
4. Super admin permissions (close, role change, all visibility)
5. RLS bypass attempts (anon=nothing; direct UPDATE status; audit/assignment
   inserts; unauthenticated RPC)
6. Invalid transitions (OPEN→CLOSED, OPEN→RESOLVED, CLOSED→IN_PROGRESS)
7. Unauthorized assignment changes (student/staff callers, direct UPDATE)
8. Unauthorized file access (proof metadata hidden from other students; anon
   storage list empty)
9. Duplicate votes (idempotent RPC + unique constraint on raw insert)
10. Invalid issue data (short title/description, bad location)
11. Constraint failures (bad enum, NULL title, oversize/bad-type image)
12. Concurrency (10 parallel votes → 1 row; racing transitions → exactly 1 wins)

`tests/e2e.test.ts` — Definition of Done journey:
student login → create → evidence upload (real bytes to storage) → track →
dept-admin assign → staff IN_PROGRESS → resolution proof upload → RESOLVED →
super-admin CLOSE → student reopen (2nd issue) → audit log entries present →
status history ordered → notifications delivered. **PASS**

Run: `npm test` (typecheck + both suites).

## Commands

| Command | What |
|---|---|
| `npm test` | typecheck + full test suite |
| `npm run rls` / `npm run e2e` | single suite |
| `npm run seed` | (re)create demo users/data — idempotent |
| `npm run typecheck` | tsc --noEmit |
| `supabase stop` | stop local stack |

## Migrations

| File | Contents |
|---|---|
| `0001_schema.sql` | enums, 12 tables, constraints, indexes |
| `0002_helpers.sql` | current_profile/is_super_admin/can_view_issue/... |
| `0003_rpcs.sql` | create_issue, assign_issue, transition_issue_status, cast_vote, add_comment, register_issue_image, read_notification, change_profile_role, admin_stats (+ audit/notify helpers) |
| `0004_rls.sql` | RLS policies on all tables |
| `0005_storage_triggers.sql` | buckets + storage policies + guard triggers |
| `0006_auth_trigger.sql` | auth.users → profiles autocreate (role STUDENT) |

## Known limitations

- **Local-dev keys/credentials** (anon/service keys, `TestPass123!` users) are
  generated by the local stack / hardcoded for tests — regenerate for any
  real deployment.
- Profiles directory reads (names of other users) are intentionally locked
  down (anonymous-issue privacy); staff see assignee identity via
  `issue_assignments`, not via free profile browsing.
- `resolution-proofs` storage bucket is readable by any staff+ (metadata rows
  stay student-visible only for their own issue's proofs); fine-grained
  per-department storage scoping is a future hardening step.
- Multi-college: schema supports it (`college_id` everywhere), but the signup
  trigger currently defaults everyone to the first college.
- AI layer: intentionally absent. When added, it must call these same backend
  services/RPCs (Frontend → Backend → AI gateway), never the provider directly.
- Edge functions were REMOVED (dead infrastructure): the Next.js server route
  calls the guarded RPCs directly over PostgREST with the user's JWT. No
  separate Deno functions are deployed or needed.

## File map

```
campus-pulse-backend/
├── package.json / tsconfig.json / vitest.config.ts / .env.example
├── scripts/seed.ts                  # idempotent seeder
├── src/
│   ├── lib/supabaseClient.ts       # user vs service clients
│   ├── lib/errors.ts               # consistent error envelope
│   ├── lib/validation.ts            # input/file validation
│   └── services/*.service.ts        # auth, issue, assignment, status,
│                                    # comment, vote, image, notification, analytics
├── supabase/
│   ├── migrations/0001..0006_*.sql  # schema → RLS → storage → triggers
└── tests/  helpers.ts, rls.test.ts, e2e.test.ts
```
