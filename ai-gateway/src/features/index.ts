import type { AIGateway } from "../gateway";
import { AIError, type AIRequest, type ProviderName } from "../contracts/index";
import { categoryEnum, issueAnalysisSchema, priorityEnum, severityEnum, validate, type IssueAnalysis } from "../validation/index";

const RECOMMENDATION_GUARD = `
You are an assistant for a campus issue reporting system. You NEVER resolve,
close, or assign irreversible actions. Your output is always a recommendation
that a human may accept or reject.

Return ONLY valid JSON matching the requested schema. Do not include commentary
outside the JSON.
`.trim();

interface IssueInput {
  title: string;
  description?: string;
  location?: string;
  reporterRole?: string;
}

const FALLBACK_SUMMARY = "AI analysis unavailable.";

export async function classifyIssueImage(
  gateway: AIGateway,
  args: { imageBase64: string; mimeType: string; caption?: string },
): Promise<{ category: string; description: string; confidence: number; provider: ProviderName }> {
  const req: AIRequest = {
    feature: "classify.issue_image",
    system: RECOMMENDATION_GUARD + "\nClassify the campus issue shown in the image. Choose a category from: " + [...categoryEnum.options].join(", ") + ".",
    user: `Caption (may be empty): ${args.caption ?? ""}\nReturn JSON: { "category": string, "description": string, "confidence": number 0..1, "reasoning": string }`,
    image: { base64: args.imageBase64, mimeType: args.mimeType },
    options: { temperature: 0.2, maxTokens: 600 },
  };
  const r = await gateway.send<{ category: string; description: string; confidence: number; reasoning?: string }>(req, { feature: "classify.issue_image" });
  if (r.fallback) return { category: "other", description: FALLBACK_SUMMARY, confidence: 0, provider: r.provider };
  return { category: r.data?.category ?? "other", description: r.data?.description ?? FALLBACK_SUMMARY, confidence: r.data?.confidence ?? 0, provider: r.provider };
}

export async function detectIssueCategory(gateway: AIGateway, issue: IssueInput): Promise<{ category: string; reasoning: string; provider: ProviderName }> {
  const req: AIRequest = {
    feature: "classify.issue_category",
    system: RECOMMENDATION_GUARD + "\nClassify the following campus issue into ONE category from: " + [...categoryEnum.options].join(", ") + ".",
    user: renderIssue(issue) + `\nReturn JSON: { "category": string, "reasoning": string }`,
    options: { temperature: 0.2, maxTokens: 200 },
  };
  const r = await gateway.send<{ category: string; reasoning: string }>(req, { feature: "classify.issue_category" });
  if (r.fallback) return { category: "other", reasoning: FALLBACK_SUMMARY, provider: r.provider };
  const cat = (r.data?.category as string) ?? "other";
  return { category: categoryEnum.safeParse(cat).success ? cat : "other", reasoning: r.data?.reasoning ?? "", provider: r.provider };
}

export async function recommendSeverity(gateway: AIGateway, issue: IssueInput): Promise<{ severity: "low" | "medium" | "high" | "critical"; reasoning: string; provider: ProviderName }> {
  const req: AIRequest = {
    feature: "recommend.severity",
    system: RECOMMENDATION_GUARD + "\nRecommend a severity for the issue from: low, medium, high, critical.",
    user: renderIssue(issue) + `\nReturn JSON: { "severity": string, "reasoning": string }`,
    options: { temperature: 0.2, maxTokens: 200 },
  };
  const r = await gateway.send<{ severity: string; reasoning: string }>(req, { feature: "recommend.severity" });
  if (r.fallback) return { severity: "medium", reasoning: FALLBACK_SUMMARY, provider: r.provider };
  const sev = (r.data?.severity ?? "medium") as "low" | "medium" | "high" | "critical";
  return { severity: severityEnum.safeParse(sev).success ? sev : "medium", reasoning: r.data?.reasoning ?? "", provider: r.provider };
}

