import type { MockSentinelSuggestion } from "@/lib/sentinel-mock-suggestions";

/** Limiar padrão: card com score ≥ isso conta como pautável na métrica da spike. */
export const SENTINEL_PAUTAVEL_THRESHOLD = 0.55;

export type SentinelQualityCardScore = {
  suggestionId: string;
  themeLabel: string;
  score: number;
  pautavel: boolean;
  reasons: string[];
  kind: "news" | "opposition";
};

export type SentinelQualityReport = {
  total: number;
  newsTotal: number;
  oppositionTotal: number;
  newsPautavel: number;
  /** % pautável só entre cards de notícia (0–100). */
  newsPautavelPercent: number;
  cards: SentinelQualityCardScore[];
};

export type SentinelLlmCostEstimate = {
  expansionCalls: number;
  verifyLlmCalls: number;
  qualityRankCalls: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  /** USD aproximado (gpt-4.1-mini order of magnitude). */
  estimatedUsd: number;
  model: string;
};

const GENERIC_TITLE_MARKERS = [
  "veja",
  "saiba mais",
  "ao vivo",
  "confira",
  "em fotos",
  "galeria",
];

function isOpposition(suggestion: MockSentinelSuggestion) {
  return (suggestion.evidence.actors ?? []).some((actor) => actor.sourceList === "opposition");
}

function primaryTitle(suggestion: MockSentinelSuggestion) {
  const articleTitle = suggestion.evidence.articles?.[0]?.title?.trim() ?? "";
  if (articleTitle) {
    return articleTitle;
  }
  const topic = suggestion.topic.trim();
  const parts = topic.split(" · ");
  return (parts.length > 1 ? parts.slice(1).join(" · ") : topic).trim();
}

/**
 * Heurística v0 da spike — barata, determinística, sem LLM.
 * Não substitui julgamento humano; serve de proxy online + eval offline.
 */
export function scoreSuggestionPautavel(suggestion: MockSentinelSuggestion): SentinelQualityCardScore {
  const reasons: string[] = [];
  let score = 0;
  const opposition = isOpposition(suggestion);
  const kind = opposition ? "opposition" : "news";

  if (opposition) {
    const hasPost = Boolean(suggestion.evidence.actors?.[0]?.postUrl);
    score += hasPost ? 0.45 : 0.1;
    if (hasPost) {
      reasons.push("post adversario com link");
    }
    if (suggestion.themeLabel.trim()) {
      score += 0.15;
      reasons.push("tema rotulado");
    }
    const final = Math.min(1, score);
    return {
      suggestionId: suggestion.id,
      themeLabel: suggestion.themeLabel,
      score: final,
      pautavel: final >= SENTINEL_PAUTAVEL_THRESHOLD,
      reasons,
      kind,
    };
  }

  const title = primaryTitle(suggestion);
  if (title.length >= 28) {
    score += 0.25;
    reasons.push("titulo utilizavel");
  } else if (title.length >= 12) {
    score += 0.12;
    reasons.push("titulo curto");
  }

  if (suggestion.themeLabel.trim()) {
    score += 0.2;
    reasons.push("tema do radar");
  }

  const relevance = suggestion.relevanceScore ?? 0;
  if (relevance >= 70) {
    score += 0.25;
    reasons.push("relevance alta");
  } else if (relevance >= 45) {
    score += 0.15;
    reasons.push("relevance media");
  } else if (relevance >= 25) {
    score += 0.08;
  }

  const outlets = suggestion.evidence.outletCount ?? suggestion.evidence.articles?.length ?? 0;
  if (outlets >= 3) {
    score += 0.15;
    reasons.push("multi-veiculo");
  } else if (outlets >= 2) {
    score += 0.1;
    reasons.push("2 veiculos");
  } else if (outlets >= 1) {
    score += 0.05;
  }

  const titleNorm = title.toLowerCase();
  if (GENERIC_TITLE_MARKERS.some((marker) => titleNorm.includes(marker)) && title.length < 40) {
    score -= 0.15;
    reasons.push("titulo generico");
  }

  if ((suggestion.matchedThemes?.length ?? 0) >= 2) {
    score += 0.05;
    reasons.push("multi-tema");
  }

  const final = Math.max(0, Math.min(1, score));
  return {
    suggestionId: suggestion.id,
    themeLabel: suggestion.themeLabel,
    score: Number(final.toFixed(3)),
    pautavel: final >= SENTINEL_PAUTAVEL_THRESHOLD,
    reasons,
    kind,
  };
}

export function buildSentinelQualityReport(
  suggestions: MockSentinelSuggestion[],
): SentinelQualityReport {
  const cards = suggestions.map(scoreSuggestionPautavel);
  const news = cards.filter((card) => card.kind === "news");
  const opposition = cards.filter((card) => card.kind === "opposition");
  const newsPautavel = news.filter((card) => card.pautavel).length;

  return {
    total: cards.length,
    newsTotal: news.length,
    oppositionTotal: opposition.length,
    newsPautavel,
    newsPautavelPercent:
      news.length === 0 ? 0 : Math.round((newsPautavel / news.length) * 1000) / 10,
    cards,
  };
}

/** Preços aproximados USD / 1M tokens (gpt-4.1-mini, ordem de grandeza 2026). */
const DEFAULT_INPUT_USD_PER_MTOK = 0.4;
const DEFAULT_OUTPUT_USD_PER_MTOK = 1.6;

export function estimateSentinelLlmCost(input: {
  expansionCalls?: number;
  verifyLlmCalls?: number;
  qualityRankCalls?: number;
  /** Tokens médios por chamada de expansão. */
  expansionTokensIn?: number;
  expansionTokensOut?: number;
  verifyTokensIn?: number;
  verifyTokensOut?: number;
  qualityTokensIn?: number;
  qualityTokensOut?: number;
  model?: string;
}): SentinelLlmCostEstimate {
  const expansionCalls = input.expansionCalls ?? 0;
  const verifyLlmCalls = input.verifyLlmCalls ?? 0;
  const qualityRankCalls = input.qualityRankCalls ?? 0;

  const estimatedInputTokens =
    expansionCalls * (input.expansionTokensIn ?? 400) +
    verifyLlmCalls * (input.verifyTokensIn ?? 350) +
    qualityRankCalls * (input.qualityTokensIn ?? 900);

  const estimatedOutputTokens =
    expansionCalls * (input.expansionTokensOut ?? 200) +
    verifyLlmCalls * (input.verifyTokensOut ?? 120) +
    qualityRankCalls * (input.qualityTokensOut ?? 400);

  const estimatedUsd =
    (estimatedInputTokens / 1_000_000) * DEFAULT_INPUT_USD_PER_MTOK +
    (estimatedOutputTokens / 1_000_000) * DEFAULT_OUTPUT_USD_PER_MTOK;

  return {
    expansionCalls,
    verifyLlmCalls,
    qualityRankCalls,
    estimatedInputTokens,
    estimatedOutputTokens,
    estimatedUsd: Math.round(estimatedUsd * 10_000) / 10_000,
    model: input.model ?? (process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini"),
  };
}
