import { test } from "node:test";
import assert from "node:assert/strict";
import { AIGateway } from "../src/gateway.ts";
import { AIError, type AIProvider, type AIRequest, type AIResponse } from "../src/contracts/index.ts";
import { DeterministicFallbackProvider } from "../src/providers/deterministic.ts";

class StubProvider implements AIProvider {
  readonly name: any;
  public invocations = 0;
  public failWith?: () => Error;
  public succeedWith?: (req: AIRequest) => AIResponse;
  constructor(name: any) { this.name = name; }
  isConfigured() { return true; }
  async health(): Promise<"healthy"> { return "healthy"; }
  async invoke<T>(req: AIRequest): Promise<AIResponse<T>> {
    this.invocations++;
    if (this.failWith) throw this.failWith();
    if (this.succeedWith) return this.succeedWith(req) as AIResponse<T>;
    return { data: { ok: true, provider: this.name } as unknown as T, raw: "{}", provider: this.name, model: "stub", latencyMs: 1, confidence: 0.9, validated: true } as AIResponse<T>;
  }
}

function buildGateway(providers: Record<string, AIProvider>, chain: string[]) {
  return new AIGateway({ providers: providers as any, chain: chain as any, timeoutMs: 1000, maxRetries: 0, retryBaseMs: 1 });
}

test("gateway uses primary provider when healthy", async () => {
  const groq = new StubProvider("groq");
  const det = new DeterministicFallbackProvider();
  const gw = buildGateway({ groq, deterministic: det }, ["groq", "deterministic"]);
  const r = await gw.send({ feature: "summarize.issue", system: "s", user: "u" });
  assert.equal(r.provider, "groq"); assert.equal(r.fallback, false); assert.equal(groq.invocations, 1);
});

test("gateway falls back to deterministic when primary fails", async () => {
  const groq = new StubProvider("groq");
  groq.failWith = () => new AIError({ code: "rate_limited", provider: "groq", message: "429", retriable: true });
  const det = new DeterministicFallbackProvider();
  const gw = buildGateway({ groq, deterministic: det }, ["groq", "deterministic"]);
  const r = await gw.send({ feature: "summarize.issue", system: "s", user: "u" });
  assert.equal(r.provider, "deterministic"); assert.equal(r.fallback, true);
});

test("gateway walks chain across multiple providers", async () => {
  const groq = new StubProvider("groq"); groq.failWith = () => new AIError({ code: "upstream", provider: "groq", message: "down", retriable: true });
  const openrouter = new StubProvider("openrouter"); openrouter.failWith = () => new AIError({ code: "auth", provider: "openrouter", message: "bad key", retriable: false });
  const nvidia = new StubProvider("nvidia");
  const det = new DeterministicFallbackProvider();
  const gw = buildGateway({ groq, openrouter, nvidia, deterministic: det }, ["groq", "openrouter", "nvidia", "deterministic"]);
  const r = await gw.send({ feature: "summarize.issue", system: "s", user: "u" });
  assert.equal(r.provider, "nvidia"); assert.equal(r.attempts.length, 3);
  assert.deepEqual(r.attempts.map(a => a.provider), ["groq", "openrouter", "nvidia"]);
});

test("gateway retries on retriable errors then succeeds", async () => {
  const groq = new StubProvider("groq");
  let calls = 0;
  groq.succeedWith = () => {
    calls++;
    if (calls < 2) throw new AIError({ code: "timeout", provider: "groq", message: "slow", retriable: true });
    return { data: { ok: true }, raw: "{}", provider: "groq", model: "stub", latencyMs: 5, confidence: 0.9, validated: true };
  };
  const det = new DeterministicFallbackProvider();
  const gw = new AIGateway({ providers: { groq, deterministic: det } as any, chain: ["groq", "deterministic"] as any, timeoutMs: 1000, maxRetries: 3, retryBaseMs: 1 });
  const r = await gw.send({ feature: "summarize.issue", system: "s", user: "u" });
  assert.equal(r.provider, "groq"); assert.equal(calls, 2);
});

test("gateway does not retry non-retriable errors", async () => {
  const groq = new StubProvider("groq");
  groq.failWith = () => new AIError({ code: "auth", provider: "groq", message: "bad", retriable: false });
  const det = new DeterministicFallbackProvider();
  const gw = new AIGateway({ providers: { groq, deterministic: det } as any, chain: ["groq", "deterministic"] as any, timeoutMs: 1000, maxRetries: 3, retryBaseMs: 1 });
  const r = await gw.send({ feature: "summarize.issue", system: "s", user: "u" });
  assert.equal(r.provider, "deterministic"); assert.equal(groq.invocations, 1);
});

test("unconfigured provider is skipped", async () => {
  class Unconfigured implements AIProvider {
    readonly name = "groq" as const;
    isConfigured() { return false; }
    async health(): Promise<"unhealthy"> { return "unhealthy"; }
    async invoke<T>(): Promise<AIResponse<T>> { throw new Error("should not be called"); }
  }
  const groq = new Unconfigured();
  const det = new DeterministicFallbackProvider();
  const gw = buildGateway({ groq, deterministic: det }, ["groq", "deterministic"]);
  const r = await gw.send({ feature: "summarize.issue", system: "s", user: "u" });
  assert.equal(r.provider, "deterministic");
});

test("health tracking deprioritizes failing providers after threshold", async () => {
  const flaky = new StubProvider("groq");
  flaky.failWith = () => new AIError({ code: "upstream", provider: "groq", message: "x", retriable: true });
  const det = new DeterministicFallbackProvider();
  const gw = buildGateway({ groq: flaky, deterministic: det }, ["groq", "deterministic"]);
  for (let i = 0; i < 6; i++) await gw.send({ feature: "summarize.issue", system: "s", user: "u" });
  const snap = gw.getHealthSnapshot();
  assert.ok(snap.groq.fail >= 3); assert.ok(snap.groq.score <= 0.5);
});