import { z } from "zod";

import { isSentinelLlmQualityRankEnabled } from "@/lib/feature-flags";
import { parseJsonResponse, requestStructuredJson } from "@/lib/llm";
import type { MockSentinelSuggestion } from "@/lib/sentinel-mock-suggestions";
import { scoreSuggestionPautavel } from "@/lib/sentinel-quality";

const DEFAULT_TOP_N = 15;
const DEFAULT_CONCURRENCY = 4;

const qualityRankResponseSchema = z.object({
  pautavel: z.boolean(),
  score: z.number().min(0).max(1),
  briefing: z.string().trim().max(280).default(""),
  creativeAngle: z.string().trim().max(160).optional().default(""),
});

export type SentinelQualityRankStats = {
  considered: number;
  ranked: number;
  llmCalls: number;
  kept: number;
  dropped: number;
};

export type QualityRankOptions = {
  topN?: number;
  concurrency?: number;
  minScore?: number;
  profileLabel?: string;
  /** false = no-op (guest / custo). Default: respeita a feature flag. */
  enabled?: boolean;
};

function buildRankPrompt(suggestion: MockSentinelSuggestion, profileLabel: string) {
  const article = suggestion.evidence.articles?.[0];
  const title = article?.title ?? suggestion.topic;
  const source = article?.sourceName ?? "";
  const outlets = suggestion.evidence.outletCount ?? suggestion.evidence.articles?.length ?? 0;

  return {
    system:
      "Voce e editor de pautas politicas no Brasil. " +
      "Responda apenas JSON valido: " +
      '{ "pautavel": true|false, "score": 0-1, "briefing": "...", "creativeAngle": "..." }. ' +
      "pautavel=true so se a materia serve para um mandato produzir um criativo util nas proximas 24-48h " +
      "(fato concreto, angulo local/nacional claro, nao clickbait vazio). " +
      "briefing: 1 frase objetiva. creativeAngle: gancho curto para video/post.",
    user: [
      profileLabel ? `Mandato/contexto: ${profileLabel}` : "",
      `Tema do radar: ${suggestion.themeLabel}`,
      `Temas casados: ${(suggestion.matchedThemes ?? []).join(", ") || "—"}`,
      `Titulo: ${title}`,
      source ? `Fonte: ${source}` : "",
      `Veiculos no cluster: ${outlets}`,
      `Score local: ${suggestion.relevanceScore}`,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }
  const results: R[] = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await mapper(items[current] as T);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

function isOpposition(suggestion: MockSentinelSuggestion) {
  return (suggestion.evidence.actors ?? []).some((actor) => actor.sourceList === "opposition");
}

/**
 * Reordena o top N de notícias com LLM mini e anexa briefing no topic quando útil.
 * Oposição passa intacta. Flag off = no-op.
 */
export async function applySentinelQualityRank(
  suggestions: MockSentinelSuggestion[],
  options: QualityRankOptions = {},
): Promise<{
  suggestions: MockSentinelSuggestion[];
  stats: SentinelQualityRankStats;
}> {
  const stats: SentinelQualityRankStats = {
    considered: 0,
    ranked: 0,
    llmCalls: 0,
    kept: 0,
    dropped: 0,
  };

  if (
    options.enabled === false ||
    !isSentinelLlmQualityRankEnabled() ||
    suggestions.length === 0
  ) {
    return { suggestions, stats };
  }

  const topN = options.topN ?? DEFAULT_TOP_N;
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
  const minScore = options.minScore ?? 0.45;
  const profileLabel = options.profileLabel?.trim() || "mandato local";

  const opposition = suggestions.filter(isOpposition);
  const news = suggestions.filter((item) => !isOpposition(item));

  const sortedNews = [...news].sort((left, right) => {
    const leftH = scoreSuggestionPautavel(left).score;
    const rightH = scoreSuggestionPautavel(right).score;
    if (rightH !== leftH) {
      return rightH - leftH;
    }
    return right.relevanceScore - left.relevanceScore;
  });

  const head = sortedNews.slice(0, topN);
  const tail = sortedNews.slice(topN);
  stats.considered = head.length;

  const rankedHead = await mapWithConcurrency(head, concurrency, async (suggestion) => {
    stats.llmCalls += 1;
    const prompt = buildRankPrompt(suggestion, profileLabel);
    const execution = await requestStructuredJson(prompt.system, prompt.user, {
      temperature: 0.1,
      maxTokens: 280,
    });

    if (!execution.rawText) {
      stats.ranked += 1;
      stats.kept += 1;
      return { suggestion, keep: true, score: scoreSuggestionPautavel(suggestion).score };
    }

    const parsed = parseJsonResponse<unknown>(execution.rawText);
    const validated = qualityRankResponseSchema.safeParse(parsed);
    if (!validated.success) {
      stats.ranked += 1;
      stats.kept += 1;
      return { suggestion, keep: true, score: scoreSuggestionPautavel(suggestion).score };
    }

    const { pautavel, score, briefing, creativeAngle } = validated.data;
    stats.ranked += 1;
    const keep = pautavel && score >= minScore;
    if (!keep) {
      stats.dropped += 1;
      return { suggestion, keep: false, score };
    }
    stats.kept += 1;

    const angle = creativeAngle.trim() || briefing.trim();
    const nextTopic =
      angle && !suggestion.topic.includes(angle.slice(0, 24))
        ? `${suggestion.themeLabel} · ${angle}`
        : suggestion.topic;

    return {
      suggestion: {
        ...suggestion,
        topic: nextTopic.slice(0, 160),
        briefing: briefing.trim().slice(0, 280) || suggestion.briefing,
        creativeAngle: creativeAngle.trim().slice(0, 160) || suggestion.creativeAngle,
        relevanceScore: Math.max(
          suggestion.relevanceScore,
          Math.round(40 + score * 55),
        ),
      },
      keep: true,
      score,
    };
  });

  const keptHead = rankedHead
    .filter((row) => row.keep)
    .sort((left, right) => right.score - left.score)
    .map((row) => row.suggestion);

  return {
    suggestions: [...keptHead, ...tail, ...opposition].sort(
      (left, right) => right.relevanceScore - left.relevanceScore,
    ),
    stats,
  };
}
