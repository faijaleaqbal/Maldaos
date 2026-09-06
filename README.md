# MaldaOS — Malda College Campus Operations & Verified Issue Resolution Platform

**Hackathon 2027 Production Release**

> **Institutional Tagline**: *Estd. 1944 — Modernizing Malda College physical infrastructure operations through human-centered, AI-assisted triage and verified service resolution.*

---

## 🏛️ Executive Summary

MaldaOS is a production-quality campus operations and issue-resolution platform built specifically for **Malda College** (Malda, West Bengal — affiliated with University of Gour Banga, NAAC Accredited 'A' Grade).

The product follows an **"Institutional Command Ledger"** design language — institutional, editorial, operational — rather than a generic AI SaaS look:
- **Primary Colors**: Deep Maroon (`#7A1F2B`) and Dark Maroon (`#54131D`)
- **Accent Color**: Academic Gold (`#D4A72C`)
- **Base Background**: Warm Off-White (`#F8F6F1`) and Surface White (`#FFFFFF`)
- **Restrained AI Violet**: Used strictly inside automated triage badges and recommendation drawers — never as a global gimmick.

MaldaOS is engineered, not merely a UI prototype: Supabase Row-Level Security and guarded RPCs enforce every write, an AI gateway provides advisory triage with a deterministic fallback, and every lifecycle action is audit-logged.

---

## 🚀 Key Feature Matrix

### 1. Student Experience
- **Immediate Clarity**: Directly answers:
  1. *What did I report?* (List of submitted tickets with live progress)
  2. *What is happening with my reports?* (Interactive lifecycle timeline tracking)
  3. *Is anything important happening around campus?* (Active hazard notices and campus highlights)
  4. *How do I report a new issue?* (Prominent 1-click CTA on both desktop and mobile bottom bar)
- **4-Step Report Workflow (`/report`)** with confirmation receipt:
  - **Step 1: Description** — Categorization, title, detailed description, safety-hazard flag (escalates priority to URGENT), anonymous reporting option.
  - **Step 2: Evidence** — Photo upload (JPEG/PNG/WebP, max 5 MB, camera capture on mobile).
  - **Step 3: Location** — Building/floor/room selection backed by the authoritative campus dataset, with 3D spatial and 2D GIS map verification.
  - **Step 4: Review** — Summary breakdown, AI advisory triage, duplicate detection against open issues.
  - **Confirmation** — Ticket reference generation (deterministic `MC-` identifier), immediate status badge, AI analysis review, and direct tracking link.
- **Campus Feed (`/issues`)**: Issue feed with search, category filtering, status pills, and student endorsement (one vote per student per issue, enforced in the database).
- **Issue Detail (`/issues/[id]`)**: Comprehensive ticket view with evidence gallery, animated lifecycle timeline (`Logged → Dispatched → In Progress → Resolved → Closed`), AI suggestion panel (advisory, always labelled), and threaded discussion with role-scoped internal notes.

### 2. Issue Lifecycle (Governed & Audited)

```
REPORT → AI ANALYSIS (advisory) → ASSIGNED → IN PROGRESS → RESOLUTION SUBMITTED → VERIFIED / RESOLVED → CLOSED
```

Database-enforced transition rules (`transition_issue_status` / `assign_issue` RPCs):
- **OPEN → ASSIGNED**: Department admin (own department only) or super admin.
- **ASSIGNED → IN_PROGRESS**: Assigned department staff/admin.
- **IN_PROGRESS → RESOLVED**: Assigned staff; resolution summary mandatory; resolution-proof photo upload supported.
- **RESOLVED → OPEN (reopen)**: Reporting student within a 7-day window, assigned staff/admin, or super admin.
- **RESOLVED → CLOSED / CLOSED → OPEN**: Super admin only.

Students cannot see other students' anonymous issues; staff/admins see work orders only for their assigned department; every mutation writes to `audit_logs` (super-admin visible at `/admin/audit`).

