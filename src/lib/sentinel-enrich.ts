import { z } from "zod";

import { isSentinelLlmEnrichEnabled } from "@/lib/feature-flags";
import { parseJsonResponse, requestStructuredJson } from "@/lib/llm";
import {
  applyHeuristicEditorial,
  attachEditorial,
  EDITORIAL_RELEVANCE_MIN,
  THEME_CONFIDENCE_MIN,
} from "@/lib/sentinel-editorial-gate";
import type {
  MockSentinelSuggestion,
  SentinelEditorialEnrichment,
  SentinelSignalKind,
} from "@/lib/sentinel-mock-suggestions";
import { collectProfileRadarThemes } from "@/lib/sentinel-theme-relevance";
import { normalizeSentinelText } from "@/lib/sentinel-text";
import type { PoliticianProfile } from "@/lib/types";

const MAX_ENRICH_PER_RUN = 15;

const enrichResponseSchema = z.object({
  themes: z.array(z.string()).max(5),
  themeConfidence: z.number().min(0).max(1),
  editorialRelevanceScore: z.number().min(0).max(100),
  creativeWorthy: z.boolean(),
  signalKind: z.enum(["editorial_opportunity", "social_monitoring", "social_promoted"]),
  factualSummary: z.string().max(500),
  suggestedAngle: z.string().max(300),
  rejectReason: z.string().max(300).optional(),
});

function filterThemesToRadar(themes: string[], profile: PoliticianProfile) {
  const allowed = new Set(
    collectProfileRadarThemes(profile).allSelectable.map((theme) =>
      normalizeSentinelText(theme),
    ),
  );

  return themes.filter((theme) => allowed.has(normalizeSentinelText(theme)));
}

function buildEnrichPrompt(suggestion: MockSentinelSuggestion, profile: PoliticianProfile) {
  const radar = collectProfileRadarThemes(profile);
  const caption =
    suggestion.evidence.articles?.[0]?.title?.trim() ||
    suggestion.topic.replace(/^[^:]+:\s*/, "").trim();
  const pressLines = (suggestion.evidence.articles ?? [])
    .filter((article) => article.sourceName?.toLowerCase() !== "instagram")
    .map((article) => `- ${article.title} (${article.sourceName ?? "imprensa"})`)
    .join("\n");
  const actors = suggestion.evidence.actors
    .map((actor) => `@${actor.handle} [${actor.sourceList}]`)
    .join(", ");

  return {
    system:
      "Você é editor de inteligência política no Brasil. " +
      "Classifique sinais do radar de um mandato. " +
      "Responda apenas JSON válido com: themes (subset dos temas permitidos), " +
      "themeConfidence (0-1), editorialRelevanceScore (0-100, utilidade para ESTE mandato), " +
      "creativeWorthy (se deve liberar botão de criar conteúdo), " +
      "signalKind (editorial_opportunity | social_monitoring | social_promoted), " +
      "factualSummary (fatos, sem opinião), suggestedAngle, rejectReason (se creativeWorthy=false). " +
      "Posts sociais de oposição com alto engajamento mas sem imprensa = social_monitoring e creativeWorthy false. " +
      "Não invente fatos além do texto fornecido.",
    user:
      `Mandato: ${profile.fullName} (${profile.role}) — ${profile.city}/${profile.state}\n` +
      `Temas permitidos: ${[...radar.interest, ...radar.custom, ...radar.opposition].join(", ")}\n` +
      `Pipeline: ${suggestion.pipeline ?? "rss"}\n` +
      `Temas keyword atuais: ${suggestion.matchedThemes.join(", ") || "nenhum"}\n` +
      `Score engajamento/keyword: ${suggestion.engagement.relevanceScore}\n` +
      `Veículos distintos: ${suggestion.evidence.outletCount ?? 0}\n` +
      (actors ? `Perfis: ${actors}\n` : "") +
      `Texto principal:\n${caption}\n` +
      (pressLines ? `Matérias correlatas:\n${pressLines}\n` : ""),
  };
}

