# MaldaOS — Final Integration & Production Audit Report

**Auditor:** Independent Engineering Reviewer (Cline)
**Repository:** https://github.com/faijaleaqbal/Maldaos.git
**Commit audited:** `864822e` (branch `main`, clean working tree)
**Date:** 2026-09-03

> **How findings were made:** A clean clone was inspected directly. All build/test/results
> below come from actually running the commands in a fresh environment — no prior agent
> reports were trusted.

---

## 1. COMPLETE BUILD VERIFICATION

| Check | Command | Result |
|---|---|---|
| Root deps | `npm install` | ✅ 487 packages added |
| Frontend lint | `npm run lint` (`next lint`) | ✅ No ESLint warnings or errors |
| **Frontend production build** | `npm run build` (`next build`) | ❌ **FAILS** (see below) |
| Frontend typecheck (`src/` only) | `npx tsc --noEmit` (src-restricted tsconfig) | ✅ exit 0 |
| AI Gateway build | `npm run build` (`tsc -p tsconfig.json`) | ✅ |
| AI Gateway typecheck/lint | `npm run lint` (`tsc --noEmit`) | ✅ |
| AI Gateway tests | `npm test` | ✅ **30/30 pass** |
| Backend typecheck | `npm run typecheck` | ✅ |
| Backend tests | `npm test` (typecheck + vitest) | ✅ **38/38 pass** |
| Route/API smoke | `curl http://127.0.0.1:54321` | ✅ 404 (local Supabase stack running) |

### 🔴 CRITICAL — Frontend production build FAILS

```
./ai-gateway/src/features/index.ts:2:60
Type error: An import path can only end with a '.ts' extension when 'allowImportingTsExtensions' is enabled.
```

- **Root cause:** Root `tsconfig.json` `include: ["**/*.ts"]` pulls `ai-gateway/**` and
  `campus-pulse-backend/**` into the Next.js build's type-check. Those sub-packages use
  `.ts`-suffixed import specifiers (their own tsconfig sets `allowImportingTsExtensions: true`),
  which the root config does not.
- **Provenance:** `git log` shows the "production build" commit (`a1d4dfd`) predates the
  gateway/backend commits; the current tree is broken.
- **Evidence:** `/tmp/fe_build.log` → `Next.js build worker exited with code: 1` / `EXIT=1`.

> The AI Gateway and backend themselves build + test cleanly in isolation. Only the root
> Next.js build is broken, and only by the tsconfig including the sub-packages.
---

## 2. FRONTEND ↔ BACKEND INTEGRATION — **NOT INTEGRATED**

The frontend and backend speak **incompatible contracts** and are **not connected**:

### Enum / schema mismatch (all values differ)
| Concept | Frontend (`src/types/index.ts`) | Backend (`supabase/migrations/0001_schema.sql`) |
|---|---|---|
| Status | `REPORTED, AI_ANALYZED, ASSIGNED, IN_PROGRESS, RESOLUTION_SUBMITTED, RESOLVED, CLOSED` | `OPEN, ASSIGNED, IN_PROGRESS, RESOLVED, CLOSED` |
| Category | `ELECTRICAL, PLUMBING, IT_NETWORK, FACILITY_CLASSROOM, LAB_EQUIPMENT, SANITATION, SAFETY_SECURITY, HOSTEL, OTHER` | `INFRASTRUCTURE, ACADEMICS, HOSTEL, CLEANLINESS, SAFETY, OTHER` |
| Priority | `LOW, MEDIUM, HIGH, CRITICAL` | `LOW, MEDIUM, HIGH, URGENT` |

### The frontend writes to localStorage in EVERY mode — never to the backend
- `src/services/issues.service.ts`: `createIssue`, `updateIssueStatus`, `assignIssue`,
  `addComment`, `toggleUpvote` all mutate `getLocalIssues()`/localStorage only.
