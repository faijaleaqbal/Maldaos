import { OpenAICompatibleProvider } from "./openai-compatible";
import type { ProviderName } from "../contracts/index";

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
  constructor(cfg: ConstructorParameters<typeof OpenAICompatibleProvider>[0]) { super({ ...cfg, name: "google" }); }
}