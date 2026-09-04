import type { AIProvider, AIRequest, AIResponse, HealthStatus, ProviderName } from "../contracts/index.js";

export const UNAVAILABLE_MESSAGE = "AI analysis unavailable.";

export class DeterministicFallbackProvider implements AIProvider {
  readonly name: ProviderName = "deterministic";
  isConfigured(): boolean { return true; }
  async health(): Promise<HealthStatus> { return "healthy"; }
  async invoke<T>(request: AIRequest): Promise<AIResponse<T>> {
    const started = Date.now();
    const text = JSON.stringify({ unavailable: true, feature: request.feature });
    return { data: text as unknown as T, raw: text, provider: this.name, model: "deterministic-v1", latencyMs: Date.now() - started, confidence: 0, validated: true, reasoning: UNAVAILABLE_MESSAGE };
  }
}