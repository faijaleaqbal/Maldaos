import { AIError } from "../contracts/index.js";

export interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;
type Level = keyof typeof LEVELS;

export function createConsoleLogger(level: Level = "info"): Logger {
  const threshold = LEVELS[level];
  function log(lvl: Level, msg: string, meta?: Record<string, unknown>) {
    if (LEVELS[lvl] < threshold) return;
    const line = JSON.stringify({ ts: new Date().toISOString(), level: lvl, scope: "ai-gateway", msg, ...meta });
    if (lvl === "error" || lvl === "warn") console.error(line); else console.log(line);
  }
  return {
    debug: (m, x) => log("debug", m, x),
    info: (m, x) => log("info", m, x),
    warn: (m, x) => log("warn", m, x),
    error: (m, x) => log("error", m, x),
  };
}

export function isRetriable(err: unknown): boolean {
  if (err instanceof AIError) return err.retriable;
  if (err instanceof Error) {
    const m = err.message.toLowerCase();
    return m.includes("timeout") || m.includes("econnreset") || m.includes("etimedout") || m.includes("429") || m.includes("rate");
  }
  return false;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new AIError({ code: "timeout", message: `${label} timed out after ${ms}ms`, retriable: true })), ms);
    promise.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}