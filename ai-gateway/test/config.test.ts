import { test } from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../dist/config/index.js";

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
  assert.equal(def.providers.groq.model, "openai/gpt-oss-20b");
  assert.equal(def.providers.google.model, "gemini-3.5-flash-lite");
  assert.equal(def.providers.google.baseUrl, "https://generativelanguage.googleapis.com/v1beta/openai");
});

test("model defaults are not the decommissioned Phase-8 models", () => {
  const def = loadConfig({} as any);
  assert.notEqual(def.providers.groq.model, "llama-3.3-70b-versatile");
  assert.notEqual(def.providers.google.model, "gemini-1.5-flash");
});