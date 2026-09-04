import type { AIProvider, AIRequest, AIResponse, HealthStatus, ProviderName } from "../contracts/index";
import { AIError } from "../contracts/index";
import { withTimeout, type Logger } from "../utils/log";

export interface OpenAICompatibleConfig {
  name: ProviderName;
  baseUrl: string;
  apiKey: string;
  model: string;
  extraHeaders?: Record<string, string>;
  timeoutMs: number;
  logger?: Logger;
}

/** Base adapter for OpenAI-compatible chat completion APIs. */
export class OpenAICompatibleProvider implements AIProvider {
  readonly name: ProviderName;
  protected readonly cfg: OpenAICompatibleConfig;
  protected readonly logger?: Logger;
  constructor(cfg: OpenAICompatibleConfig) {
    this.cfg = cfg;
    this.name = cfg.name;
    this.logger = cfg.logger;
  }
  isConfigured(): boolean { return Boolean(this.cfg.apiKey && this.cfg.baseUrl && this.cfg.model); }

  async health(): Promise<HealthStatus> {
    if (!this.isConfigured()) return "unhealthy";
    try {
      const res = await withTimeout(
        this.invokeRaw({ model: this.cfg.model, messages: [{ role: "user", content: "ping" }], max_tokens: 1, temperature: 0 }),
        Math.min(5000, this.cfg.timeoutMs),
        `${this.name}.health`,
      );
      return res.ok ? "healthy" : "degraded";
    } catch (e) {
      this.logger?.debug("health probe failed", { provider: this.name, err: String(e) });
      return "unhealthy";
    }
  }

  async invoke<T = unknown>(request: AIRequest): Promise<AIResponse<T>> {
    if (!this.isConfigured()) {
      throw new AIError({ code: "unavailable", provider: this.name, message: `Provider ${this.name} is not configured (missing API key)`, retriable: false });
    }
    const started = Date.now();
    const timeoutMs = request.options?.timeoutMs ?? this.cfg.timeoutMs;
    const model = request.options?.model ?? this.cfg.model;

    const messages: Array<Record<string, unknown>> = [];
    if (request.image) {
      messages.push({ role: "system", content: request.system });
      messages.push({ role: "user", content: [
        { type: "text", text: request.user },
        { type: "image_url", image_url: { url: `data:${request.image.mimeType};base64,${request.image.base64}` } },
      ]});
    } else {
      messages.push({ role: "system", content: request.system });
      messages.push({ role: "user", content: request.user });
    }

    const body: Record<string, unknown> = {
      model, messages,
      temperature: request.options?.temperature ?? 0.2,
      max_tokens: request.options?.maxTokens ?? 1024,
      response_format: request.responseSchema ? { type: "json_object" } : undefined,
    };

    try {
      const raw = await withTimeout(this.invokeRaw(body), timeoutMs, `${this.name}.invoke`);
      const content = raw.content ?? "";
      return { data: content as unknown as T, raw: content, provider: this.name, model, latencyMs: Date.now() - started, confidence: null, validated: false };
    } catch (e) {
      if (e instanceof AIError) throw e;
      throw new AIError({ code: "upstream", provider: this.name, message: `Provider ${this.name} failed: ${(e as Error).message}`, cause: e, retriable: true });
    }
  }

  private async invokeRaw(body: Record<string, unknown>): Promise<{ ok: boolean; content: string }> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.cfg.apiKey}`,
      ...this.cfg.extraHeaders,
    };
    let resp: Response;
    try {
      resp = await fetch(`${this.cfg.baseUrl}/chat/completions`, { method: "POST", headers, body: JSON.stringify(body) });
    } catch (e) {
      throw new AIError({ code: "upstream", provider: this.name, message: `Network error contacting ${this.name}`, cause: e, retriable: true });
    }
    if (resp.status === 401 || resp.status === 403) {
      throw new AIError({ code: "auth", provider: this.name, message: `Authentication failed for ${this.name}`, retriable: false, detail: { status: resp.status } });
    }
    if (resp.status === 429) {
      throw new AIError({ code: "rate_limited", provider: this.name, message: `Rate limited by ${this.name}`, retriable: true, detail: { status: resp.status } });
    }
    if (resp.status === 408 || resp.status === 504) {
      throw new AIError({ code: "timeout", provider: this.name, message: `Upstream timeout from ${this.name}`, retriable: true, detail: { status: resp.status } });
    }
    if (resp.status >= 400) {
      const text = await resp.text().catch(() => "");
      throw new AIError({ code: resp.status >= 500 ? "upstream" : "bad_request", provider: this.name, message: `${this.name} returned ${resp.status}`, retriable: resp.status >= 500, detail: { status: resp.status, body: text.slice(0, 500) } });
    }
    const json = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content ?? "";
    return { ok: true, content };
  }
}