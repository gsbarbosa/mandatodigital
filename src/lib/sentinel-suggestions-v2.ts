import { createHash } from "node:crypto";

import {
  applyPipelineWeight,
  type SentinelPipeline,
} from "@/lib/sentinel-pipeline";
import type { MockSentinelSuggestion, SentinelNewsArticle } from "@/lib/sentinel-mock-suggestions";
import {
  clusterScoredArticles,
  countUniqueOutlets,
  isPortalOriginArticle,
  matchLiteralThemes,
  matchSentinelThemes,
  scoreSentinelArticle,
  type RssNewsItem,
  type ScoredArticle,
} from "@/lib/sentinel-rss";
import { applyTrendScoreBoost, resolveThemeVolumeTrend } from "@/lib/sentinel-trends";
import type { SentinelThemeExpansion } from "@/lib/sentinel-theme-expansion";
import { mergeSentinelSuggestions } from "@/lib/sentinel-social-suggestions";
import type { PoliticianProfile } from "@/lib/types";

const MAX_SUGGESTIONS = 5;
const MAX_ARTICLES_PER_SUGGESTION = 4;

type V2BuildContext = {
  profileId: string;
  geoLabel: string;
  expansions: SentinelThemeExpansion[];
  expandedTerms: string[];
};

function buildSuggestionId(link: string, pipeline: SentinelPipeline) {
  const hash = createHash("sha256").update(`${pipeline}|${link}`).digest("hex").slice(0, 16);
  return `sentinela-rss-${hash}`;
}

function buildTopicLabel(themeLabel: string, articleTitle: string) {
  const trimmedTitle = articleTitle.trim();
  if (!themeLabel) {
    return trimmedTitle.slice(0, 120);
  }

  const prefix = `${themeLabel} · `;
  const maxTitleLength = Math.max(20, 120 - prefix.length);
  return `${prefix}${trimmedTitle.slice(0, maxTitleLength)}`;
}

function toNewsArticle(article: RssNewsItem): SentinelNewsArticle {
  return {
    title: article.title,
    url: article.link,
    sourceName: article.sourceName ?? article.siteHost,
    publishedAt: article.pubDate ?? undefined,
  };
}

function buildExpansionTermMap(expansions: SentinelThemeExpansion[]) {
  const map = new Map<string, string>();

  for (const expansion of expansions) {
    for (const term of expansion.expandedTerms) {
      map.set(term.toLowerCase(), expansion.sourceTheme);
    }
  }

  return map;
}

function matchExpandedTerms(text: string, expandedTerms: string[]) {
  const normalized = text.toLowerCase();
  const matches: string[] = [];

  for (const term of expandedTerms) {
    const key = term.toLowerCase();
    if (key.length >= 3 && normalized.includes(key)) {
      matches.push(term);
    }
  }

  return matches;
}

function resolveSourceList(input: {
  matchedInterest: string[];
  matchedOpposition: string[];
  article: RssNewsItem;
}): "interest" | "opposition" {
  if (input.article.siteList === "opposition") {
    return "opposition";
  }

  if (input.matchedOpposition.length > 0 && input.matchedInterest.length === 0) {
    return "opposition";
  }

  return "interest";
}

type ClassifiedArticle = ScoredArticle & {
  pipeline: SentinelPipeline;
};

function classifyArticle(
  article: RssNewsItem,
  profile: PoliticianProfile,
  context: V2BuildContext,
): ClassifiedArticle | null {
  const haystack = `${article.title} ${article.sourceName ?? ""} ${article.siteHost ?? ""}`;
  const customThemes = profile.customRadarThemes.map((theme) => theme.trim()).filter(Boolean);
  const interestThemes = [...profile.sentinelThemes, ...customThemes];
  const oppositionThemes = profile.oppositionThemes;

  const matchedCustom = matchLiteralThemes(haystack, customThemes);
  const matchedExpanded = matchExpandedTerms(haystack, context.expandedTerms);
  const matchedInterest = matchSentinelThemes(haystack, interestThemes);
  const matchedOpposition = matchSentinelThemes(haystack, oppositionThemes);
  const matchedThemes = [...new Set([...matchedCustom, ...matchedExpanded, ...matchedInterest, ...matchedOpposition])];

  if (matchedThemes.length === 0) {
    return null;
  }

  const sourceList = resolveSourceList({ matchedInterest, matchedOpposition, article });
  const expansionByTerm = buildExpansionTermMap(context.expansions);

  let pipeline: SentinelPipeline = "semantic";
  let themeLabel = matchedThemes[0] ?? "";

  if (isPortalOriginArticle(article)) {
    pipeline = "portal";
    themeLabel = matchedInterest[0] ?? matchedOpposition[0] ?? matchedCustom[0] ?? themeLabel;
  } else if (matchedCustom.length > 0) {
    pipeline = "manual";
    themeLabel = matchedCustom[0] ?? themeLabel;
  } else if (matchedExpanded.length > 0) {
    pipeline = "semantic";
    themeLabel =
      expansionByTerm.get(matchedExpanded[0]?.toLowerCase() ?? "") ??
      matchedInterest[0] ??
      themeLabel;
  } else {
    pipeline = "semantic";
    themeLabel = matchedInterest[0] ?? matchedOpposition[0] ?? themeLabel;
  }

  return {
    article,
    themeLabel,
    matchedThemes,
    sourceList,
    relevanceScore: 0,
    pipeline,
  };
}

