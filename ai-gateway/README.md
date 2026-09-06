# MaldaOS AI Gateway

Provider-agnostic AI layer for the MaldaOS issue reporting system.

**Critical rule:** AI output is ALWAYS a recommendation. The gateway never
resolves, closes, assigns, or performs any irreversible action. Even when
every AI provider fails, the issue workflow continues via a deterministic
fallback.

```
┌──────────────────┐
│  MaldaOS        │
│  backend        │
└────────┬─────────┘
         │  await gateway.send(...)   /   await Features.analyzeIssue(...)
         ▼
┌────────────────────────────────────────────────────────────┐
│                       AIGateway                            │
│  primary ──► fallback(s) ──► DeterministicFallbackProvider│
│  timeout · retry · health · rate-limit · structured errors│
└────────┬───────────────┬───────────────┬───────────────┬────┘
         ▼               ▼               ▼               ▼
       Groq          OpenRouter         NVIDIA          Google AI Studio
```

## Why a gateway?

- The product must NOT be coupled to one provider.
- A provider going down (rate limit, outage, auth rotation) must not break
  the issue workflow.
- AI output must be validated before it influences any state change.
- Provider health, retries, and timeouts must be centralized, not duplicated
  in every feature.

## Features

| # | Feature                      | Function                                  |
|---|------------------------------|-------------------------------------------|
| 1 | Issue image classification   | `Features.classifyIssueImage`             |
| 2 | Issue category detection     | `Features.detectIssueCategory`            |
| 3 | Severity recommendation      | `Features.recommendSeverity`              |
| 4 | Priority recommendation      | `Features.recommendPriority`              |
| 5 | Issue summarization          | `Features.summarizeIssue`                 |
| 6 | Duplicate detection          | `Features.detectDuplicateCandidates`      |
| 7 | Recurring issue detection    | `Features.detectRecurringPattern`         |
| 8 | Admin insights               | `Features.adminInsights`                  |
| 9 | Historical risk indicators   | `Features.historicalRiskIndicators`       |
| – | Combined analysis pipeline   | `Features.analyzeIssue`                   |

## Contracts

- `AIProvider` — pluggable interface (`isConfigured`, `health`, `invoke`).
- `AIRequest` — feature id + system + user (+ optional image, schema, options).
- `AIResponse<T>` — typed data, raw text, provider, model, latency, confidence.
- `AIError` — structured error: `code`, `provider`, `retriable`, `detail`.
- `AIGatewayResult<T>` — always defined: `data`, `provider`, `fallback`,
  `confidence`, `latencyMs`, `attempts[]`.

## Validation

Every model JSON response is parsed by `extractJson` (tolerant of code fences)
and validated against a Zod schema before being returned. Feature modules
clamp invalid enums (e.g. unknown severity → `medium`, unknown priority → `P3`)
instead of trusting the model blindly.

## Failure behavior

- Per-call timeout (`AI_GATEWAY_TIMEOUT_MS`, default 15 s).
- Exponential backoff retry on retriable errors (`timeout`, `rate_limited`,
  network errors). Non-retriable (`auth`, `bad_request`, `parse`,
  `validation`) skips retries.
- Provider chain walks in `AI_GATEWAY_PROVIDER_CHAIN` order; unconfigured
  providers are skipped.
- A rolling health score deprioritizes providers with > 50% failures after
  ≥ 3 samples.
- The chain MUST end with `deterministic` (default chain includes it).
- If every provider fails the gateway still returns
  `AIGatewayResult { provider: "deterministic", fallback: true, confidence: 0 }`.
- The deterministic provider returns a JSON-safe `{ "unavailable": true, ... }`
  payload; feature modules map it to the literal string
  `"AI analysis unavailable."`.

## Configuration

All config is environment-driven. See `.env.example`.

| Variable | Purpose |
|----------|---------|
| `GROQ_API_KEY` / `NVIDIA_API_KEY` / `OPENROUTER_API_KEY` / `GOOGLE_AI_STUDIO_API_KEY` | Backend-only API keys. NEVER expose to the frontend. |
| `GROQ_MODEL` / `NVIDIA_MODEL` / `OPENROUTER_MODEL` / `GOOGLE_AI_STUDIO_MODEL` | Per-provider model IDs. |
| `GROQ_BASE_URL` / `NVIDIA_BASE_URL` / `OPENROUTER_BASE_URL` / `GOOGLE_AI_STUDIO_BASE_URL` | Override endpoints (proxies, self-hosted). |
| `AI_GATEWAY_PROVIDER_CHAIN` | Comma-separated ordered provider list. Always include `deterministic` last. |
| `AI_GATEWAY_TIMEOUT_MS` | Per-call timeout. |
| `AI_GATEWAY_MAX_RETRIES` | Retries on retriable errors. |
| `AI_GATEWAY_RETRY_BASE_MS` | Base for exponential backoff. |
| `AI_GATEWAY_LOG_LEVEL` | `debug` / `info` / `warn` / `error`. |

