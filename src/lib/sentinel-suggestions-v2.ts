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
import { filterGeoExpansionTerms } from "@/lib/sentinel-theme-expansion";
import { pickBestMatchedTheme } from "@/lib/sentinel-theme-synonyms";
import {
  applyThemeVerificationBatch,
  type ThemeVerificationStats,
} from "@/lib/sentinel-theme-verify";
import { splitProfileThemesBySphere } from "@/lib/sentinel-profile-themes";
import type { PoliticianProfile } from "@/lib/types";

const MAX_SUGGESTIONS = 20;
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
  article: RssNewsItem;
}): "interest" | "opposition" {
  if (input.article.siteList === "interest") {
    return "interest";
  }

  return "interest";
}

type ClassifiedArticle = ScoredArticle & {
  pipeline: SentinelPipeline;
};

function mapExpandedToSourceThemes(
  matchedExpanded: string[],
  expansionByTerm: Map<string, string>,
): string[] {
  return [
    ...new Set(
      matchedExpanded
        .map((term) => expansionByTerm.get(term.toLowerCase()))
        .filter((theme): theme is string => Boolean(theme)),
    ),
  ];
}

function pickThemeLabel(
  haystack: string,
  themes: {
    federal: string[];
    estadual: string[];
    custom: string[];
    fromExpansion: string[];
  },
): string {
  const candidates = [
    ...themes.federal,
    ...themes.estadual,
    ...themes.custom,
    ...themes.fromExpansion,
  ];

  return pickBestMatchedTheme(haystack, [...new Set(candidates)]);
}

function classifyArticle(
  article: RssNewsItem,
  profile: PoliticianProfile,
  context: V2BuildContext,
): ClassifiedArticle | null {
  const haystack = `${article.title} ${article.sourceName ?? ""} ${article.siteHost ?? ""}`;
  const themes = splitProfileThemesBySphere(profile);
  const expansionByTerm = buildExpansionTermMap(context.expansions);

  const matchedCustom = matchLiteralThemes(haystack, themes.municipalCustom);
  const matchedExpanded = filterGeoExpansionTerms(
    matchExpandedTerms(haystack, context.expandedTerms),
    profile,
  );
  const matchedFromExpansion = mapExpandedToSourceThemes(matchedExpanded, expansionByTerm);
  const matchedFederal = matchSentinelThemes(haystack, themes.federal);
  const matchedEstadual = matchSentinelThemes(haystack, themes.estadual);
  const matchedInterest = [
    ...new Set([...matchedFederal, ...matchedEstadual, ...matchedCustom]),
  ];
  const matchedThemes = [
    ...new Set([...matchedInterest, ...matchedFromExpansion]),
  ];

  if (matchedThemes.length === 0) {
    return null;
  }

  const sourceList = resolveSourceList({ matchedInterest, article });
  const themeLabel = pickThemeLabel(haystack, {
    federal: matchedFederal,
    estadual: matchedEstadual,
    custom: matchedCustom,
    fromExpansion: matchedFromExpansion,
  });

  if (!themeLabel) {
    return null;
  }

  let pipeline: SentinelPipeline = "semantic";

  if (isPortalOriginArticle(article)) {
    pipeline = "portal";
  } else if (matchedCustom.length > 0) {
    pipeline = "manual";
  } else if (matchedFromExpansion.length > 0 && matchedInterest.length === 0) {
    pipeline = "semantic";
  } else {
    pipeline = "semantic";
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

function mergeSuggestionsById(suggestions: MockSentinelSuggestion[]) {
  const byId = new Map<string, MockSentinelSuggestion>();

  for (const suggestion of suggestions) {
    const existing = byId.get(suggestion.id);
    if (!existing || suggestion.relevanceScore > existing.relevanceScore) {
      byId.set(suggestion.id, suggestion);
    }
  }

  return [...byId.values()]
    .sort((left, right) => right.relevanceScore - left.relevanceScore)
    .slice(0, MAX_SUGGESTIONS);
}

export async function buildV2SuggestionsFromArticles(
  articles: RssNewsItem[],
  profile: PoliticianProfile,
  context: V2BuildContext,
): Promise<{
  suggestions: MockSentinelSuggestion[];
  themeVerificationStats?: ThemeVerificationStats;
}> {
  const ruleClassified = articles
    .map((article) => classifyArticle(article, profile, context))
    .filter((item): item is ClassifiedArticle => item !== null);

  const verificationInput = ruleClassified.map((item) => ({
    article: item.article,
    haystack: `${item.article.title} ${item.article.sourceName ?? ""} ${item.article.siteHost ?? ""}`,
    themeLabel: item.themeLabel,
    matchedThemes: item.matchedThemes,
  }));

  const { items: verifiedItems, stats: themeVerificationStats } =
    await applyThemeVerificationBatch(verificationInput);

  const classifiedByKey = new Map(
    ruleClassified.map((item) => [`${item.article.title}|${item.article.link}`, item]),
  );
  const mergedClassified: ClassifiedArticle[] = verifiedItems.map((verified) => {
    const key = `${verified.article.title}|${verified.article.link}`;
    const original = classifiedByKey.get(key);
    return {
      article: verified.article,
      themeLabel: verified.themeLabel,
      matchedThemes: verified.matchedThemes,
      sourceList: original?.sourceList ?? "interest",
      relevanceScore: original?.relevanceScore ?? 0,
      pipeline: original?.pipeline ?? "semantic",
    };
  });

  const themes = splitProfileThemesBySphere(profile);
  const interestThemes = themes.interest;

  const clusters = clusterScoredArticles(mergedClassified);
  const suggestions: MockSentinelSuggestion[] = [];

  for (const bucket of clusters) {
    const articlesInCluster = bucket.map((item) => item.article);
    const outletCount = countUniqueOutlets(articlesInCluster);
    const primaryItem = [...bucket].sort((left, right) => {
      const leftScore = scoreSentinelArticle(
        left.article,
        profile,
        matchSentinelThemes(`${left.article.title} ${left.article.sourceName ?? ""}`, interestThemes),
        [],
        { articleCount: articlesInCluster.length, outletCount },
      );
      const rightScore = scoreSentinelArticle(
        right.article,
        profile,
        matchSentinelThemes(`${right.article.title} ${right.article.sourceName ?? ""}`, interestThemes),
        [],
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

    const baseScore = scoreSentinelArticle(
      primaryItem.article,
      profile,
      matchedInterest,
      [],
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

  return {
    suggestions: mergeSuggestionsById(suggestions),
    themeVerificationStats,
  };
}
