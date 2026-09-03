import { test } from "node:test";
import assert from "node:assert/strict";
import { AIGateway } from "../src/gateway.ts";
import { AIError, type AIProvider, type AIRequest, type AIResponse } from "../src/contracts/index.ts";
import { DeterministicFallbackProvider } from "../src/providers/deterministic.ts";
import * as Features from "../src/features/index.ts";

function mockGateway(behaviour: (req: AIRequest) => AIResponse | Error): AIGateway {
  const stub: AIProvider = {
    name: "groq", isConfigured: () => true,
    health: async () => "healthy",
    invoke: async <T>(req: AIRequest) => { const r = behaviour(req); if (r instanceof Error) throw r; return r as AIResponse<T>; },
  };
  const det = new DeterministicFallbackProvider();
  return new AIGateway({ providers: { groq: stub, deterministic: det } as any, chain: ["groq", "deterministic"] as any, timeoutMs: 1000, maxRetries: 0, retryBaseMs: 1 });
}
function ok(data: unknown, raw = JSON.stringify(data)) {
  return { data, raw, provider: "groq", model: "stub", latencyMs: 1, confidence: 0.8, validated: true } as AIResponse;
}

test("detectIssueCategory returns category + reasoning", async () => {
  const r = await Features.detectIssueCategory(mockGateway(() => ok({ category: "electrical", reasoning: "power outage" })), { title: "No power in lab", description: "Lights off" });
  assert.equal(r.category, "electrical"); assert.equal(r.provider, "groq");
});
test("recommendSeverity clamps invalid severity to medium", async () => {
  const r = await Features.recommendSeverity(mockGateway(() => ok({ severity: "extreme", reasoning: "yikes" })), { title: "x" });
  assert.equal(r.severity, "medium");
});
test("recommendPriority clamps invalid priority to P3", async () => {
  const r = await Features.recommendPriority(mockGateway(() => ok({ priority: "P0", reasoning: "yikes" })), { title: "x" });
  assert.equal(r.priority, "P3");
});
test("summarizeIssue returns summary text", async () => {
  const r = await Features.summarizeIssue(mockGateway(() => ok({ summary: "Leak in lab 3" })), { title: "Ceiling leak" });
  assert.equal(r.summary, "Leak in lab 3");
});
test("detectDuplicateCandidates filters unknown ids", async () => {
  const r = await Features.detectDuplicateCandidates(mockGateway(() => ok({ duplicates: [{ id: "a", reason: "same title" }, { id: "ghost", reason: "should be dropped" }] })),
    { newIssue: { title: "Leak in lab 3" }, candidates: [{ id: "a", title: "Lab 3 ceiling leak" }] });
  assert.equal(r.candidates.length, 1); assert.equal(r.candidates[0].existingIssueId, "a");
});
test("detectDuplicateCandidates returns fallback when AI fails", async () => {
  const r = await Features.detectDuplicateCandidates(mockGateway(() => new AIError({ code: "upstream", provider: "groq", message: "down", retriable: true })),
    { newIssue: { title: "x" }, candidates: [{ id: "a", title: "y" }] });
  assert.equal(r.fallback, true); assert.equal(r.candidates.length, 0);
});
test("detectRecurringPattern returns insights", async () => {
  const r = await Features.detectRecurringPattern(mockGateway(() => ok({ patterns: [{ pattern: "Wi-Fi drops in Block B", evidence: ["1", "2"] }] })),
    { recentIssues: [{ id: "1", title: "Wi-Fi drops", createdAt: "2026-09-01" }] });
  assert.equal(r.insights.length, 1); assert.equal(r.fallback, false);
});
test("adminInsights caps to 10 bullets", async () => {
  const r = await Features.adminInsights(mockGateway(() => ok({ bullets: Array.from({ length: 50 }, (_, i) => `b${i}`) })), { windowDays: 7, issues: [] });
  assert.equal(r.bullets.length, 10);
});
test("historicalRiskIndicators clamps scores 0..1", async () => {
  const r = await Features.historicalRiskIndicators(mockGateway(() => ok({ indicators: [{ label: "repeat", score: 1.7, reason: "x" }, { label: "neg", score: -0.5, reason: "y" }] })),
    { category: "electrical", location: "Block B", history: [{ id: "1", title: "x", createdAt: "2026-09-01" }] });
  assert.equal(r.indicators.length, 2);
  for (const ind of r.indicators) assert.ok(ind.score >= 0 && ind.score <= 1);
});
test("analyzeIssue validates against schema", async () => {
  const r = await Features.analyzeIssue(mockGateway(() => ok({ category: "infrastructure", severity: "high", priority: "P2", summary: "Leak", confidence: 0.9, reasoning: "Active leak" })), { title: "Ceiling leak", description: "Water everywhere" });
  assert.equal(r.fallback, false); assert.equal(r.analysis.category, "infrastructure"); assert.equal(r.analysis.severity, "high");
});
test("analyzeIssue returns fallback on validation failure", async () => {
  const r = await Features.analyzeIssue(mockGateway(() => ok({ category: "spaceship" })), { title: "x" });
  assert.equal(r.fallback, true); assert.equal(r.analysis.summary, "AI analysis unavailable.");
});
test("classifyIssueImage returns description when AI is healthy", async () => {
  const r = await Features.classifyIssueImage(mockGateway(() => ok({ category: "electrical", description: "Broken switch", confidence: 0.7 })), { imageBase64: "AAA", mimeType: "image/png" });
  assert.equal(r.category, "electrical"); assert.equal(r.description, "Broken switch");
});
test("classifyIssueImage returns fallback when AI fails", async () => {
  const r = await Features.classifyIssueImage(mockGateway(() => new AIError({ code: "upstream", provider: "groq", message: "x", retriable: true })), { imageBase64: "AAA", mimeType: "image/png" });
  assert.equal(r.description, "AI analysis unavailable.");
});