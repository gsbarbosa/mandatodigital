export type FactCheckVerdict = "verified" | "disputed" | "inconclusive" | "skipped";

export type FactCheckClaim = {
  text: string;
  supported: boolean;
  sourceUrl?: string;
};

export type FactCheckResult = {
  verdict: FactCheckVerdict;
  confidence: number;
  summary: string;
  claims: FactCheckClaim[];
  sources: string[];
  checkedAt: string;
  provider?: string | null;
  model?: string | null;
};

export type FactCheckInput = {
  script: string;
  topic?: string;
  articles?: Array<{ title: string; url: string; sourceName?: string }>;
  sentinelBriefing?: string;
};

/** Fallback local quando a IA nao responde — distinto de inconclusive real da LLM. */
export function isFactCheckHeuristicFallback(result: FactCheckResult): boolean {
  return result.verdict === "inconclusive" && result.confidence === 0 && !result.provider;
}
