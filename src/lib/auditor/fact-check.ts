import { z } from "zod";

import type { FactCheckInput, FactCheckResult } from "@/lib/auditor/types";
import { fetchArticlesCorpus } from "@/lib/auditor/url-extract";
import { parseJsonResponse, requestStructuredJson } from "@/lib/llm";

const factCheckResponseSchema = z.object({
  verdict: z.enum(["verified", "disputed", "inconclusive"]),
  confidence: z.number().min(0).max(100),
  summary: z.string(),
  claims: z
    .array(
      z.object({
        text: z.string(),
        supported: z.boolean(),
        sourceUrl: z.string().optional(),
      }),
    )
    .max(12),
  sources: z.array(z.string()).max(8),
});

function buildPrompt(input: FactCheckInput, corpus: string) {
  return {
    system:
      "Você e um validador factual para conteúdo político no Brasil. " +
      "Compare o roteiro apenas com as fontes fornecidas (não invente URLs). " +
      "Responda JSON: { verdict, confidence, summary, claims[], sources[] }. " +
      "verdict=verified se claims centrais tem suporte; disputed se ha contradicoes matériais; inconclusive se fontes insuficientes.",
    user: [
      input.topic ? `Tema: ${input.topic}` : "",
      input.sentinelBriefing ? `Briefing Sentinela:\n${input.sentinelBriefing}` : "",
      `Roteiro:\n${input.script.trim()}`,
      corpus ? `Fontes:\n${corpus}` : "Fontes: nenhuma URL utilizavel.",
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}

function heuristicFallback(input: FactCheckInput): FactCheckResult {
  const hasSources = (input.articles?.length ?? 0) > 0;
  return {
    verdict: hasSources ? "inconclusive" : "skipped",
    confidence: 0,
    summary: hasSources
      ? "Não foi possível validar automaticamente. Revise manualmente antes de publicar."
      : "Fact-check ignorado: nenhuma matéria de referência informada.",
    claims: [],
    sources: (input.articles ?? []).map((article) => article.url).filter(Boolean),
    checkedAt: new Date().toISOString(),
    provider: null,
    model: null,
  };
}

export async function runFactCheck(input: FactCheckInput): Promise<FactCheckResult> {
  const script = input.script.trim();
  if (!script) {
    return {
      ...heuristicFallback(input),
      verdict: "skipped",
      summary: "Roteiro vazio.",
    };
  }

  const corpus = input.articles?.length ? await fetchArticlesCorpus(input.articles) : "";
  const prompt = buildPrompt(input, corpus);

  try {
    const execution = await requestStructuredJson(prompt.system, prompt.user, {
      temperature: 0.1,
      maxTokens: 900,
    });

    if (!execution.rawText) {
      return heuristicFallback(input);
    }

    const parsed = parseJsonResponse<unknown>(execution.rawText);
    const validated = factCheckResponseSchema.safeParse(parsed);

    if (!validated.success) {
      return heuristicFallback(input);
    }

    return {
      verdict: validated.data.verdict,
      confidence: Math.round(validated.data.confidence),
      summary: validated.data.summary.trim(),
      claims: validated.data.claims,
      sources: validated.data.sources,
      checkedAt: new Date().toISOString(),
      provider: execution.provider,
      model: execution.model,
    };
  } catch {
    return heuristicFallback(input);
  }
}
