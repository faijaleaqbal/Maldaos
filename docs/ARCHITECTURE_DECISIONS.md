# MaldaOS — Architecture Decision & Deployment Readiness

**Decision date:** 2026-09-04 · **Status:** LOCKED

## Architecture Decision (ADR-001): No standalone backend HTTP server

**Decision:** `campus-pulse-backend` is a **SQL/RPC/types/tests infrastructure
package** — NOT a deployable runtime service, by design.

**Rationale:** The locked MaldaOS runtime architecture is:

```
Browser ──▶ Next.js server (SSR + route handlers) ──▶ Supabase
                          │                            (Postgres + RLS +
                          ▼                             SECURITY DEFINER RPCs
                   ai-gateway (server-side import)      + private Storage)
                          ▲
             provider keys stay server-only (env)
```

- **Runtime path:** the Next.js server route (`/api/ai/analyze`) imports
  `@campuspulse/ai-gateway` (workspace `file:` dependency) server-side. All
  issue operations go browser → Supabase PostgREST/RPC with the user's JWT
  (RLS + guard triggers + permission-checked SECURITY DEFINER functions are
  the authorization layer).
- **campus-pulse-backend provides:** migrations (schema/RLS/RPCs/policies),
  TypeScript service types+mappers mirrored by the frontend, the reproducible
  test harness that proves the DB contract (60 tests + smoke), and seed data.
- **Explicitly removed:** Deno edge functions (`assign-issue`,
  `transition-status`) were dead infrastructure — nothing called them. The
  Next.js route calls the same guarded RPCs directly. Removed rather than
  maintained.
- **No service-role exposure:** the browser bundle only ever holds
  `NEXT_PUBLIC_SUPABASE_URL` + anon key. Service-role key exists only in
  backend tests/seed scripts (server-side, gitignored `.env`). The AI route
  reads provider keys via `process.env` on the server — never `NEXT_PUBLIC_*`.

**Consequence:** deployment = deploy the Next.js app (frontend + route
handlers) + provision Supabase (migrations applied via
`campus-pulse-backend`). There is no second server to deploy, monitor, or
secure. This is the minimal architecture the locked plan requires.

## Production environment guard (fail-closed)

- `NEXT_PUBLIC_USE_MOCK_DATA` must be explicitly `'true'` to enable mock mode.
- **Production (`NODE_ENV=production`) hard-blocks mock mode** — no env flag,
  no `localStorage['campuspulse_force_mock']` override can activate it
  (verified by `tests/guards.test.ts`, 5 tests).
- Missing Supabase config does NOT silently enable mock — live mode with no
  config fails closed with visible error states.
- Mock signups always clamp to STUDENT (no privileged persona via mock UI).

## CI pipeline (`.github/workflows/ci.yml`)

| Job | Scope | Steps |
|---|---|---|
| `frontend` | root app | npm ci → lint → tsc --noEmit → production build (with env stubs) → guard tests |
| `ai-gateway` | `ai-gateway/` | npm ci → build (emit) → lint → 30 unit tests |
| `backend-static` | `campus-pulse-backend/` | npm ci → typecheck (DB-free) |
| `backend-integration` | `campus-pulse-backend/` | Supabase CLI → local stack → **`test-bootstrap.sh`** (clean schema → migrations → grants → seed → 60 tests) → live-mode smoke (14 steps) |

`scripts/test-bootstrap.sh` is the **repeatable executable** backend suite:
any machine with Docker gets identical results (stack health → deterministic
reset → migrations with `ON_ERROR_STOP` → seed → vitest). Exit code non-zero
on any failure.

## Verification matrix (this sprint, actually run)

| Check | Result |
|---|---|
| Backend bootstrap full reset → suite | ✅ **60/60** (RLS 37, e2e 1, integration 15, schema 7) |
| Backend typecheck | ✅ |
| AI gateway build (ESM emit) | ✅ dist/ |
| AI gateway tests | ✅ **30/30** |
| AI gateway lint | ✅ |
| Frontend lint | ✅ |
| Frontend typecheck | ✅ |
| Frontend production build | ✅ (19 pages) |
| Frontend guard tests | ✅ **5/5** |
| Live-mode smoke (anon+JWT only) | ✅ 14/14 |

## Deploying

1. **Database:** run `supabase link` + push migrations (or run them via psql)
   from `campus-pulse-backend/supabase/migrations/0001..0007`.
2. **App:** deploy the Next.js app (Vercel or any Node host) with env:
   `SUPABASE_URL` (hosted), `SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_USE_MOCK_DATA=false`, and
   AI provider key(s) (e.g. `GROQ_API_KEY`) — server-side only.
3. **Verify:** the CI `backend-integration` job reproduces the same 60+30+5
   test gates on every PR.

## Remaining blockers (honest)

- **CI not yet proven on GitHub runners** — workflow authored and the
  integration job mirrors the locally verified bootstrap; first real PR run
  required to confirm runner-specific quirks (Docker image pulls, ports).
- **Supabase hosted storage buckets** (`issue-photos`, `resolution-proofs`)
  must be created on the hosted project — migrations create them via SQL,
  but hosted Storage needs the buckets enabled once.
- **Rate limiting on `/api/ai/analyze`** still absent (report §10.12) — low
  risk while the gateway's deterministic fallback is the default path.
- **ai-gateway provider keys** are optional by design; without them the
  route serves the labelled deterministic fallback (never mock).
- **No staging environment** — local stack is the pre-prod gate.