## Security

- All provider API keys live ONLY on the backend (process env).
- The gateway exposes no secrets; logs never include keys.
- `.env.example` ships with placeholders only. Real `.env` is git-ignored.

## Duplicate detection (future pgvector)

The current `detectDuplicateCandidates` returns candidate pairs only — no
synthetic similarity scores are produced. The architecture anticipates a
pgvector-based pipeline:

```
issue → embed(text) → vector(top_k=20) → narrow set
                  ↓
       AIProvider.detectDuplicate(narrowed candidates)
                  ↓
       { existingIssueId, reason }   // recommendation only
```

When pgvector lands:

1. Add a `pgvector` adapter exposing `embed(text): Promise<number[]>` and
   `search(vector, topK): Promise<{id, title, description}[]>`.
2. In `detectDuplicateCandidates`, swap the `candidates` input to come
   from `pgvector.search()` instead of a SQL scan.
3. The AI step stays the same; only the candidate retrieval changes.

No code changes to callers are needed because the contract is the same.

## Installation (within the backend repo)

```bash
cd maldaos/campus-pulse-backend/ai-gateway
npm install
npm test        # 30 unit tests
npm run lint    # tsc --noEmit
```

## Tests

```bash
npm test
```

30 unit tests cover:

- JSON extraction + schema validation (`extractJson`, `validate`).
- Deterministic fallback always succeeds.
- Gateway primary routing.
- Multi-provider chain walking.
- Retry on retriable errors, no retry on non-retriable.
- Skipping unconfigured providers.
- Rolling health tracking and deprioritization.
- All 9 feature modules (happy + fallback + clamp behavior).
- Configuration loading and defaults.

## Integration-test strategy

- **Unit (this package):** Stub providers, deterministic fallback, schema
  validation, health tracking — covered above.
- **Contract tests:** Spin up the gateway with a stub provider returning
  fixture JSON, assert feature modules produce the documented shape.
- **Live integration (CI, gated, never committed):** With one provider's
  test key set, run the gateway through every feature end-to-end and assert
  the response parses and validates. The remaining keys stay empty so the
  deterministic fallback is exercised.
- **Load test:** `npm run stress` (TODO) — hit the gateway with concurrent
  requests, assert p95 latency < configured timeout and that chain
  transitions are recorded.

---

## Backend integration

```ts
// e.g. src/ai/client.ts in the backend
import { createGatewayFromEnv, Features, UNAVAILABLE_MESSAGE } from "./ai-gateway/src/index.ts";

const gateway = createGatewayFromEnv();

// On issue create:
const analysis = await Features.analyzeIssue(gateway, {
  title: issue.title,
  description: issue.description,
  location: issue.location,
});

// analysis.analysis is ALWAYS shaped:
// { category, severity, priority, summary, confidence, reasoning? }
// It is a RECOMMENDATION. The backend decides whether to apply it.
// `analysis.fallback === true` means every AI provider was unavailable;
// surface UNAVAILABLE_MESSAGE in the UI and let the admin triage manually.

await db.insertIssue({
  ...issue,
  aiCategory: analysis.analysis.category,        // recommendation, not truth
  aiSeverity: analysis.analysis.severity,
  aiPriority: analysis.analysis.priority,
  aiConfidence: analysis.analysis.confidence,
  aiProvider: analysis.provider,                 // auditability
  aiFallback: analysis.fallback,
});
```

For per-feature calls (e.g. admin insights):

```ts
const r = await Features.adminInsights(gateway, {
  windowDays: 7,
  issues: await db.recentIssues(7),
});
if (r.fallback) showBanner(UNAVAILABLE_MESSAGE);
else renderBullets(r.bullets);
```

## What the backend MUST NOT do

- Never bypass the gateway to call provider SDKs directly.
- Never auto-apply recommendations to close, resolve, or assign issues.
- Never expose AI keys via an endpoint that the frontend can hit.
- Never trust model output — the gateway already validates; do not skip it.