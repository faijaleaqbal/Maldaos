import { AIError, type AIFeatureId, type AIGatewayResult, type AIProvider, type AIRequest, type AIResponse, type ProviderName } from "./contracts/index.ts";
import { isRetriable, sleep, type Logger } from "./utils/log.ts";

export interface GatewayOptions {
  providers: Record<ProviderName, AIProvider>;
  chain: ProviderName[];
  timeoutMs: number;
  maxRetries: number;
  retryBaseMs: number;
  logger?: Logger;
  onHealthChange?: (provider: ProviderName, ok: boolean) => void;
}

export class AIGateway {
  private readonly providers: Record<ProviderName, AIProvider>;
  private readonly chain: ProviderName[];
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseMs: number;
  private readonly logger?: Logger;
  private readonly onHealthChange?: (p: ProviderName, ok: boolean) => void;
  private readonly health: Record<string, { ok: number; fail: number; lastErr?: string }> = {};

  constructor(opts: GatewayOptions) {
    this.providers = opts.providers;
    this.chain = opts.chain.length ? opts.chain : (Object.keys(opts.providers) as ProviderName[]);
    this.timeoutMs = opts.timeoutMs;
    this.maxRetries = opts.maxRetries;
    this.retryBaseMs = opts.retryBaseMs;
    this.logger = opts.logger;
    this.onHealthChange = opts.onHealthChange;
  }

  async send<T = unknown>(request: AIRequest, opts: { feature?: AIFeatureId } = {}): Promise<AIGatewayResult<T>> {
    const attempts: AIGatewayResult<T>["attempts"] = [];
    const order = this.orderProviders();
    let lastErr: unknown = null;
    for (const name of order) {
      const provider = this.providers[name];
      if (!provider) continue;
      if (name !== "deterministic" && !provider.isConfigured()) {
        this.logger?.debug("skipping unconfigured provider", { provider: name });
        continue;
      }
      try {
        const resp = await this.invokeWithRetry(provider, request);
        attempts.push({ provider: name, ok: true, latencyMs: resp.latencyMs });
        this.recordHealth(name, true);
        return { data: resp.data as T, provider: name, model: resp.model, fallback: name === "deterministic", confidence: resp.confidence ?? 0, latencyMs: resp.latencyMs, attempts };
      } catch (e) {
        const err = e instanceof AIError ? e : new Error(String(e));
        const code = (err as AIError).code ?? "unknown";
        attempts.push({ provider: name, ok: false, errorCode: code, latencyMs: 0 });
        this.recordHealth(name, false, (err as AIError).message);
        this.logger?.warn("provider failed", { provider: name, feature: opts.feature, code, message: (err as Error).message });
        lastErr = err;
        if (name === "deterministic") break;
      }
    }
    this.logger?.error("all providers failed including deterministic", { feature: opts.feature, err: lastErr ? String((lastErr as Error).message) : null });
    throw lastErr instanceof Error ? lastErr : new Error("AI gateway failed");
  }

  private async invokeWithRetry(provider: AIProvider, request: AIRequest): Promise<AIResponse> {
    let attempt = 0;
    let lastErr: unknown = null;
    while (attempt <= this.maxRetries) {
      try { return await provider.invoke(request); }
      catch (e) {
        lastErr = e;
        const retriable = isRetriable(e);
        this.logger?.debug("provider invoke failed", { provider: provider.name, attempt, retriable, err: (e as Error).message });
        if (!retriable || attempt === this.maxRetries) break;
        await sleep(this.retryBaseMs * Math.pow(2, attempt));
        attempt++;
      }
    }
    throw lastErr;
  }

  private orderProviders(): ProviderName[] {
    const det = this.chain.includes("deterministic") ? (["deterministic"] as ProviderName[]) : [];
    const nonDet = this.chain.filter(p => p !== "deterministic");
    return [
      ...nonDet.filter(p => this.healthScore(p) > 0.5),
      ...nonDet.filter(p => this.healthScore(p) <= 0.5),
      ...det,
    ];
  }

  private healthScore(p: ProviderName): number {
    const h = this.health[p];
    if (!h) return 1;
    const total = h.ok + h.fail;
    if (total < 3) return 1;
    return h.ok / total;
  }

  private recordHealth(p: ProviderName, ok: boolean, err?: string): void {
    const prev = this.health[p] ?? { ok: 0, fail: 0 };
    const next = { ok: prev.ok + (ok ? 1 : 0), fail: prev.fail + (ok ? 0 : 1), lastErr: err };
    this.health[p] = next;
    const was = prev.ok <= prev.fail;
    const now = next.ok > next.fail;
    if (was !== now) this.onHealthChange?.(p, now);
  }

  getHealthSnapshot() {
    return Object.fromEntries(Object.entries(this.health).map(([k, v]) => [k, { ok: v.ok, fail: v.fail, lastErr: v.lastErr, score: this.healthScore(k as ProviderName) }]));
  }
}