- The backend's entire write path is through RPCs (`create_issue`, `assign_issue`,
  `transition_issue_status`, `add_comment`, `cast_vote`, `register_issue_image`) — none
  of which the frontend calls.

### The live read path is broken and silently falls back to mock
- `getAllIssues()` does `.from('issues').select('*, comments(*), timeline(*)')`.
- The backend has **no** `comments`/`timeline` tables (they are `issue_comments` and
  `issue_status_history`), so this query errors and the code falls through to
  `getLocalIssues()`.
- **Consequence: in "live Supabase" mode the app quietly shows mock data.**

### Result per workflow
| Workflow | Status |
|---|---|
| Authentication | ❌ no live path (hardcoded `password123` in non-mock mode) |
| Session handling | ❌ localStorage only |
| Role handling | ❌ trusts `user_metadata.role` from client |
| Issue creation / retrieval / updates | ❌ |
| Assignments | ❌ |
| Comments | ❌ |
| Voting / endorsements | ❌ |
| Status transitions | ❌ |
| Image upload / resolution proof | ❌ (no bucket upload code in FE) |
| Notifications | ❌ localStorage only |
| Analytics | ❌ fabricated (see §7) |
---

## 3. BACKEND ↔ AI GATEWAY — **NOT INTEGRATED**

- grep across all of `src/` and `campus-pulse-backend/src/` found **zero** references to
  `ai-gateway`, `createGatewayFromEnv`, `Features.analyzeIssue`, or any `AI_GATEWAY_*` env.
- `/ai-gateway/` is a **standalone** package at repo root; nothing imports it.
- The FE `/api/ai/analyze` route uses `AIService.generateDeterministicTriage()` (keyword
  heuristics), **not** the gateway.
- `campus-pulse-backend` is itself a library — there is **no HTTP server**, so the service
  layer is never invoked by the product.

### What is good about the gateway (verified)
- Provider abstraction (`Groq, NVIDIA, OpenRouter, Google AI Studio, Deterministic`).
- Request/response contracts; Zod schema validation; tolerant JSON extraction.
- Fallback chain ending in `deterministic`; 15 s timeout; exponential-backoff retry on
  retriable errors; rolling health score deprioritization.
- `RECOMMENDATION_GUARD` prompt → AI is a recommendation, never autopilot.
- **30/30 unit tests pass.**

> Backend is not coupled to one provider only because it is coupled to none. "AI failure
> does not break the workflow" holds only because the FE never gates submission on AI.

---

## 4. AI PROVIDER SECURITY

- **No production secrets in git** (history + working tree scanned).
- Git history contains only empty placeholders (`GROQ_API_KEY=`, `NVIDIA_API_KEY=`,
  `OPENROUTER_API_KEY=`, `GEMINI_API_KEY=`, `ANTHROPIC_API_KEY=`,
  `SUPABASE_SERVICE_ROLE_KEY=`).
- Local `campus-pulse-backend/.env` holds anon + **service-role** keys, but these are the
  **local dev-stack demo keys** (issuer: `supabase-demo`) and are correctly gitignored.
