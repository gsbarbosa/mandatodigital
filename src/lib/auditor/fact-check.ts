import { z } from "zod";

import { normalizeFactCheckVerdict } from "@/lib/auditor/fact-check-gate";
import type { FactCheckInput, FactCheckResult } from "@/lib/auditor/types";
import { fetchArticlesCorpus } from "@/lib/auditor/url-extract";
import { parseJsonResponse, requestStructuredJson } from "@/lib/llm";
import { appLog, appLogError, startTimer } from "@/lib/observability/log";

const MAX_CLAIMS = 8;
const MAX_SOURCES = 8;
const MAX_CLAIM_CHARS = 280;
const FACT_CHECK_MAX_TOKENS = 2200;
const FACT_CHECK_RETRY_MAX_TOKENS = 3600;

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

const VERDICT_ALIASES: Record<string, "verified" | "disputed" | "inconclusive"> = {
  verified: "verified",
  verificado: "verified",
  supported: "verified",
  true: "verified",
  ok: "verified",
  disputed: "disputed",
  contestado: "disputed",
  contradicted: "disputed",
  false: "disputed",
  inconclusive: "inconclusive",
  inconclusivo: "inconclusive",
  unsupported: "inconclusive",
  unverified: "inconclusive",
  unproven: "inconclusive",
  unknown: "inconclusive",
};

const CLAIM_VERDICT_ALIASES: Record<string, "supported" | "contradicted" | "unsupported"> = {
  supported: "supported",
  true: "supported",
  ok: "supported",
  contradicted: "contradicted",
  false: "contradicted",
  disputed: "contradicted",
  unsupported: "unsupported",
  unverified: "unsupported",
  unknown: "unsupported",
};

function foldKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

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

  return CONFIDENCE_WORDS[foldKey(normalized)] ?? value;
}

function coerceVerdict(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }
  return VERDICT_ALIASES[foldKey(value)] ?? value;
}

function coerceClaimVerdict(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }
  return CLAIM_VERDICT_ALIASES[foldKey(value)] ?? value;
}

/** Aceita as variacoes de nome/nulo que o LLM produz sem descartar a resposta inteira. */
function normalizeClaim(value: unknown) {
  if (!value || typeof value !== "object") {
    return value;
  }

  const claim = value as Record<string, unknown>;
  const textRaw = claim.text ?? claim.claim ?? claim.afirmacao ?? claim.trecho;
  const detailRaw = claim.contradictionDetail;

  return {
    ...claim,
    text: typeof textRaw === "string" ? textRaw.trim().slice(0, MAX_CLAIM_CHARS) : textRaw,
    verdict: coerceClaimVerdict(claim.verdict),
    attributesToThirdParty: claim.attributesToThirdParty ?? false,
    contradictionDetail:
      typeof detailRaw === "string" ? detailRaw.trim().slice(0, MAX_CLAIM_CHARS) : undefined,
    sourceUrl: typeof claim.sourceUrl === "string" ? claim.sourceUrl : undefined,
  };
}

const factCheckResponseSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object") {
    return value;
  }

  const payload = value as Record<string, unknown>;
  const claims = Array.isArray(payload.claims)
    ? payload.claims
        .slice(0, MAX_CLAIMS)
        .map(normalizeClaim)
        .filter(
          (claim) =>
            Boolean(claim) &&
            typeof claim === "object" &&
            typeof (claim as { text?: unknown }).text === "string" &&
            String((claim as { text: string }).text).length > 0,
        )
    : payload.claims == null
      ? []
      : payload.claims;

  return {
    ...payload,
    verdict: coerceVerdict(payload.verdict),
    confidence: coerceConfidence(payload.confidence),
    summary: typeof payload.summary === "string" ? payload.summary : payload.summary == null ? "" : payload.summary,
    claims,
    sources: Array.isArray(payload.sources)
      ? payload.sources.filter((source) => typeof source === "string").slice(0, MAX_SOURCES)
      : payload.sources == null
        ? []
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
      "Extraia SOMENTE claims factuais checaveis. Nao liste opiniao, retorica, slogan, CTA " +
      "nem proposta/promessa do proprio candidato. " +
      "E claim: numero, data, estatistica, valor; evento especifico (morte, prisao, votacao); " +
      "fala/ato/posicao atribuida a TERCEIRO nomeado; dado de saude, crime ou servico publico " +
      "apresentado como fato ocorrido. " +
      "NAO e claim: 'o crime tomou conta das ruas', 'ninguem aguenta mais', 'chega de impunidade', " +
      "'vamos construir um superpresidio', 'vamos reduzir a maioridade penal', 'compartilhe essa ideia'. " +
      "Se o roteiro so tem opiniao, proposta do candidato ou CTA, verdict=verified com claims vazio. " +
      "verified: nao ha claim checavel OU todos os claims sao supported. " +
      "disputed: algum claim contradiz as fontes, OU o roteiro atribui fala/ato a terceiro sem suporte. " +
      "inconclusive: ha claim checavel unsupported (fato especifico sem respaldo nas fontes). " +
      "Nao use verified se existir claim unsupported ou contradicted. " +
      "Morte, saude, numero e ato de terceiro nomeado sem trecho explicito na fonte sao " +
      "unsupported/contradicted — nunca retorica generica de campanha. " +
      "Responda SOMENTE JSON valido neste formato exato: " +
      '{"verdict":"verified|disputed|inconclusive","confidence":<inteiro 0-100>,"summary":"...",' +
      '"claims":[{"text":"trecho curto","verdict":"supported|contradicted|unsupported",' +
      '"attributesToThirdParty":true|false,"contradictionDetail":"...","sourceUrl":"..."}],' +
      '"sources":["url"]}. ' +
      "O campo do trecho chama-se text (nunca claim), no maximo ~20 palavras. " +
      "confidence e numero inteiro, nunca palavra. " +
      "Omita contradictionDetail e sourceUrl quando nao se aplicarem, em vez de enviar null. " +
      `No maximo ${MAX_CLAIMS} itens em claims e ${MAX_SOURCES} em sources. ` +
      "Para cada claim: contradicted quando a fonte diz outra coisa (preencha contradictionDetail curto); " +
      "unsupported quando nenhuma fonte confirma nem contradiz; supported quando ha fonte explicita. " +
      "Marque attributesToThirdParty=true quando o trecho atribuir fala, ato ou posicao a terceiro.",
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

function schemaIssuePaths(error: z.ZodError) {
  return error.issues.map((issue) => issue.path.join(".")).join(", ");
}

async function requestFactCheckJson(system: string, user: string, maxTokens: number) {
  const execution = await requestStructuredJson(system, user, {
    temperature: 0.1,
    maxTokens,
  });
  const parsed = execution.rawText ? parseJsonResponse<unknown>(execution.rawText) : null;
  const validated = factCheckResponseSchema.safeParse(parsed);
  return { execution, validated };
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
    let { execution, validated } = await requestFactCheckJson(
      prompt.system,
      prompt.user,
      FACT_CHECK_MAX_TOKENS,
    );

    if (!validated.success) {
      appLog(
        "fact-check",
        "llm_retry",
        {
          reason: execution.rawText ? "invalid_llm_json" : "empty_llm_response",
          articleCount,
          durationMs: elapsed(),
          invalidPaths: schemaIssuePaths(validated.error),
        },
        "warn",
      );

      const retry = await requestFactCheckJson(
        prompt.system,
        prompt.user,
        FACT_CHECK_RETRY_MAX_TOKENS,
      );
      execution = retry.execution;
      validated = retry.validated;
    }

    if (!validated.success) {
      appLog(
        "fact-check",
        "llm_fallback",
        {
          reason: execution.rawText ? "invalid_llm_json" : "empty_llm_response",
          articleCount,
          durationMs: elapsed(),
          invalidPaths: schemaIssuePaths(validated.error),
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
