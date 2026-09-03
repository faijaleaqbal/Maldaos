export type ProviderName =
  | "groq" | "nvidia" | "openrouter" | "google" | "deterministic";

export type AIFeatureId =
  | "classify.issue_image"
  | "classify.issue_category"
  | "recommend.severity"
  | "recommend.priority"
  | "summarize.issue"
  | "detect.duplicate"
  | "detect.recurring"
  | "insights.admin"
  | "risk.historical";

export interface ResponseSchema {
  name: string;
  jsonSchema: Record<string, unknown>;
}

export interface AIRequest {
  feature: AIFeatureId;
  system: string;
  user: string;
  responseSchema?: ResponseSchema;
  image?: { base64: string; mimeType: string };
  options?: { temperature?: number; maxTokens?: number; model?: string; timeoutMs?: number };
}

export interface AIResponse<T = unknown> {
  data: T;
  raw: string;
  provider: ProviderName;
  model: string;
  latencyMs: number;
  confidence: number | null;
  validated: boolean;
  reasoning?: string;
}

export type AIErrorCode =
  | "timeout" | "rate_limited" | "auth" | "bad_request" | "upstream"
  | "parse" | "validation" | "unavailable" | "unknown";

export class AIError extends Error {
  readonly code: AIErrorCode;
  readonly provider: ProviderName | null;
  readonly retriable: boolean;
  readonly cause?: unknown;
  readonly detail?: Record<string, unknown>;
  constructor(args: {
    code: AIErrorCode;
    message: string;
    provider?: ProviderName | null;
    retriable?: boolean;
    cause?: unknown;
    detail?: Record<string, unknown>;
  }) {
    super(args.message);
    this.name = "AIError";
    this.code = args.code;
    this.provider = args.provider ?? null;
    this.retriable = args.retriable ?? false;
    this.cause = args.cause;
    this.detail = args.detail;
  }
}

export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export interface AIProvider {
  readonly name: ProviderName;
  isConfigured(): boolean;
  health(): Promise<HealthStatus>;
  invoke<T = unknown>(request: AIRequest): Promise<AIResponse<T>>;
}

export interface AIGatewayResult<T> {
  data: T;
  provider: ProviderName;
  model: string;
  fallback: boolean;
  confidence: number;
  latencyMs: number;
  attempts: Array<{
    provider: ProviderName;
    ok: boolean;
    errorCode?: AIErrorCode;
    latencyMs: number;
  }>;
}