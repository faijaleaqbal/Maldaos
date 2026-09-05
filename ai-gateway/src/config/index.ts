export interface ProviderConfig {
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface GatewayEnvConfig {
  providers: {
    groq: ProviderConfig;
    nvidia: ProviderConfig;
    openrouter: ProviderConfig;
    google: ProviderConfig;
  };
  chain: string[];
  timeoutMs: number;
  maxRetries: number;
  retryBaseMs: number;
  logLevel: "debug" | "info" | "warn" | "error";
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): GatewayEnvConfig {
  const chain = (env.AI_GATEWAY_PROVIDER_CHAIN ?? "groq,openrouter,nvidia,google,deterministic")
    .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  return {
    providers: {
      groq: { name: "groq", apiKey: env.GROQ_API_KEY ?? "", baseUrl: env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1", model: env.GROQ_MODEL ?? "openai/gpt-oss-20b" },
      nvidia: { name: "nvidia", apiKey: env.NVIDIA_API_KEY ?? "", baseUrl: env.NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1", model: env.NVIDIA_MODEL ?? "meta/llama-3.1-70b-instruct" },
      openrouter: { name: "openrouter", apiKey: env.OPENROUTER_API_KEY ?? "", baseUrl: env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1", model: env.OPENROUTER_MODEL ?? "meta-llama/llama-3.3-70b-instruct" },
      // Google AI Studio exposes an OpenAI-compatible surface at /v1beta/openai/
      // (the plain /v1beta/chat/completions path does not exist — 404).
      google: { name: "google", apiKey: env.GOOGLE_AI_STUDIO_API_KEY ?? "", baseUrl: env.GOOGLE_AI_STUDIO_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta/openai", model: env.GOOGLE_AI_STUDIO_MODEL ?? "gemini-3.5-flash-lite" },
    },
    chain,
    timeoutMs: parseInt(env.AI_GATEWAY_TIMEOUT_MS ?? "15000", 10),
    maxRetries: parseInt(env.AI_GATEWAY_MAX_RETRIES ?? "2", 10),
    retryBaseMs: parseInt(env.AI_GATEWAY_RETRY_BASE_MS ?? "300", 10),
    logLevel: (env.AI_GATEWAY_LOG_LEVEL as GatewayEnvConfig["logLevel"]) ?? "info",
  };
}