import { AIGateway, type GatewayOptions } from "./gateway";
import { GroqProvider, NvidiaProvider, OpenRouterProvider, GoogleAIStudioProvider } from "./providers/index";
import { DeterministicFallbackProvider } from "./providers/deterministic";
import { loadConfig } from "./config/index";
import { createConsoleLogger } from "./utils/log";
import type { AIProvider, ProviderName } from "./contracts/index";

export * from "./contracts/index";
export * from "./validation/index";
export * as Features from "./features/index";
export { AIGateway } from "./gateway";
export { loadConfig } from "./config/index";
export { createConsoleLogger } from "./utils/log";
export { DeterministicFallbackProvider, UNAVAILABLE_MESSAGE } from "./providers/deterministic";

export function createGatewayFromEnv(overrides: Partial<GatewayOptions> & { logger?: ReturnType<typeof createConsoleLogger> } = {}): AIGateway {
  const cfg = loadConfig();
  const logger = overrides.logger ?? createConsoleLogger(cfg.logLevel);
  const providers: Record<ProviderName, AIProvider> = {
    groq: new GroqProvider({ name: "groq", baseUrl: cfg.providers.groq.baseUrl, apiKey: cfg.providers.groq.apiKey, model: cfg.providers.groq.model, timeoutMs: cfg.timeoutMs, logger }),
    nvidia: new NvidiaProvider({ name: "nvidia", baseUrl: cfg.providers.nvidia.baseUrl, apiKey: cfg.providers.nvidia.apiKey, model: cfg.providers.nvidia.model, timeoutMs: cfg.timeoutMs, logger }),
    openrouter: new OpenRouterProvider({ name: "openrouter", baseUrl: cfg.providers.openrouter.baseUrl, apiKey: cfg.providers.openrouter.apiKey, model: cfg.providers.openrouter.model, timeoutMs: cfg.timeoutMs, logger }),
    google: new GoogleAIStudioProvider({ name: "google", baseUrl: cfg.providers.google.baseUrl, apiKey: cfg.providers.google.apiKey, model: cfg.providers.google.model, timeoutMs: cfg.timeoutMs, logger }),
    deterministic: new DeterministicFallbackProvider(),
  };
  return new AIGateway({ providers, chain: cfg.chain as ProviderName[], timeoutMs: cfg.timeoutMs, maxRetries: cfg.maxRetries, retryBaseMs: cfg.retryBaseMs, logger, ...overrides });
}