export async function recommendPriority(gateway: AIGateway, issue: IssueInput & { severity?: string }): Promise<{ priority: "P1" | "P2" | "P3" | "P4"; reasoning: string; provider: ProviderName }> {
  const req: AIRequest = {
    feature: "recommend.priority",
    system: RECOMMENDATION_GUARD + "\nRecommend a priority from: P1 (highest), P2, P3, P4 (lowest).",
    user: renderIssue(issue) + (issue.severity ? `\nSeverity hint: ${issue.severity}` : "") + `\nReturn JSON: { "priority": "P1"|"P2"|"P3"|"P4", "reasoning": string }`,
    options: { temperature: 0.2, maxTokens: 200 },
  };
  const r = await gateway.send<{ priority: string; reasoning: string }>(req, { feature: "recommend.priority" });
  if (r.fallback) return { priority: "P3", reasoning: FALLBACK_SUMMARY, provider: r.provider };
  const p = r.data?.priority ?? "P3";
  return { priority: priorityEnum.safeParse(p).success ? (p as "P1" | "P2" | "P3" | "P4") : "P3", reasoning: r.data?.reasoning ?? "", provider: r.provider };
}

export async function summarizeIssue(gateway: AIGateway, issue: IssueInput): Promise<{ summary: string; provider: ProviderName }> {
  const req: AIRequest = {
    feature: "summarize.issue",
    system: RECOMMENDATION_GUARD + "\nSummarize the issue in 1-2 sentences, factual and concise.",
    user: renderIssue(issue) + `\nReturn JSON: { "summary": string }`,
    options: { temperature: 0.2, maxTokens: 200 },
  };
  const r = await gateway.send<{ summary: string }>(req, { feature: "summarize.issue" });
  if (r.fallback) return { summary: FALLBACK_SUMMARY, provider: r.provider };
  return { summary: r.data?.summary ?? issue.title, provider: r.provider };
}

export interface DuplicateCandidate { existingIssueId: string; reason: string; }
export async function detectDuplicateCandidates(gateway: AIGateway, args: { newIssue: IssueInput; candidates: Array<{ id: string; title: string; description?: string }> }): Promise<{ candidates: DuplicateCandidate[]; provider: ProviderName; fallback: boolean }> {
  if (args.candidates.length === 0) return { candidates: [], provider: "deterministic", fallback: true };
  const req: AIRequest = {
    feature: "detect.duplicate",
    system: RECOMMENDATION_GUARD + "\nIdentify which of the listed existing issues are likely duplicates of the new issue.",
    user: `NEW ISSUE:\n${renderIssue(args.newIssue)}\n\nCANDIDATES:\n${args.candidates.map((c, i) => `[${i}] id=${c.id} title="${c.title}" desc="${c.description ?? ""}"`).join("\n")}\n\nReturn JSON: { "duplicates": [{ "id": string, "reason": string }] }. Only include candidates that are clearly duplicates.`,
    options: { temperature: 0.1, maxTokens: 400 },
  };
  const r = await gateway.send<{ duplicates: Array<{ id: string; reason: string }> }>(req, { feature: "detect.duplicate" });
  if (r.fallback) return { candidates: [], provider: r.provider, fallback: true };
  const ids = new Set(args.candidates.map(c => c.id));
  return { candidates: (r.data?.duplicates ?? []).filter(d => ids.has(d.id)).map(d => ({ existingIssueId: d.id, reason: d.reason ?? "" })), provider: r.provider, fallback: false };
}

export interface RecurringInsight { pattern: string; evidence: string[]; }
export async function detectRecurringPattern(gateway: AIGateway, args: { recentIssues: Array<{ id: string; title: string; category?: string; createdAt: string }> }): Promise<{ insights: RecurringInsight[]; provider: ProviderName; fallback: boolean }> {
  if (args.recentIssues.length === 0) return { insights: [], provider: "deterministic", fallback: true };
  const req: AIRequest = {
    feature: "detect.recurring",
    system: RECOMMENDATION_GUARD + "\nIdentify any recurring patterns across the recent issues.",
    user: `RECENT ISSUES:\n${args.recentIssues.map(i => `- ${i.id} [${i.createdAt}] (${i.category ?? "?"}): ${i.title}`).join("\n")}\n\nReturn JSON: { "patterns": [{ "pattern": string, "evidence": string[] (issue ids) }] }.`,
    options: { temperature: 0.2, maxTokens: 500 },
  };
  const r = await gateway.send<{ patterns: RecurringInsight[] }>(req, { feature: "detect.recurring" });
  if (r.fallback) return { insights: [], provider: r.provider, fallback: true };
  return { insights: r.data?.patterns ?? [], provider: r.provider, fallback: false };
}