- Browser-facing `src/` exposes only `NEXT_PUBLIC_SUPABASE_URL` /
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` (anon, RLS-guarded). **No service-role or AI keys are
  reachable from client bundles.** ✅
- **Medium concern:** hardcoded login password `'password123'` in
  `src/services/auth.service.ts:47` (operational issue, not a leaked key).
---

## 5. SUPABASE / DATABASE SECURITY — strong backend, gaps in product reach

The SQL layer is genuinely well-hardened and **38 tests pass against a live RLS stack**:

- **SECURITY DEFINER RPCs** revalidate role + lifecycle server-side.
- **`FOR UPDATE` row-locks** serialize transitions & votes (concurrency test proves
  exactly-one-winner).
- **Guard triggers** block direct writes to protected columns outside RPCs; force
  `voter_id`/`uploaded_by` = caller.
- **RLS** on all tables; internal comments + private storage gated; students cannot read
  others' anonymous issues; `can_view_issue`, `can_vote_issue`, `is_dept_staff_of_issue`
  are correct.
- Storage buckets **private**; path-ownership + ext/MIME/size enforced in
  `register_issue_image` (≤5 MB, jpg/jpeg/png/webp).

**Tests verify:** student anonymity, dept scoping for staff, vote restrictions,
idempotent votes, invalid-transition rejection, file-upload constraints, admin-only
role/audit operations.

### Unresolved gaps
- This security is **never reached by the product** — the frontend uses localStorage, so RLS
  protects nothing in the real demo flow.
- **Frontend privacy leak:** `dashboard/page.tsx` and the map show **anonymous issues to all
  students**, contradicting the backend `can_view_issue` model.

---

## 6. ISSUE LIFECYCLE

Backend `transition_issue_status` correctly implements:

```
OPEN → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED
RESOLVED → OPEN   (owner within 7 days, or staff+, or super admin)
CLOSED   → OPEN   (super admin only)
```

- Invalid transitions raise `INVALID_TRANSITION`.
- `RESOLVED` requires a `reason`.
- Actor authorization per transition is enforced in the DB.
- Concurrency (race on identical transitions) handled via row lock — tested.

### Frontend mismatch
`AssignmentDrawer` lets staff jump from **any** state to **any** status (including
RESOLVED from REPORTED, plus a separate "Verify & Close") with **no client-side graph
validation**.
---

## 7. MOCK MODE vs LIVE MODE — **NOT isolated; production shows fake data**

- Default `.env.example` sets `NEXT_PUBLIC_USE_MOCK_DATA=true`.
- `isMockModeEnabled()` can be **overridden at runtime** by any visitor via
  `localStorage['campuspulse_force_mock']`, so mock/live can be toggled in production.
- **The live path errors and falls back to mock** (§2), so the app always ends up showing
  mock data.
- **Static MOCK leaks into production UI regardless of mode:**
  - `admin/insights/page.tsx` renders `MOCK_INSIGHTS` directly (fabricated “38% of
    plumbing reports”, “Procure 4 additional Schneider MCBs”).
  - `analytics.service.ts`: `issuesByDay` uses `Math.random()`; `avgHours` and
    `resolutionTimeDistribution` are hardcoded; `recurringFaultIndex = 74`.
  - `HealthScoreCard` hardcodes “+3.4 pts vs previous fortnight”; analytics page
    hardcodes “+4.2% vs target benchmark”.
  - `admin/settings` shows **“GATEWAY ACTIVE”** although the gateway is not wired.

**Classification of data sources:**
| Source | Class |
|---|---|
| `INITIAL_MOCK_ISSUES`, `MOCK_USERS` (auth default), `MOCK_NOTIFICATIONS` | MOCK |
| `MOCK_INSIGHTS` / `MOCK_CAMPUS_HEALTH` (health score component) | MOCK/STATIC |
| `MOCK_BUILDINGS`, `MALDA_COLLEGE_COORDINATES` | STATIC (legit reference data) |
| `Math.random()` issues-by-day, hardcoded MTTR/benchmark | FAKE (in all modes) |
| Supabase `issues`/`issue_comments`/… | REAL (but never reached by FE) |
| AI Gateway analysis | UNKNOWN (not wired into FE/BE) |

---

## 8. AI CLAIMS

- **Good:** tone is generally restrained — `AIAnalysisPanel` labels “recommendation only”,
  and the gateway prompt is a recommendation guard; no autonomous safety-critical claims.
- **Issues:**
  - The deterministic heuristic fabricates specific **confidence** values (e.g. keyword
    “fire” ⇒ 98%) presented as AI confidence.
  - `MOCK_INSIGHTS` includes `PREVENTIVE_MAINTENANCE` items with fabricated counts rendered
    as verified telemetry (“Verified by IQAC Infrastructure Governance”).

---

## 9. FILE UPLOAD SECURITY

- **Backend:** strong — ext/MIME/size (≤5 MB), path ownership `{issue}/{user}/…`, private
  buckets, kind/role checks, storage RLS.
- **Frontend:** local-only — base64 data-URL into localStorage; no server upload; type/size
  checks are client-side only (low real risk since nothing persists remotely).

---

## 10. API SECURITY

- **No server-side route guard** — `admin/layout.tsx` has no auth/role check; any visitor
  can open `/admin*` by URL.
- Edge functions `assign-issue` / `transition-status` correctly forward the caller JWT and
  act-as-user (no client-supplied role trust) — good pattern.
- **No rate limiting** anywhere; `/api/ai/analyze` is unauthenticated/limited (low risk —
  it only returns deterministic triage).
- No HTTP backend server exists, so no real CORS surface.
---

## 11. MOBILE / FRONTEND QUALITY

- **Good:** warm institutional theme, responsive grids, `BottomNav`, loading/empty/error
  states present, Leaflet guarded for `window`, no obvious hydration bugs found.
- **Issues:** admin routes unguarded; anonymous-issue privacy not honored; fixed-width
  truncation (`max-w-[200px]`) in a few feed items; `/report` success only after local write
  (no server acknowledgment).

---

## 12. PERFORMANCE

- Minor: live `getAllIssues()` over-fetches `*` + nested relations; dashboard & map re-render
  the full issue set; heavy deps (recharts, framer-motion, leaflet) acceptable for demo.
- Analytics recalculated via `useMemo` (fine).

---

## 13. DATA / DATABASE DESIGN

Backend schema is complete and sound for: `profiles, colleges, departments, locations,
issues, issue_images, issue_votes, issue_assignments, issue_status_history,
issue_comments, notifications, audit_logs` — UUIDs, FKs, checks, indexes, `updated_at`
triggers, consistent enums **within the DB**.

**Missing:** `ai_analysis` and `issue_embeddings` tables (README documents embeddings as a
future pgvector adapter; there is no `ai_analysis` table in the migrations).

**Frontend model does not match this schema at all** (§2).

---

# FINAL SCORES

> Scores reflect the product **as integrated**, not best-in-class parts in isolation.

| Category | Score |
|---|---|
| Architecture | **4/10** |
| Frontend | **4/10** |
| Backend | **8/10** |
| AI Gateway | **8/10** |
| Security | **5/10** |
| Integration | **2/10** |
| Testing | **6/10** |
| Deployment readiness | **2/10** |
| **Overall** | **39/100** |
---

## 🔴 CRITICAL BLOCKERS

1. **Frontend production build fails** — `next build` errors on
   `ai-gateway/src/features/index.ts` (TS0341, `allowImportingTsExtensions`). Root tsconfig
   includes the sub-packages. *Evidence:* `/tmp/fe_build.log`, `EXIT=1`. **Fix:** exclude
   `ai-gateway`/`campus-pulse-backend` from root tsconfig (or add the flag).
   **Owner: Grok.**
2. **Frontend ↔ Backend are not connected** — writes go to localStorage; the live read query
   (`comments(*)`, `timeline(*)`) errors and silently falls back to mock; enums fully
   incompatible. *Evidence:* `src/services/issues.service.ts`, `src/types/index.ts`,
   `0001_schema.sql`. **Owner: GLM 5.3 (backend) + Gemini (frontend).**
3. **Backend ↔ AI Gateway not wired** — no import/usage of `/ai-gateway/` anywhere;
   `/api/ai/analyze` uses local keyword heuristics. **Owner: MiniMax M3.**

---

## 🟠 HIGH PRIORITY

4. **Admin routes unguarded** — any visitor can reach `/admin*`
   (`admin/layout.tsx` has no auth check). **Owner: Gemini.**
5. **Mock/fake data shown in "live"/production mode** — `MOCK_INSIGHTS` static render,
   `Math.random()` analytics, hardcoded MTTR/trend/benchmark numbers, `admin/settings`
   “GATEWAY ACTIVE”. **Owner: Gemini.**
6. **Client-forced mock toggle** — `localStorage['campuspulse_force_mock']` can switch
   modes at runtime in prod. **Owner: Gemini.**
7. **Live auth not functional** — no password field, hardcoded `'password123'`, register
   doesn't create accounts, role from `user_metadata`. **Owner: Gemini + GLM 5.3.**
8. **Anonymous-issue privacy violated in UI** — dashboard/map show anonymous issues to all
   students, contradicting `can_view_issue`. **Owner: Gemini.**
9. **Status graph not enforced client-side** — `AssignmentDrawer` allows any→any status.
   **Owner: Gemini.**

---

## 🟡 MEDIUM

10. Heuristic confidence percentages (98% on keyword) presented as AI confidence.
    **Owner: MiniMax M3.**
11. `MOCK_INSIGHTS` fabricated preventive-maintenance claims. **Owner: Gemini.**
12. No rate limiting on `/api/ai/analyze` (add n small). **Owner: Manual / Grok.**
13. `ai_analysis` / `issue_embeddings` tables actually missing (README says future).
    **Owner: GLM 5.3.**
14. Frontend over-fetches `*`; add unit tests for FE services/pages. **Owner: Gemini.**
15. Root `.gitignore` only blocks `.env*.local` — add `.env` to prevent accidental commits.
    **Owner: Manual.**

---

## 🟢 LOW

16. Move analytics "reported/resolved by day" to real DB queries; add pagination.
    **Owner: GLM 5.3.**
17. Loading/error/empty polish where missing; mobile feed truncation. **Owner: Gemini.**
---

## ✅ VERIFIED WORKING (actually tested)

- **AI Gateway:** `npm run build` ✅, `npm run lint` (tsc) ✅, `npm test` → **30/30 pass**.
- **Backend:** `npm run typecheck` ✅, `npm test` → **38/38 pass** against a live local
  Supabase — RLS authorization (student anonymity, dept scoping, voting, file upload,
  concurrency) genuinely enforced.
- **Frontend:** `npm run lint` ✅ (no errors). `src/` alone type-checks ✅.
- **No production secrets** in git history or committed files; only anon keys in the browser
  layer.
- Supabase local stack boots; REST + Edge Function endpoints respond.

---

## ❌ NOT VERIFIED

- Frontend production build — **FAILS** (blocker).
- Any end-to-end path through the actual UI → backend DB → AI gateway — **does not exist**.
- Live Supabase mode from the running app — **cannot work** (broken query → local fallback).

---

## 🧪 TEST RESULTS (exact commands)

```
# AI Gateway
cd ai-gateway && npm install          # added 4 packages
cd ai-gateway && npm run build        # ✔ tsc -p tsconfig.json
cd ai-gateway && npm test             # # tests 30  # pass 30  # fail 0
cd ai-gateway && npm run lint         # ✔ tsc --noEmit

