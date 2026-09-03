import { test } from "node:test";
import assert from "node:assert/strict";
import { DeterministicFallbackProvider } from "../src/providers/deterministic.ts";

test("deterministic provider is always configured and healthy", async () => {
  const p = new DeterministicFallbackProvider();
  assert.equal(p.isConfigured(), true);
  assert.equal(await p.health(), "healthy");
});

test("deterministic provider returns a deterministic payload", async () => {
  const p = new DeterministicFallbackProvider();
  const r = await p.invoke({ feature: "summarize.issue", system: "s", user: "u" });
  assert.equal(r.provider, "deterministic");
  assert.equal(r.validated, true);
  assert.equal(r.confidence, 0);
  assert.match(r.raw, /"unavailable":true/);
});