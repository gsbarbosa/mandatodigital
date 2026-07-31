import { z } from "zod";

import type { FactCheckInput, FactCheckResult } from "@/lib/auditor/types";
import { fetchArticlesCorpus } from "@/lib/auditor/url-extract";
import { parseJsonResponse, requestStructuredJson } from "@/lib/llm";
import { appLog, appLogError, startTimer } from "@/lib/observability/log";

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
      "Voce e um validador factual para conteudo politico no Brasil. " +
      "Compare o roteiro apenas com as fontes fornecidas (nao invente URLs). " +
      "Trate como disputed qualquer trecho que atribua falas, atos ou posicoes a terceiros " +
      "(jornalistas, autoridades, adversarios, cidadaos) sem suporte explicito nas fontes, ou que simule " +
      "contextos factuais nao verificados como se fossem reais. " +
      "Responda JSON: { verdict, confidence, summary, claims[], sources[] }. " +
      "verdict=verified se claims centrais tem suporte; disputed se ha contradicoes materiais; inconclusive se fontes insuficientes.",
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
      ? "Nao foi possivel validar automaticamente. Revise manualmente antes de publicar."
      : "Fact-check ignorado: nenhuma materia de referencia informada.",
    claims: [],
    sources: (input.articles ?? []).map((article) => article.url).filter(Boolean),
    checkedAt: new Date().toISOString(),
    provider: null,
    model: null,
  };
}

export async function runFactCheck(input: FactCheckInput): Promise<FactCheckResult> {
  const elapsed = startTimer();
  const script = input.script.trim();
  const articleCount = input.articles?.length ?? 0;
  appLog("fact-check", "started", {
    articleCount,
    scriptChars: script.length,
    hasTopic: Boolean(input.topic?.trim()),
  });

  if (!script) {
    appLog("fact-check", "skipped", { reason: "empty_script" }, "warn");
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
      appLog(
        "fact-check",
        "llm_fallback",
        { reason: "empty_llm_response", articleCount, durationMs: elapsed() },
        "warn",
      );
      return heuristicFallback(input);
    }

    const parsed = parseJsonResponse<unknown>(execution.rawText);
    const validated = factCheckResponseSchema.safeParse(parsed);

    if (!validated.success) {
      appLog(
        "fact-check",
        "llm_fallback",
        { reason: "invalid_llm_json", articleCount, durationMs: elapsed() },
        "warn",
      );
      return heuristicFallback(input);
    }

    appLog("fact-check", "completed", {
      verdict: validated.data.verdict,
      confidence: Math.round(validated.data.confidence),
      provider: execution.provider,
      model: execution.model,
      claimCount: validated.data.claims.length,
      durationMs: elapsed(),
    });

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
  } catch (error) {
    appLogError("fact-check", "failed_heuristic_fallback", error, {
      articleCount,
      durationMs: elapsed(),
    });
    return heuristicFallback(input);
  }
}