export async function adminInsights(gateway: AIGateway, args: { windowDays: number; issues: Array<{ id: string; title: string; category?: string; status: string; createdAt: string }> }): Promise<{ bullets: string[]; provider: ProviderName; fallback: boolean }> {
  const req: AIRequest = {
    feature: "insights.admin",
    system: RECOMMENDATION_GUARD + "\nProduce 3-6 short insight bullets for campus admins.",
    user: `Window: last ${args.windowDays} days\nIssues (${args.issues.length}):\n${args.issues.slice(0, 200).map(i => `- ${i.id} [${i.createdAt}] (${i.category ?? "?"}, ${i.status}): ${i.title}`).join("\n")}\n\nReturn JSON: { "bullets": string[] }`,
    options: { temperature: 0.3, maxTokens: 600 },
  };
  const r = await gateway.send<{ bullets: string[] }>(req, { feature: "insights.admin" });
  if (r.fallback) return { bullets: [FALLBACK_SUMMARY], provider: r.provider, fallback: true };
  return { bullets: (r.data?.bullets ?? []).slice(0, 10), provider: r.provider, fallback: false };
}

export interface RiskIndicator { label: string; score: number; reason: string; }
export async function historicalRiskIndicators(gateway: AIGateway, args: { category?: string; location?: string; history: Array<{ id: string; title: string; category?: string; location?: string; severity?: string; createdAt: string }> }): Promise<{ indicators: RiskIndicator[]; provider: ProviderName; fallback: boolean }> {
  if (args.history.length === 0) return { indicators: [], provider: "deterministic", fallback: true };
  const req: AIRequest = {
    feature: "risk.historical",
    system: RECOMMENDATION_GUARD + "\nIdentify historical risk indicators for this kind of issue.",
    user: `New issue category: ${args.category ?? "unknown"}\nLocation: ${args.location ?? "unknown"}\n\nHistorical issues:\n${args.history.slice(0, 200).map(i => `- ${i.id} [${i.createdAt}] (${i.category ?? "?"}, ${i.severity ?? "?"}) @ ${i.location ?? "?"}: ${i.title}`).join("\n")}\n\nReturn JSON: { "indicators": [{ "label": string, "score": number 0..1, "reason": string }] }.`,
    options: { temperature: 0.2, maxTokens: 500 },
  };
  const r = await gateway.send<{ indicators: RiskIndicator[] }>(req, { feature: "risk.historical" });
  if (r.fallback) return { indicators: [], provider: r.provider, fallback: true };
  return { indicators: (r.data?.indicators ?? []).map(i => ({ label: i.label, score: Math.max(0, Math.min(1, Number(i.score) || 0)), reason: i.reason ?? "" })), provider: r.provider, fallback: false };
}

export async function analyzeIssue(gateway: AIGateway, issue: IssueInput): Promise<{ analysis: IssueAnalysis; provider: ProviderName; fallback: boolean }> {
  const fallbackAnalysis: IssueAnalysis = { category: "other", severity: "medium", priority: "P3", summary: FALLBACK_SUMMARY, confidence: 0, reasoning: FALLBACK_SUMMARY };
  const req: AIRequest = {
    feature: "classify.issue_category",
    system: RECOMMENDATION_GUARD + "\nAnalyze this campus issue and return category, severity, priority, summary, confidence, and reasoning.",
    user: renderIssue(issue) + `\nReturn JSON matching: { "category": ${[...categoryEnum.options].join("|")}, "severity": "low"|"medium"|"high"|"critical", "priority": "P1"|"P2"|"P3"|"P4", "summary": string, "confidence": number 0..1, "reasoning": string }.`,
    options: { temperature: 0.2, maxTokens: 800 },
  };
  const r = await gateway.send<IssueAnalysis>(req, { feature: "classify.issue_category" });
  if (r.fallback) return { analysis: fallbackAnalysis, provider: r.provider, fallback: true };
  try {
    const validated = validate<IssueAnalysis>(issueAnalysisSchema, JSON.stringify(r.data));
    return { analysis: validated, provider: r.provider, fallback: false };
  } catch (_e) {
    return { analysis: fallbackAnalysis, provider: r.provider, fallback: true };
  }
}

function renderIssue(i: IssueInput): string {
  return [
    `Title: ${i.title}`,
    i.description ? `Description: ${i.description}` : null,
    i.location ? `Location: ${i.location}` : null,
    i.reporterRole ? `Reporter role: ${i.reporterRole}` : null,
  ].filter(Boolean).join("\n");
}