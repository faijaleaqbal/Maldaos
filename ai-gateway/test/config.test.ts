import { test } from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/config/index.ts";

test("loadConfig reads env vars and supplies defaults", () => {
  const env = { AI_GATEWAY_TIMEOUT_MS: "5000", AI_GATEWAY_MAX_RETRIES: "4", AI_GATEWAY_PROVIDER_CHAIN: "openrouter,deterministic", GROQ_MODEL: "llama-3.1-8b-instant" };
  const cfg = loadConfig(env as any);
  assert.equal(cfg.timeoutMs, 5000); assert.equal(cfg.maxRetries, 4);
  assert.deepEqual(cfg.chain, ["openrouter", "deterministic"]);
  assert.equal(cfg.providers.groq.model, "llama-3.1-8b-instant");
});

test("loadConfig defaults contain all providers + deterministic", () => {
  const def = loadConfig({} as any);
  for (const p of ["groq", "openrouter", "nvidia", "google", "deterministic"]) assert.ok(def.chain.includes(p));
  assert.equal(def.providers.groq.model, "llama-3.3-70b-versatile");
});