function mergeLlmEditorial(
  suggestion: MockSentinelSuggestion,
  profile: PoliticianProfile,
  payload: z.infer<typeof enrichResponseSchema>,
): MockSentinelSuggestion {
  const filteredThemes = filterThemesToRadar(payload.themes, profile);
  const matchedThemes =
    filteredThemes.length > 0 ? filteredThemes : suggestion.matchedThemes;
  const themeLabel = matchedThemes[0] ?? suggestion.themeLabel;
  const viralScore =
    suggestion.pipeline === "social"
      ? (suggestion.editorial?.viralScore ?? suggestion.engagement.relevanceScore)
      : suggestion.editorial?.viralScore;

  const creativeWorthy =
    payload.creativeWorthy &&
    payload.themeConfidence >= THEME_CONFIDENCE_MIN &&
    payload.editorialRelevanceScore >= EDITORIAL_RELEVANCE_MIN;

  const editorial: SentinelEditorialEnrichment = {
    themeConfidence: payload.themeConfidence,
    editorialRelevanceScore: payload.editorialRelevanceScore,
    creativeWorthy,
    signalKind: payload.signalKind,
    factualSummary: payload.factualSummary.trim(),
    suggestedAngle: payload.suggestedAngle.trim(),
    rejectReason: creativeWorthy ? undefined : payload.rejectReason?.trim(),
    viralScore,
    enrichedBy: "llm",
    enrichedAt: new Date().toISOString(),
  };

  return attachEditorial(
    {
      ...suggestion,
      themeLabel,
      matchedThemes,
      topic: rebuildTopic(themeLabel, suggestion.topic),
    },
    editorial,
  );
}

function rebuildTopic(themeLabel: string, previousTopic: string) {
  const snippet = previousTopic.includes(":") ? previousTopic.split(":").slice(1).join(":").trim() : previousTopic;
  const prefix = `${themeLabel} · `;
  const maxSnippet = Math.max(20, 120 - prefix.length);
  return snippet ? `${prefix}${snippet.slice(0, maxSnippet)}` : themeLabel;
}

async function enrichSingleWithLlm(
  profile: PoliticianProfile,
  suggestion: MockSentinelSuggestion,
): Promise<MockSentinelSuggestion> {
  const prompt = buildEnrichPrompt(suggestion, profile);

  try {
    const execution = await requestStructuredJson(prompt.system, prompt.user, {
      temperature: 0.2,
      maxTokens: 700,
    });

    if (!execution.rawText) {
      return applyHeuristicEditorial(suggestion);
    }

    const parsed = enrichResponseSchema.safeParse(parseJsonResponse(execution.rawText));
    if (!parsed.success) {
      return applyHeuristicEditorial(suggestion);
    }

    return mergeLlmEditorial(suggestion, profile, parsed.data);
  } catch {
    return applyHeuristicEditorial(suggestion);
  }
}

export async function enrichSentinelSuggestions(
  profile: PoliticianProfile,
  suggestions: MockSentinelSuggestion[],
): Promise<MockSentinelSuggestion[]> {
  if (suggestions.length === 0) {
    return [];
  }

  const head = suggestions.slice(0, MAX_ENRICH_PER_RUN);
  const tail = suggestions.slice(MAX_ENRICH_PER_RUN);

  const enrichedHead = isSentinelLlmEnrichEnabled()
    ? await Promise.all(head.map((suggestion) => enrichSingleWithLlm(profile, suggestion)))
    : head.map((suggestion) => applyHeuristicEditorial(suggestion));

  const enrichedTail = tail.map((suggestion) => applyHeuristicEditorial(suggestion));

  return [...enrichedHead, ...enrichedTail];
}

export function sortSentinelSuggestionsForDisplay(suggestions: MockSentinelSuggestion[]) {
  return [...suggestions].sort((left, right) => {
    const leftMonitoring = left.editorial?.signalKind === "social_monitoring" ? 1 : 0;
    const rightMonitoring = right.editorial?.signalKind === "social_monitoring" ? 1 : 0;

    if (leftMonitoring !== rightMonitoring) {
      return leftMonitoring - rightMonitoring;
    }

    return right.relevanceScore - left.relevanceScore;
  });
}

export type { SentinelSignalKind };
