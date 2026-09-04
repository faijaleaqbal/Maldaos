import { test } from "node:test";
import assert from "node:assert/strict";
import { GoogleAIStudioProvider } from "../src/providers/index.ts";

test("GoogleAIStudioProvider rewrites base to /v1beta/openai", () => {
  // The provider should NOT actually make a network call; this just
  // verifies the URL is rewritten correctly before any I/O.
  const p = new GoogleAIStudioProvider({
    name: "google",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    apiKey: "fake-key-for-shape",
    model: "gemini-1.5-flash",
    timeoutMs: 1000,
  });
  // We can read the baseUrl by triggering isConfigured() and watching what
  // a stubbed fetch would be called with via invoke(); the simpler
  // assertion is that the rewrite happened by intercepting the fetch.
  // For a pure unit test, we re-create the provider and inspect its
  // internal cfg via a tiny subclass.
  class Spy extends GoogleAIStudioProvider {
    get url() { return (this as any).cfg.baseUrl as string; }
  }
  const s = new Spy({
    name: "google",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    apiKey: "k",
    model: "m",
    timeoutMs: 1000,
  });
  assert.equal(s.url, "https://generativelanguage.googleapis.com/v1beta/openai");
});

test("GoogleAIStudioProvider strips trailing slash before appending /v1beta/openai", () => {
  class Spy extends GoogleAIStudioProvider {
    get url() { return (this as any).cfg.baseUrl as string; }
  }
  const s = new Spy({
    name: "google",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/",
    apiKey: "k",
    model: "m",
    timeoutMs: 1000,
  });
  assert.equal(s.url, "https://generativelanguage.googleapis.com/v1beta/openai");
});

test("GoogleAIStudioProvider strips existing /v1beta before re-adding", () => {
  class Spy extends GoogleAIStudioProvider {
    get url() { return (this as any).cfg.baseUrl as string; }
  }
  const s = new Spy({
    name: "google",
    baseUrl: "https://generativelanguage.googleapis.com",
    apiKey: "k",
    model: "m",
    timeoutMs: 1000,
  });
  assert.equal(s.url, "https://generativelanguage.googleapis.com/v1beta/openai");
});
