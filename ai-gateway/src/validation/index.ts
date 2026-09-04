import { z } from "zod";
import { AIError } from "../contracts/index.js";

export type ZodSchema = z.ZodTypeAny;

export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) return JSON.parse(fence[1].trim());
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) return JSON.parse(trimmed.slice(first, last + 1));
  throw new AIError({ code: "parse", message: "Model output did not contain JSON", retriable: false });
}

export function validate<T>(schema: ZodSchema, raw: string): T {
  let parsed: unknown;
  try { parsed = extractJson(raw); }
  catch (e) {
    if (e instanceof AIError) throw e;
    throw new AIError({ code: "parse", message: "Failed to parse model output as JSON", cause: e, retriable: false });
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new AIError({ code: "validation", message: "Model output failed schema validation", detail: { issues: result.error.issues }, retriable: false });
  }
  return result.data as T;
}

export const categoryEnum = z.enum([
  "infrastructure", "electrical", "plumbing", "cleanliness",
  "safety", "it_network", "academic", "hostel", "transport", "other",
]);
export const severityEnum = z.enum(["low", "medium", "high", "critical"]);
export const priorityEnum = z.enum(["P1", "P2", "P3", "P4"]);

export const issueAnalysisSchema = z.object({
  category: categoryEnum,
  severity: severityEnum,
  priority: priorityEnum,
  summary: z.string().min(1).max(1000),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().max(2000).optional(),
});

export type IssueAnalysis = z.infer<typeof issueAnalysisSchema>;