async function buildSuggestionFromCluster(input: {
  primary: RssNewsItem;
  articles: RssNewsItem[];
  themeLabel: string;
  matchedThemes: string[];
  relevanceScore: number;
  pipeline: SentinelPipeline;
  profileId: string;
  geoLabel: string;
}): Promise<MockSentinelSuggestion> {
  const { primary, articles, themeLabel, matchedThemes, pipeline, profileId, geoLabel } = input;
  const outletCount = countUniqueOutlets(articles);
  const sortedArticles = [...articles]
    .sort((left, right) => {
      const leftTime = left.publishedAt?.getTime() ?? 0;
      const rightTime = right.publishedAt?.getTime() ?? 0;
      return rightTime - leftTime;
    })
    .slice(0, MAX_ARTICLES_PER_SUGGESTION);

  const searchTrend = await resolveThemeVolumeTrend({
    profileId,
    themeLabel,
    geoLabel,
  });

  const weightedScore = applyPipelineWeight(input.relevanceScore, pipeline);
  const relevanceScore = applyTrendScoreBoost(weightedScore, searchTrend);

  return {
    id: buildSuggestionId(primary.link, pipeline),
    themeLabel,
    matchedThemes,
    relevanceScore,
    pipeline,
    topic: buildTopicLabel(themeLabel, primary.title),
    evidence: {
      postsAnalyzed: articles.length,
      outletCount,
      engagementTrendPercent: searchTrend?.changePercent ?? 0,
      searchTrend: searchTrend ?? undefined,
      byNetwork: [],
      actors: [],
      articles: sortedArticles.map(toNewsArticle),
    },
    engagement: {
      relevanceScore,
      scoreTrendPercent: searchTrend?.changePercent ?? Math.min(99, Math.max(0, (outletCount - 1) * 18)),
      likes: 0,
      comments: 0,
      shares: 0,
      postsAnalyzed: articles.length,
      sources: [],
      byNetwork: [],
    },
  };
}

export async function buildV2SuggestionsFromArticles(
  articles: RssNewsItem[],
  profile: PoliticianProfile,
  context: V2BuildContext,
): Promise<MockSentinelSuggestion[]> {
  const classified = articles
    .map((article) => classifyArticle(article, profile, context))
    .filter((item): item is ClassifiedArticle => item !== null);

  const interestThemes = [
    ...profile.sentinelThemes,
    ...profile.customRadarThemes.map((theme) => theme.trim()).filter(Boolean),
  ];
  const oppositionThemes = profile.oppositionThemes;

  const clusters = clusterScoredArticles(classified);
  const suggestions: MockSentinelSuggestion[] = [];

  for (const bucket of clusters) {
    const articlesInCluster = bucket.map((item) => item.article);
    const outletCount = countUniqueOutlets(articlesInCluster);
    const primaryItem = [...bucket].sort((left, right) => {
      const leftScore = scoreSentinelArticle(
        left.article,
        profile,
        matchSentinelThemes(`${left.article.title} ${left.article.sourceName ?? ""}`, interestThemes),
        matchSentinelThemes(`${left.article.title} ${left.article.sourceName ?? ""}`, oppositionThemes),
        { articleCount: articlesInCluster.length, outletCount },
      );
      const rightScore = scoreSentinelArticle(
        right.article,
        profile,
        matchSentinelThemes(`${right.article.title} ${right.article.sourceName ?? ""}`, interestThemes),
        matchSentinelThemes(`${right.article.title} ${right.article.sourceName ?? ""}`, oppositionThemes),
        { articleCount: articlesInCluster.length, outletCount },
      );
      return rightScore - leftScore;
    })[0];

    if (!primaryItem) {
      continue;
    }

    const matchedInterest = matchSentinelThemes(
      `${primaryItem.article.title} ${primaryItem.article.sourceName ?? ""}`,
      interestThemes,
    );
    const matchedOpposition = matchSentinelThemes(
      `${primaryItem.article.title} ${primaryItem.article.sourceName ?? ""}`,
      oppositionThemes,
    );

    const baseScore = scoreSentinelArticle(
      primaryItem.article,
      profile,
      matchedInterest,
      matchedOpposition,
      { articleCount: articlesInCluster.length, outletCount },
    );

    suggestions.push(
      await buildSuggestionFromCluster({
        primary: primaryItem.article,
        articles: articlesInCluster,
        themeLabel: primaryItem.themeLabel,
        matchedThemes: primaryItem.matchedThemes,
        relevanceScore: baseScore,
        pipeline: (primaryItem.pipeline as SentinelPipeline | undefined) ?? "semantic",
        profileId: context.profileId,
        geoLabel: context.geoLabel,
      }),
    );
  }

  return mergeSentinelSuggestions([suggestions], MAX_SUGGESTIONS);
}
