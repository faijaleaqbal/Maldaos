import { OpenAICompatibleProvider } from "./openai-compatible.js";
import type { ProviderName } from "../contracts/index.js";

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
    super({ ...cfg, name: "openrouter", extraHeaders: { "HTTP-Referer": "https://maldaos.local", "X-Title": "MaldaOS", ...(cfg.extraHeaders ?? {}) } });
  }
}
export class GoogleAIStudioProvider extends OpenAICompatibleProvider {
  declare readonly name: ProviderName;
  constructor(cfg: ConstructorParameters<typeof OpenAICompatibleProvider>[0]) { super({ ...cfg, name: "google" }); }
}