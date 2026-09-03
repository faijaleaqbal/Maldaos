# AI Gateway integration

This package integrates the [`@campuspulse/ai-gateway`](../ai-gateway) into
the CampusPulse backend.

## Architecture

```
Browser (frontend, no API keys)
   │
   │  supabase-js (JWT, RLS-enforced)
   ▼
Supabase ── Edge Functions (read-only) ────────┐
   │                                          │
   │  RPC (create_issue, save_ai_analysis)    │
   ▼                                          │
Node services (campus-pulse-backend)          │
   │                                          │
   │  src/services/aiHooks.ts                 │
   │  src/services/ai.service.ts              │
   │  src/lib/aiClient.ts                     │
   ▼                                          │
AI Gateway (../ai-gateway)                    │
   │                                          │
   │  primary ──► fallback ──► deterministic  │
   ▼                                          │
Groq · OpenRouter · NVIDIA · Google AI Studio┘
```

## Files added

| Path | Purpose |
|---|---|
| `src/lib/aiClient.ts` | Singleton gateway, env-driven, enum mapping, no-throw surface. |
| `src/services/ai.service.ts` | AI run + persistence. Reads/writes `ai_analysis` via the `save_ai_analysis` / `latest_ai_analysis` RPCs. |
| `src/services/aiHooks.ts` | Fire-and-forget enrichment, non-throwing, returns null on unexpected throw. |
| `supabase/migrations/0007_ai_analysis.sql` | `ai_analysis` table, `save_ai_analysis` + `latest_ai_analysis` RPCs, RLS, optional pgvector comment. |
| `supabase/functions/ai-analyze-issue/index.ts` | Edge Function that returns the latest stored AI analysis for an issue. |
| `tests/ai-integration.test.ts` | 21 integration tests covering the sprint brief's matrix. |
| `postcss.config.cjs` | Prevents Vite from walking up to the parent repo's PostCSS config. |

## Files modified

- `package.json` — added `zod` dep.
- `tsconfig.json` — added path alias for `@campuspulse/ai-gateway`; typecheck covers both packages.
- `vitest.config.ts` — path alias + `root` + `css: false` to isolate from parent PostCSS.
- `.env.example` — added AI provider keys and gateway config.
- `src/services/issue.service.ts` — added `createIssueWithAI()` and `checkDuplicatesBeforeCreate()` (the original `createIssue()` is untouched).

## Integration points

### 1. Enrich on issue create

```ts
import { createIssueWithAI } from "./src/services/issue.service.ts";

const { issue, ai, aiUnavailable } = await createIssueWithAI(supabase, {
  title: "Loose handrail",
  description: "Stairwell B, second floor, handrail wobbles",
  category: "SAFETY",                // user-chosen
  priority: "MEDIUM",                // user-chosen
  locationId: "...",
  locationName: "Block B",
});

// issue row is created with the USER's values, never the AI's.
// ai is a RECOMMENDATION row in ai_analysis (status='ok' or 'fallback').
// aiUnavailable is true if every AI provider failed (deterministic fallback used).
```

The issue is always created. AI is a side-effect that records a
recommendation; it NEVER mutates the issue row.

### 2. Read latest AI for an issue

```ts
import { getLatestAnalysis } from "./src/services/ai.service.ts";
const ai = await getLatestAnalysis(supabase, issueId);
if (ai?.status === "fallback") showBanner("AI analysis unavailable.");
```

### 3. Admin insights / recurring patterns / risk

```ts
import { buildAdminInsights, buildRecurringPatterns, buildRiskIndicators } from "./src/services/ai.service.ts";
const insights = await buildAdminInsights(supabase, { collegeId, windowDays: 7 });
```

### 4. Edge Function (read-only)

`POST /functions/v1/ai-analyze-issue` with `{ issue_id }` and a bearer JWT.
Returns the latest persisted AI analysis for the issue (RLS-enforced).

## Failure behaviour

| Scenario | Behaviour |
|---|---|
| All providers timeout / 5xx | Gateway walks chain → ends on `deterministic` → row persisted with `status='fallback'`, `summary='AI analysis unavailable.'`, `confidence=null`. Issue row is **not** mutated. |
| Provider returns 429 | Gateway retries with exponential backoff; on exhaustion, falls through to next provider. |
| Provider returns 401/403 | Skips to next provider (non-retriable). |
| Provider returns malformed JSON | Validation rejects; gateway returns fallback record. |
| Network down | `withTimeout` enforces per-call timeout (default 15s); falls through. |
| DB persist fails | `enrichIssueWithAI` catches and returns null. Issue was already created. |

## Security

- API keys live ONLY in `process.env` on the Node backend. Never sent to the
  browser. Never logged (the structured logger redacts none yet, but the
  keys are never read by application code — only by the gateway's HTTP
  client).
- The `save_ai_analysis` RPC is `SECURITY DEFINER` and re-checks
  `can_view_issue(p_issue_id)` so cross-college writes are rejected.
- AI recommendations are persisted to `ai_analysis` but **never** applied
  to the issue row. Status changes, assignments, and resolutions are
  strictly human/admin actions driven by the existing RPCs.
- RLS on `ai_analysis` lets a user read analyses only for issues they can
  already see.

## Tests

- `npm test` in `campus-pulse-backend/` runs `tsc -p tsconfig.json` then
  `vitest run`. This includes the 21 AI integration tests in
  `tests/ai-integration.test.ts`. The RLS and E2E test files require a
  live local Supabase stack and a populated `.env`; they are skipped by
  default here.
- `npm test` in `ai-gateway/` runs the 30 unit tests (unchanged).

## Database migration

Run the new migration:

```bash
supabase db reset   # or apply supabase/migrations/0007_ai_analysis.sql manually
```

The migration is additive: it creates the `ai_analysis` table, two RPCs,
and RLS policies. It does NOT modify any existing table.

## Future pgvector duplicate detection

The current `findDuplicatesForNewIssue` reads the last N issues from
`public.issues` and asks the AI to recommend duplicates. When pgvector
is enabled:

1. `create extension if not exists vector;`
2. `alter table public.ai_analysis add column embedding vector(1536);`
3. Replace the candidate scan in `findDuplicatesForNewIssue` with a
   `select id from ai_analysis order by embedding <=> $1 limit 20`.

The AI step is unchanged: it still receives a small candidate list and
returns `{ existingIssueId, reason }` pairs — no synthetic similarity
scores.