### 3. Operational Command Center (Admin / Staff Experience)
- **Executive Command Console (`/admin`)**: Campus Health Score computed live from database records (resolution velocity, open-issue load, critical severity, recurring-fault index) with an explicit operational-indicator disclaimer — never a hardcoded marketing number.
- **Issue Management Queue (`/admin/issues`)**: High-density data table, sorting, multi-filtering (category, department, status, staff), CSV audit export, and slide-over `AssignmentDrawer` for staff dispatching.
- **Workforce Roster (`/admin/assignments`)**: Active duty rosters per department cell with workload counters and contact details.
- **Geographic Information System (`/admin/map`)**: Campus map with 3D spatial twin and 2D Leaflet + OpenStreetMap (CARTO) modes, centered on Malda College (`25.0018°N, 88.1366°E` per the authoritative campus dataset), with severity beacons and building density.
- **Quantitative Analytics (`/admin/analytics`)**: Recharts visualizations for 7-day velocity, category breakdown, department workload, and resolution-time distribution — computed from real records.
- **System Insights (`/admin/insights`)**: Evidence-grounded root-cause clusters linked to verifiable ticket references.
- **Audit Trail (`/admin/audit`)**: Super-admin view of every role change, assignment, and status transition.
- **Governance & Settings (`/admin/settings`)**: AI gateway status and mode information. Live/Supabase mode is the production default; the mock layer is a dev-only, fail-closed demo facility.

### 4. 3D Campus Experience
- **Landing hero (`/`)**: Scroll-driven WebGL campus tour (Three.js) across the college's academic bhavans, with graceful fallback when WebGL is unavailable and reduced-motion support.
- **3D spatial map (`/map`, `/admin/map`)**: Interactive digital-twin of campus buildings with issue beacons, building inspector, and camera presets; DPR capped, resources disposed on unmount.
- 3D remains an enhancement to the institutional product — secondary to product information.

---

## 🛠️ Architecture & Tech Stack

```
maldaos/
 ├── src/                          # Next.js 14 App Router (frontend + route handlers)
 │   ├── app/                      # 21 verified routes (see Route Map below)
 │   │   ├── admin/                # Operational Command Center (8 pages)
 │   │   ├── api/ai/analyze/       # Server-side AI triage route (server-only keys)
 │   │   ├── dashboard/ issues/ report/ profile/ map/ login/ register/
 │   ├── components/
 │   │   ├── 3d/                  # CampusHeroScene, CampusSpatialMap, WebGL safety
 │   │   ├── admin/ ai/ analytics/ common/ issues/ layout/ map/ reporting/ ui/
 │   ├── context/                  # AuthContext, IssuesContext
 │   ├── lib/                      # backendTypes (DB contract), security, supabase clients,
 │   │   │                         # adminTransitions (UI mirror of DB rules)
 │   ├── middleware.ts             # Server-side /admin/* gate (session + DB role)
 │   └── services/                 # issues, auth, analytics, AI, notifications
 ├── ai-gateway/                   # Provider-agnostic AI gateway package (Groq → OpenRouter
 │   │                             # → NVIDIA → Google → deterministic fallback chain)
 ├── campus-pulse-backend/         # Backend infra package: SQL schema, RLS, RPCs, tests,
 │   │                             # local Supabase stack + seed (legacy directory name)
 ├── ci/workflows/ci.yml           # CI: lint, typecheck, build, guards, gateway tests,
 │                                 # backend migrations + RLS tests on ephemeral Supabase
 └── tests/                        # Vitest: 158 frontend tests (guards, journeys, admin ops)
```

**Route Map (actual)**: `/`, `/login`, `/register`, `/dashboard`, `/issues`, `/issues/[id]`, `/report`, `/profile`, `/map`, `/admin`, `/admin/issues`, `/admin/assignments`, `/admin/map`, `/admin/analytics`, `/admin/insights`, `/admin/audit`, `/admin/settings`, `/api/ai/analyze`.

**Key safety properties**:
- **Fail-closed mock mode** — the mock/demo layer can never activate in a production build, regardless of env flags or client-side tampering (verified by `tests/guards.test.ts` and CI).
- **Roles come from the database** (`profiles.role`), never from browser metadata; seeded demo logins are hard-blocked in production and eliminated from the client bundle at build time.
- **All privileged writes flow through SECURITY DEFINER RPCs** with audit logging; direct table mutations are blocked by guard triggers.
- **Storage is private** — evidence and resolution proofs are served via short-lived signed URLs only.

---

## 🤖 AI-Assisted Triage (Advisory by Design)

