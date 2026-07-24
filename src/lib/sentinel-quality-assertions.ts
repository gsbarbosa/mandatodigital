import type { MockSentinelSuggestion } from "@/lib/sentinel-mock-suggestions";
import type { SentinelSuggestionsMeta } from "@/lib/sentinel-types";
import { isLikelyJobListingTitle, isWeakFakeNewsTitle } from "@/lib/sentinel-title-filters";

export type SentinelFeedQualityInput = {
  suggestions: MockSentinelSuggestion[];
  meta?: SentinelSuggestionsMeta | null;
};

export type SentinelFeedQualityReport = {
  ok: boolean;
  failures: string[];
  stats: {
    total: number;
    newsTotal: number;
    withBriefing: number;
    jobListings: number;
    weakFakeNews: number;
    distinctThemes: number;
    maxThemeShare: number;
    rankLlmCalls: number;
    rankDropped: number;
  };
};

function isOpposition(suggestion: MockSentinelSuggestion) {
  return (suggestion.evidence.actors ?? []).some((actor) => actor.sourceList === "opposition");
}

function primaryTitle(suggestion: MockSentinelSuggestion) {
  return suggestion.evidence.articles?.[0]?.title?.trim() || suggestion.topic;
}

/**
 * Gates determinísticos de qualidade do feed — usados pelo script CLI e pelos e2e.
 * Não substitui amostragem humana; evita regressão óbvia (Sine, monotema, rank morto).
 */
export function evaluateSentinelFeedQuality(
  input: SentinelFeedQualityInput,
  options: {
    requireBriefingWhenRanked?: boolean;
    maxJobListingRatio?: number;
    maxThemeShare?: number;
    minCards?: number;
    expectQualityRank?: boolean;
  } = {},
): SentinelFeedQualityReport {
  const requireBriefingWhenRanked = options.requireBriefingWhenRanked !== false;
  const maxJobListingRatio = options.maxJobListingRatio ?? 0.25;
  const maxThemeShare = options.maxThemeShare ?? 0.55;
  const minCards = options.minCards ?? 3;
  const expectQualityRank = Boolean(options.expectQualityRank);

  const failures: string[] = [];
  const suggestions = input.suggestions ?? [];
  const news = suggestions.filter((item) => !isOpposition(item));

  let jobListings = 0;
  let weakFakeNews = 0;
  let withBriefing = 0;
  const themeCounts = new Map<string, number>();

  for (const suggestion of news) {
    const title = primaryTitle(suggestion);
    if (isLikelyJobListingTitle(title)) {
      jobListings += 1;
    }
    if (isWeakFakeNewsTitle(title)) {
      weakFakeNews += 1;
    }
    if (suggestion.briefing?.trim() || suggestion.creativeAngle?.trim()) {
      withBriefing += 1;
    }
    const theme = suggestion.themeLabel.trim() || "(sem tema)";
    themeCounts.set(theme, (themeCounts.get(theme) ?? 0) + 1);
  }

  const distinctThemes = themeCounts.size;
  const maxThemeCount = Math.max(0, ...themeCounts.values());
  const maxShare = news.length ? maxThemeCount / news.length : 0;
  const rankLlmCalls = input.meta?.qualityRankStats?.llmCalls ?? 0;
  const rankDropped = input.meta?.qualityRankStats?.dropped ?? 0;

  if (news.length < minCards) {
    failures.push(`Poucos cards de notícia: ${news.length} (mín. ${minCards}).`);
  }

  const jobRatio = news.length ? jobListings / news.length : 0;
  if (jobRatio > maxJobListingRatio) {
    failures.push(
      `Classificados de vaga demais: ${(jobRatio * 100).toFixed(0)}% (máx. ${(maxJobListingRatio * 100).toFixed(0)}%).`,
    );
  }

  if (weakFakeNews > 0 && weakFakeNews / Math.max(1, news.length) > 0.2) {
    failures.push(`Fake news genérica demais no feed: ${weakFakeNews}/${news.length}.`);
  }

  if (news.length >= 6 && maxShare > maxThemeShare) {
    failures.push(
      `Feed monotemático: tema dominante ${(maxShare * 100).toFixed(0)}% (máx. ${(maxThemeShare * 100).toFixed(0)}%).`,
    );
  }

  if (expectQualityRank && rankLlmCalls < 1) {
    failures.push("Quality rank esperado, mas meta.qualityRankStats.llmCalls = 0.");
  }

  if (requireBriefingWhenRanked && rankLlmCalls > 0 && withBriefing === 0) {
    failures.push("Rank rodou, mas nenhum card tem briefing/ângulo.");
  }

  return {
    ok: failures.length === 0,
    failures,
    stats: {
      total: suggestions.length,
      newsTotal: news.length,
      withBriefing,
      jobListings,
      weakFakeNews,
      distinctThemes,
      maxThemeShare: Number(maxShare.toFixed(3)),
      rankLlmCalls,
      rankDropped,
    },
  };
}
