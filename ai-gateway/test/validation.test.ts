import { test } from "node:test";
import assert from "node:assert/strict";
import { extractJson, validate, issueAnalysisSchema } from "../dist/validation/index.js";
import { AIError } from "../dist/contracts/index.js";

test("extractJson handles plain JSON", () => { assert.deepEqual(extractJson('{"a":1}'), { a: 1 }); });
test("extractJson handles fenced JSON", () => { assert.deepEqual(extractJson('```json\n{"a":2}\n```'), { a: 2 }); });
test("extractJson throws AIError on non-JSON", () => {
  assert.throws(() => extractJson("not json"), (e: unknown) => e instanceof AIError && e.code === "parse");
});
test("validate parses and validates", () => {
  const out = validate<any>(issueAnalysisSchema, JSON.stringify({ category: "infrastructure", severity: "high", priority: "P2", summary: "Leak in lab 3 ceiling", confidence: 0.9, reasoning: "Active water damage" }));
  assert.equal(out.category, "infrastructure"); assert.equal(out.severity, "high");
});
test("validate rejects bad enum", () => {
  assert.throws(() => validate(issueAnalysisSchema, JSON.stringify({ category: "spaceship", severity: "high", priority: "P2", summary: "x", confidence: 0.5 })),
    (e: unknown) => e instanceof AIError && e.code === "validation");
});
test("validate rejects out-of-range confidence", () => {
  assert.throws(() => validate(issueAnalysisSchema, JSON.stringify({ category: "infrastructure", severity: "high", priority: "P2", summary: "x", confidence: 2 })),
    (e: unknown) => e instanceof AIError && e.code === "validation");
});