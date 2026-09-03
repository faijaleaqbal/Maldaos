# CampusPulse — Malda College Campus Operations & AI Reporting Platform
**Hackathon 2027 Production Release**

> **Institutional Tagline**: *Estd. 1944 — Modernizing Malda College physical infrastructure operations through human-centered, AI-assisted telemetry and verified service resolution.*

---

## 🏛️ Executive Summary

CampusPulse is a production-quality campus operations and issue-reporting platform built specifically for **Malda College** (Malda, West Bengal, affiliated with University of Gour Banga, NAAC Accredited 'A' Grade).

Unlike generic AI SaaS templates, CampusPulse is designed with a **modern institutional + editorial + command center design language**:
- **Primary Colors**: Deep Maroon (`#7A1F2B`) and Dark Maroon (`#54131D`)
- **Accent Color**: Academic Gold (`#D4A72C`)
- **Base Background**: Warm Off-White (`#F8F6F1`) and Surface White (`#FFFFFF`)
- **Restrained AI Violet**: Used strictly inside automated triage badges and recommendation drawers—never as a global gimmick.

---

## 🚀 Key Feature Matrix

### 1. Student Experience
- **Immediate Clarity**: Directly answers:
  1. *What did I report?* (List of submitted tickets with live progress)
  2. *What is happening with my reports?* (Interactive lifecycle timeline tracking)
  3. *Is anything important happening around campus?* (Active hazard notices and campus highlights)
  4. *How do I report a new issue?* (Prominent 1-click CTA on both desktop and mobile bottom bar)
- **5-Step Report Workflow (`/report`)**:
  - **Step 1: Description**: Categorization, title, detailed description, safety hazard checkbox.
  - **Step 2: Evidence**: Multi-photo upload, camera simulation for mobile, verified sample evidence presets.
  - **Step 3: Location**: Interactive Leaflet campus map + building/floor/room selector.
  - **Step 4: Review**: Summary breakdown and automated submission explainer.
  - **Step 5: Confirmation**: Ticket ID generation (e.g. `MC-2027-0120`), immediate status badge, AI analysis review, and direct tracking link.
- **Campus Feed (`/issues`)**: Public issue feed with search, category filtering, status pills, and student upvoting/endorsement.
- **Issue Detail (`/issues/[id]`)**: Comprehensive ticket view with evidence gallery, Motion-animated timeline (`Reported → AI Analysis → Assigned → In Progress → Resolution Submitted → Resolved`), AI suggestion panel, and threaded discussion.

### 2. Operational Command Center (Admin / Staff Experience)
- **Executive Command Console (`/admin`)**:
  - **Campus Health Score (82 / 100)**: Measurable composite index derived from Resolution Velocity (88%), Open Issue Load (76%), Critical Safety Severity (90%), and Recurring Fault Frequency (74%). Includes explicit disclaimer as an operational indicator.
  - **Asymmetrical Operational Grid**: Prioritizes open work orders, immediate life-safety queues, and turnaround MTTR without generic 4-card SaaS layouts.
- **Issue Management Queue (`/admin/issues`)**:
  - High-density data table with sorting by Ticket ID, Priority, and Age.
  - Multi-filtering by Category, Department, Status, and Staff.
  - Instant CSV audit export.
  - Interactive slide-over `AssignmentDrawer` for 1-click staff dispatching.
- **Workforce Roster (`/admin/assignments`)**: Active duty rosters for Electrical, Civil & Plumbing, Sanitation, and IT & Network cells with active workload counters.
- **Geographic Information System (`/admin/map`)**: Full-screen Leaflet + OpenStreetMap (CartoDB Positron) canvas centered on Malda College (`25.0088°N, 88.1394°E`) with severity markers, pulsing hazard indicators, and building density rosters.
- **Quantitative Analytics (`/admin/analytics`)**: Recharts data visualizations showing 7-day velocity, category breakdown, department workload, and MTTR distribution.
- **System Insights (`/admin/insights`)**: Evidence-grounded root cause clusters (e.g. Centenary Hall AV cable degradation, Vidyasagar 2nd floor plumbing hotspot) linked to verifiable ticket IDs.
- **Governance & Settings (`/admin/settings`)**: SLA threshold adjustments, AI gateway status, and instantaneous toggle between Mock Mode and Live Supabase.

---

## 🛠️ Architecture & Tech Stack

```
campuspulse/
├── src/
│   ├── app/                    # Next.js App Router (19 verified routes)
│   │   ├── admin/             # Operational Command Center
│   │   ├── api/ai/analyze/    # Server-side AI Triage Route Handler
│   │   ├── dashboard/         # Student Dashboard
│   │   ├── issues/            # Issue Feed & [id] Detail View
│   │   ├── report/            # 5-Step Reporting Workflow
│   │   ├── login/ & register/ # Role-aware Authentication
│   │   └── profile/           # Student Profile & Settings
│   ├── components/
│   │   ├── admin/             # HealthScoreCard, AssignmentDrawer
│   │   ├── ai/                # AIAnalysisPanel (restrained, recommendation-only)
│   │   ├── analytics/         # Recharts Analytics visualizations
│   │   ├── common/            # LoadingState, EmptyState, ErrorState
│   │   ├── issues/            # IssueCard, IssueTable, StatusBadge, Timeline
│   │   ├── layout/            # Navbar, BottomNav, AdminNav, RoleSwitcher
│   │   ├── map/               # Leaflet + OpenStreetMap CampusMap
│   │   ├── reporting/         # ImageUploader, LocationPicker, ReportWorkflow
│   │   └── ui/                # Accessible primitives (Badge, Button, Card, Input)
│   ├── context/
│   │   ├── AuthContext.tsx    # Role switching & user session state
│   │   └── IssuesContext.tsx  # Global reactive issue state & notifications
│   ├── lib/
│   │   └── supabase.ts        # Supabase client wrapper & mock mode toggle
│   ├── services/
│   │   ├── ai.service.ts      # Automated triage engine & fallback handling
│   │   ├── analytics.service.ts # Health score formulas & chart metrics
│   │   ├── auth.service.ts    # Authentication & mock personas
│   │   ├── issues.service.ts  # CRUD, status progressions, upvotes
│   │   ├── mockData.ts        # Authentic Malda College campus dataset
│   │   └── notifications.service.ts # Live dispatch notifications
│   └── types/
│       └── index.ts           # Comprehensive TypeScript domain types
```

---

## 🧑‍💼 One-Click Evaluator Personas

For seamless evaluation, use the persona switcher button in the top navigation bar or the login page:

| Role | Persona Name | Department / Unit | Access Scope |
|---|---|---|---|
| **STUDENT** | Ananya Sen | Computer Science (Hons.) | Dashboard, My Reports, Report Issue, Upvoting |
| **STAFF** | Subhashish Roy | Electrical Operations | Work orders, Progress logs, Resolution submit |
| **DEPARTMENT_ADMIN** | Dr. Pradeep Mukherjee | Academic Infrastructure & IQAC | Triage, Staff dispatching, Department SLA |
| **SUPER_ADMIN** | Principal Secretariat | Malda College Administration | Full Command Center, Campus Health, Analytics |

---

## 🏃 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Development Server
```bash
npm run dev
# Or on custom port
npx next dev -p 3005
```

### 3. Production Build
```bash
npm run build
npm run start
```

### 4. Supabase Integration
To connect to live Supabase instead of the built-in mock layer:
1. Copy `.env.example` to `.env.local`
2. Set `NEXT_PUBLIC_USE_MOCK_DATA=false`
3. Fill in your `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
*(No server secrets or AI keys are ever exposed in client bundles.)*
