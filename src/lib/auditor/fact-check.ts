import { z } from "zod";

import { normalizeFactCheckVerdict } from "@/lib/auditor/fact-check-gate";
import type { FactCheckInput, FactCheckResult } from "@/lib/auditor/types";
import { fetchArticlesCorpus } from "@/lib/auditor/url-extract";
import { parseJsonResponse, requestStructuredJson } from "@/lib/llm";
import { appLog, appLogError, startTimer } from "@/lib/observability/log";

const MAX_CLAIMS = 12;
const MAX_SOURCES = 8;

/** O modelo as vezes responde confianca qualitativa em vez de numero. */
const CONFIDENCE_WORDS: Record<string, number> = {
  alta: 85,
  high: 85,
  media: 60,
  moderada: 60,
  medium: 60,
  baixa: 30,
  low: 30,
  nenhuma: 0,
  none: 0,
};

function coerceConfidence(value: unknown) {
  if (typeof value === "number") {
    return value <= 1 ? value * 100 : value;
  }

  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim().toLowerCase();
  const numeric = Number(normalized.replace("%", "").replace(",", "."));

  if (Number.isFinite(numeric)) {
    return numeric <= 1 ? numeric * 100 : numeric;
  }

  const withoutAccents = normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  return CONFIDENCE_WORDS[withoutAccents] ?? value;
}

/** Aceita as variacoes de nome/nulo que o LLM produz sem descartar a resposta inteira. */
function normalizeClaim(value: unknown) {
  if (!value || typeof value !== "object") {
    return value;
  }

  const claim = value as Record<string, unknown>;

  return {
    ...claim,
    text: claim.text ?? claim.claim ?? claim.afirmacao ?? claim.trecho,
    attributesToThirdParty: claim.attributesToThirdParty ?? false,
    contradictionDetail: claim.contradictionDetail ?? undefined,
    sourceUrl: claim.sourceUrl ?? undefined,
  };
}

const factCheckResponseSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object") {
    return value;
  }

  const payload = value as Record<string, unknown>;

  return {
    ...payload,
    confidence: coerceConfidence(payload.confidence),
    claims: Array.isArray(payload.claims)
      ? payload.claims.slice(0, MAX_CLAIMS).map(normalizeClaim)
      : payload.claims,
    sources: Array.isArray(payload.sources)
      ? payload.sources.filter((source) => typeof source === "string").slice(0, MAX_SOURCES)
      : payload.sources,
  };
}, z.object({
  verdict: z.enum(["verified", "disputed", "inconclusive"]),
  confidence: z.number().min(0).max(100),
  summary: z.string(),
  claims: z
    .array(
      z.object({
        text: z.string(),
        verdict: z.enum(["supported", "contradicted", "unsupported"]),
        attributesToThirdParty: z.boolean().optional().default(false),
        contradictionDetail: z.string().optional(),
        sourceUrl: z.string().optional(),
      }),
    )
    .max(MAX_CLAIMS),
  sources: z.array(z.string()).max(MAX_SOURCES),
}));

function buildPrompt(input: FactCheckInput, corpus: string) {
  return {
    system:
      "Voce e um validador factual para conteudo politico no Brasil. " +
      "Compare o roteiro apenas com as fontes fornecidas (nao invente URLs). " +
      "Trate como disputed qualquer trecho que atribua falas, atos ou posicoes a terceiros " +
      "(jornalistas, autoridades, adversarios, cidadaos) sem suporte explicito nas fontes, ou que simule " +
      "contextos factuais nao verificados como se fossem reais. " +
      "Afirmacoes factuais (morte, saude, crime, numeros, atos de pessoas publicas) sem respaldo " +
      "explicito nas fontes NAO podem ser verified: o claim deve ser unsupported (ou contradicted) " +
      "e o verdict do roteiro disputed. inconclusive so quando o roteiro nao tem afirmacao factual checavel. " +
      "Responda SOMENTE JSON valido neste formato exato: " +
      '{"verdict":"verified|disputed|inconclusive","confidence":<inteiro 0-100>,"summary":"...",' +
      '"claims":[{"text":"trecho do roteiro","verdict":"supported|contradicted|unsupported",' +
      '"attributesToThirdParty":true|false,"contradictionDetail":"...","sourceUrl":"..."}],' +
      '"sources":["url"]}. ' +
      "O campo do trecho chama-se text (nunca claim). confidence e numero inteiro, nunca palavra. " +
      "Omita contradictionDetail e sourceUrl quando nao se aplicarem, em vez de enviar null. " +
      `No maximo ${MAX_CLAIMS} itens em claims e ${MAX_SOURCES} em sources. ` +
      "verdict=verified somente se TODAS as afirmações factuais tiverem suporte explícito nas fontes; " +
      "disputed se houver contradição material; inconclusive se alguma afirmação factual não puder ser comprovada. " +
      "Não use verified quando existir claim unsupported. Morte, crime, saúde, números e atos de terceiros " +
      "sem trecho explícito na fonte são disputed (claim unsupported ou contradicted). " +
      "Para cada item de claims[], defina verdict='contradicted' quando as fontes disserem algo diferente do " +
      "afirmado no roteiro (preencha contradictionDetail com o que a fonte realmente diz, de forma curta e direta); " +
      "verdict='unsupported' quando nenhuma fonte confirmar nem contradizer o trecho; verdict='supported' quando " +
      "houver fonte explicita confirmando. Marque attributesToThirdParty=true quando o trecho atribuir fala, ato " +
      "ou posicao a uma pessoa ou entidade terceira (mesmo que verdict seja supported).",
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
        {
          reason: "invalid_llm_json",
          articleCount,
          durationMs: elapsed(),
          // Caminhos do schema que falharam — sem o conteudo, que carrega o roteiro.
          invalidPaths: validated.error.issues
            .map((issue) => issue.path.join("."))
            .join(", "),
        },
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

    return normalizeFactCheckVerdict({
      verdict: validated.data.verdict,
      confidence: Math.round(validated.data.confidence),
      summary: validated.data.summary.trim(),
      claims: validated.data.claims,
      sources: validated.data.sources,
      checkedAt: new Date().toISOString(),
      provider: execution.provider,
      model: execution.model,
    });
  } catch (error) {
    appLogError("fact-check", "failed_heuristic_fallback", error, {
      articleCount,
      durationMs: elapsed(),
    });
    return heuristicFallback(input);
  }
}