# Backend
cd campus-pulse-backend && npm install
cd campus-pulse-backend && npm run typecheck   # ✔ tsc --noEmit
cd campus-pulse-backend && npm test            # 2 files, 38 tests, 0 fail
                                               #  + E2E JOURNEY: PASS

# Frontend
cd /home/ubuntu/Maldaos && npm install         # added 487 packages
cd /home/ubuntu/Maldaos && npm run lint        # ✔ No ESLint warnings or errors
cd /home/ubuntu/Maldaos && npm run build       # ❌ FAILED: Type error
                                               #    ai-gateway/src/features/index.ts
                                               #    "allowImportingTsExtensions" → EXIT=1
```
---

## 🔧 FIX PLAN (summary)

| # | Problem | Severity | Evidence | Recommended fix | Owner |
|---|---|---|---|---|---|
| 1 | Root tsconfig imports sub-packages with `.ts` imports → build fails | CRITICAL | `/tmp/fe_build.log` | Exclude `ai-gateway`/`campus-pulse-backend` from root tsconfig (or add `allowImportingTsExtensions`) | Grok |
| 2 | FE writes to localStorage; live query broken (`comments(*)`,`timeline(*)`); enums incompatible | CRITICAL | `src/services/issues.service.ts`; `src/types`; `0001_schema.sql` | Align enums; call RPCs; fix live select to `issue_comments`/`issue_status_history` | GLM 5.3 + Gemini |
| 3 | AI gateway never imported by backend/FE | CRITICAL | grep across `src/` + `campus-pulse-backend/src/` | Wire `createGatewayFromEnv`/`Features.analyzeIssue` into a route/service | MiniMax M3 |
| 4 | Admin routes unguarded | HIGH | `src/app/admin/layout.tsx` | Add auth + role guard middleware/layout | Gemini |
| 5 | Mock/fake data in all modes | HIGH | `admin/insights`; `analytics.service.ts`; HealthScoreCard | Gate behind `isMockModeEnabled()`; add DEMO watermark | Gemini |
| 6 | Client-forced mock toggle | HIGH | `src/lib/supabase.ts` | Remove local override or lock via env/server | Gemini |
| 7 | Live auth non-functional; hardcoded password | HIGH | `src/services/auth.service.ts` | Real Supabase sign-in/sign-up, password field, server role lookup | Gemini + GLM 5.3 |
| 8 | Anonymous-issue privacy in UI | HIGH | `dashboard/page.tsx` | Filter `is_anonymous` unless owner/staff | Gemini |
| 9 | Status graph not enforced in FE drawer | HIGH | `AssignmentDrawer.tsx` | Restrict transitions to legal graph | Gemini |
| 10 | Heuristic confidence presented as AI | MEDIUM | `ai.service.ts` | Label as heuristic or return 0 confidence | MiniMax M3 |
| 11 | Fabricated insights | MEDIUM | `MOCK_INSIGHTS` | Only render when demo/mock mode; label clearly | Gemini |
| 12 | No rate limiting | MEDIUM | `/api/ai/analyze` | Add `@upstash/ratelimit` or middleware | Manual / Grok |
| 13 | Missing `ai_analysis`/`issue_embeddings` tables | MEDIUM | migrations | Add tables (or document as roadmap) | GLM 5.3 |
| 14 | Over-fetch + missing FE tests | MEDIUM | `issues.service.ts` | Prune select; add FE unit tests | Gemini |
| 15 | `.gitignore` doesn't block `.env` | MEDIUM | root `.gitignore` | Add `.env` / `.env*.local` | Manual |
| 16 | Hardcoded analytics trends | LOW | `analytics.service.ts` | Derive from actual DB queries | GLM 5.3 |
| 17 | Minor UX polish | LOW | several pages | Loading/error/empty states, feed truncation | Gemini |

---

## FINAL VERDICT: 🚫 **NOT READY**

**Decisive reasons:**
1. **`npm run build` fails** — the project cannot be built/deployed as committed.
2. **The three layers never connect** — the frontend (a polished localStorage demo) cannot
   talk to the backend (`campus-pulse-backend`) or the AI Gateway (`/ai-gateway/`), and the
   enum/schema contracts are mutually incompatible.
3. **Production/"live" mode silently displays fabricated data** — mock issues,
   `Math.random()` analytics, static insights, hardcoded benchmarks — with no real isolation.

**Honest nuance:** the *backend* (RLS/RPC/storage, 38 tests) and the *AI Gateway*
(30 tests) are independently excellent and correct. This is a strong **mock-mode hackathon
demo** with a production-grade database design that has never been wired to the UI. With
targeted fixes (a small tsconfig change, real API wiring, enum alignment, route guards) the
pieces are in place — but as committed it is **NOT deployment/demo production-ready**, and it
is not an integrated system today.