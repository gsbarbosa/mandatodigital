import type {
  MockSentinelSuggestion,
  SentinelEditorialEnrichment,
  SentinelSignalKind,
} from "@/lib/sentinel-mock-suggestions";

export const EDITORIAL_RELEVANCE_MIN = 60;
export const THEME_CONFIDENCE_MIN = 0.7;

export function isCreativeGenerationAllowed(suggestion: MockSentinelSuggestion) {
  if (suggestion.editorial?.creativeWorthy === true) {
    return true;
  }

  if (suggestion.editorial?.creativeWorthy === false) {
    return false;
  }

  if (suggestion.pipeline === "social") {
    return false;
  }

  const outletCount = suggestion.evidence.outletCount ?? 0;
  if (outletCount >= 2) {
    return true;
  }

  return suggestion.relevanceScore >= EDITORIAL_RELEVANCE_MIN;
}

export function creativeBlockMessage(suggestion: MockSentinelSuggestion) {
  if (suggestion.editorial?.rejectReason?.trim()) {
    return suggestion.editorial.rejectReason.trim();
  }

  if (suggestion.editorial?.signalKind === "social_monitoring") {
    return "Alerta de monitoramento social — alto engajamento, baixa confiabilidade editorial para criativo automático.";
  }

  return "Este sinal ainda não passou no crivo editorial para gerar criativo.";
}

export function inferSignalKind(suggestion: MockSentinelSuggestion): SentinelSignalKind {
  if (suggestion.editorial?.signalKind) {
    return suggestion.editorial.signalKind;
  }

  if (suggestion.pipeline === "social") {
    const hasPress =
      (suggestion.evidence.outletCount ?? 0) >= 2 ||
      (suggestion.evidence.articles ?? []).some(
        (article) => article.sourceName?.toLowerCase() !== "instagram",
      );

    return hasPress ? "social_promoted" : "social_monitoring";
  }

  return "editorial_opportunity";
}

export function applyHeuristicEditorial(
  suggestion: MockSentinelSuggestion,
): MockSentinelSuggestion {
  const signalKind = inferSignalKind(suggestion);
  const outletCount = suggestion.evidence.outletCount ?? 0;
  const viralScore = suggestion.pipeline === "social" ? suggestion.relevanceScore : undefined;
  const isOpposition = suggestion.evidence.actors.some(
    (actor) => actor.sourceList === "opposition",
  );

  let editorialRelevanceScore = suggestion.relevanceScore;
  let creativeWorthy = false;
  let themeConfidence = suggestion.matchedThemes.length > 0 ? 0.75 : 0.4;

  if (signalKind === "editorial_opportunity") {
    creativeWorthy = outletCount >= 2 || suggestion.relevanceScore >= EDITORIAL_RELEVANCE_MIN;
    themeConfidence = creativeWorthy ? 0.85 : 0.65;
  } else if (signalKind === "social_promoted") {
    creativeWorthy = true;
    editorialRelevanceScore = Math.min(88, Math.max(suggestion.relevanceScore, 62));
    themeConfidence = 0.8;
  } else {
    creativeWorthy = false;
    editorialRelevanceScore = Math.min(
      55,
      Math.round(suggestion.relevanceScore * (isOpposition ? 0.35 : 0.45)),
    );
    themeConfidence = 0.55;
  }

  const editorial: SentinelEditorialEnrichment = {
    themeConfidence,
    editorialRelevanceScore,
    creativeWorthy,
    signalKind,
    viralScore,
    enrichedBy: "heuristic",
    enrichedAt: new Date().toISOString(),
    factualSummary: buildHeuristicSummary(suggestion),
    suggestedAngle: buildHeuristicAngle(suggestion, signalKind, isOpposition),
    rejectReason:
      signalKind === "social_monitoring"
        ? "Post social sem correlação com imprensa — útil para monitorar narrativa, não para criativo direto."
        : undefined,
  };

  return attachEditorial(suggestion, editorial);
}

function buildHeuristicSummary(suggestion: MockSentinelSuggestion) {
  const article = suggestion.evidence.articles?.[0];
  if (article?.title?.trim()) {
    return article.title.trim().slice(0, 280);
  }

  return suggestion.topic.replace(/^[^:]+:\s*/, "").slice(0, 280);
}

function buildHeuristicAngle(
  suggestion: MockSentinelSuggestion,
  signalKind: SentinelSignalKind,
  isOpposition: boolean,
) {
  if (signalKind === "social_promoted") {
    return "Cruzar narrativa social com cobertura da imprensa antes de responder.";
  }

  if (signalKind === "social_monitoring" && isOpposition) {
    return "Monitorar narrativa adversária; se responder, priorize esclarecimento factual.";
  }

  if (signalKind === "editorial_opportunity") {
    return `Posicionar sobre ${suggestion.themeLabel} com dados verificáveis da cobertura.`;
  }

  return "Avaliar se o assunto merece resposta pública alinhada ao radar.";
}

export function attachEditorial(
  suggestion: MockSentinelSuggestion,
  editorial: SentinelEditorialEnrichment,
): MockSentinelSuggestion {
  const relevanceScore = editorial.editorialRelevanceScore;

  return {
    ...suggestion,
    relevanceScore,
    editorial,
    engagement: {
      ...suggestion.engagement,
      relevanceScore,
    },
  };
}

export function partitionSentinelSuggestions(suggestions: MockSentinelSuggestion[]) {
  const opportunities: MockSentinelSuggestion[] = [];
  const monitoring: MockSentinelSuggestion[] = [];

  for (const suggestion of suggestions) {
    const kind = inferSignalKind(suggestion);
    const monitoringOnly =
      kind === "social_monitoring" && !isCreativeGenerationAllowed(suggestion);

    if (monitoringOnly) {
      monitoring.push(suggestion);
    } else {
      opportunities.push(suggestion);
    }
  }

  return { opportunities, monitoring };
}