- The `/api/ai/analyze` route calls the server-side **ai-gateway** package: a provider chain (Groq → OpenRouter → NVIDIA → Google AI Studio → deterministic rule-based fallback) with retries, timeouts, and health tracking.
- Provider keys are **server-only** — never prefixed `NEXT_PUBLIC_`, never bundled to the client.
- AI output is **advisory**: category, severity, priority, summary, and confidence are recommendations a human operator may accept or reject. The deterministic fallback is always labelled (`isFallback: true`, `confidence: 0`) and never claims to be a model response.
- If no provider is configured or all providers fail, the core issue workflow (report → assign → resolve → verify) is fully preserved. No AI claim of infallibility is made anywhere in the product.

---

## 🧑‍💼 Evaluation Personas (Development / Local Demo Only)

On a local dev stack (never in production builds), the persona switcher in the top navigation or login page signs in as real seeded Supabase accounts; the resulting role is whatever `profiles.role` says in the database:

| Role | Persona | Access Scope |
|---|---|---|
| **STUDENT** | Aarav Student (CSE) | Dashboard, My Reports, Report Issue, Endorsing |
| **STAFF** | Ravi Staff (CSE Maintenance) | Work orders, progress logs, resolution submit |
| **DEPARTMENT_ADMIN** | Dr. Sen (Dept Admin CSE) | Triage, staff dispatching, department scope |
| **SUPER_ADMIN** | Principal Super | Full Command Center, analytics, audit trail |

These accounts exist only on the local Supabase stack (`campus-pulse-backend/scripts/seed.ts`) and are unusable in production (runtime guard + build-time elimination, both covered by tests).

---

## 🏃 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Local Supabase Stack (recommended for full evaluation)
```bash
cd campus-pulse-backend
# start the local Supabase stack, apply migrations, run backend tests:
./scripts/test-bootstrap.sh
npm run seed   # seeds demo accounts + campus locations (local test fixture only)
```

### 3. Run Development Server
```bash
npm run dev
# Or on a custom port
npx next dev -p 3005
```
For the offline demo layer (no database), set `NEXT_PUBLIC_USE_MOCK_DATA=true`. This flag is inert in production builds (fail-closed).

### 4. Production Build
```bash
npm run build
npm run start
```

### 5. Supabase Configuration
1. Copy `.env.example` to `.env` (or `.env.production.example` to `.env.production`).
2. Set `NEXT_PUBLIC_USE_MOCK_DATA=false`.
3. Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (browser-safe publishable values only).
4. Optional AI providers: server-side keys (`GROQ_API_KEY`, `GOOGLE_AI_STUDIO_API_KEY`, `NVIDIA_API_KEY`, `OPENROUTER_API_KEY`) are read only by the `/api/ai/analyze` route handler.
*(No server secrets or AI keys are ever exposed in client bundles — verified by CI and the guard test suite.)*

---

## ✅ Testing & Verification

```bash
npm run lint        # ESLint — 0 warnings/errors
npm test            # Vitest — 158 frontend tests (guards, student journey, admin ops, runtime, accessibility)
npx tsc --noEmit    # TypeScript — 0 errors
npm run build       # Next.js production build — 21 routes
cd ai-gateway && npm test   # 33 gateway tests (config, providers, validation, features)
cd campus-pulse-backend && ./scripts/test-bootstrap.sh  # migrations + RLS/RPC integration tests
```

CI (`ci/workflows/ci.yml`) runs the full matrix on every push/PR: frontend lint+typecheck+build+guards, ai-gateway build+tests, and backend migrations/RLS/RPC tests against an ephemeral Supabase stack.

Accessibility: WCAG-oriented verification passed for tested flows (keyboard navigation, visible focus states, semantic labels, form errors, loading/empty/error states, reduced-motion support, ≥44px touch targets). Responsive QA verified at 320px–1440px viewports with no horizontal overflow.

Verified within the executed production test scope; no absolute reliability claims are made.

---

## 📚 Documentation

- `docs/ARCHITECTURE_DECISIONS.md`, `docs/BACKEND_CONTRACT.md` — engineering decisions and the DB contract.
- `3D_VISUAL_QA_REPORT.md`, `FINAL_3D_UI_CONTROL_QA.md`, `finalreport.md` — substantive visual/3D/control QA history (preserved).
- `ai-gateway/README.md` — AI gateway package internals.
- `campus-pulse-backend/README.md` — backend infra package (legacy directory name).
