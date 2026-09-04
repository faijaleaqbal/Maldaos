import { OpenAICompatibleProvider } from "./openai-compatible.ts";
import type { ProviderName } from "../contracts/index.ts";

export class GroqProvider extends OpenAICompatibleProvider {
  declare readonly name: ProviderName;
  constructor(cfg: ConstructorParameters<typeof OpenAICompatibleProvider>[0]) { super({ ...cfg, name: "groq" }); }
}
export class NvidiaProvider extends OpenAICompatibleProvider {
  declare readonly name: ProviderName;
  constructor(cfg: ConstructorParameters<typeof OpenAICompatibleProvider>[0]) { super({ ...cfg, name: "nvidia" }); }
}
export class OpenRouterProvider extends OpenAICompatibleProvider {
  declare readonly name: ProviderName;
  constructor(cfg: ConstructorParameters<typeof OpenAICompatibleProvider>[0]) {
    super({ ...cfg, name: "openrouter", extraHeaders: { "HTTP-Referer": "https://campuspulse.local", "X-Title": "CampusPulse", ...(cfg.extraHeaders ?? {}) } });
  }
}
export class GoogleAIStudioProvider extends OpenAICompatibleProvider {
  declare readonly name: ProviderName;
  constructor(cfg: ConstructorParameters<typeof OpenAICompatibleProvider>[0]) {
    // Google AI Studio exposes an OpenAI-compatible surface at
    //   <baseUrl>/v1beta/openai/chat/completions
    // (NOT /v1beta/chat/completions, which is the native API and uses
    // a different auth scheme). We rewrite the base URL here so the
    // generic OpenAI-compatible adapter can speak to it.
    const baseUrl = (cfg.baseUrl || "https://generativelanguage.googleapis.com/v1beta")
      .replace(/\/+$/, "")
      .replace(/\/v1beta\/?$/, "") + "/v1beta/openai";
    super({ ...cfg, baseUrl, name: "google" });
  }
}