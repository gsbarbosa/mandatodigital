import { createHash } from "node:crypto";

import {
  clusterScoredArticles,
  countUniqueOutlets,
  fetchSentinelNewsItems,
  matchSentinelThemes,
  scoreSentinelArticle,
  type RssNewsItem,
} from "@/lib/sentinel-rss";
import type { MockSentinelSuggestion, SentinelNewsArticle } from "@/lib/sentinel-mock-suggestions";
import type { PoliticianProfile } from "@/lib/types";

const CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_SUGGESTIONS = 5;
const MAX_ARTICLES_PER_SUGGESTION = 4;

export type SentinelSuggestionsMeta = {
  source: "google-news-rss+portals";
  cached: boolean;
  refreshedAt: string;
  radarThemesCount: number;
  articlesScanned: number;
  portalsMonitored: number;
  emptyReason?: string;
};

type SentinelCacheEntry = {
  suggestions: MockSentinelSuggestion[];
  meta: SentinelSuggestionsMeta;
  expiresAt: number;
};

const suggestionCache = new Map<string, SentinelCacheEntry>();

function buildSuggestionId(link: string) {
  const hash = createHash("sha256").update(link).digest("hex").slice(0, 16);
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

function buildSuggestionFromCluster(input: {
  primary: RssNewsItem;
  articles: RssNewsItem[];
  themeLabel: string;
  matchedThemes: string[];
  relevanceScore: number;
  sourceList: "interest" | "opposition";
}): MockSentinelSuggestion {
  const { primary, articles, themeLabel, matchedThemes, relevanceScore, sourceList } = input;
  const outletCount = countUniqueOutlets(articles);
  const sortedArticles = [...articles]
    .sort((left, right) => {
      const leftTime = left.publishedAt?.getTime() ?? 0;
      const rightTime = right.publishedAt?.getTime() ?? 0;
      return rightTime - leftTime;
    })
    .slice(0, MAX_ARTICLES_PER_SUGGESTION);

  return {
    id: buildSuggestionId(primary.link),
    themeLabel,
    matchedThemes,
    relevanceScore,
    topic: buildTopicLabel(themeLabel, primary.title),
    evidence: {
      postsAnalyzed: articles.length,
      outletCount,
      engagementTrendPercent: 0,
      byNetwork: [],
      actors: [],
      articles: sortedArticles.map(toNewsArticle),
    },
    engagement: {
      relevanceScore,
      scoreTrendPercent: Math.min(99, Math.max(0, (outletCount - 1) * 18)),
      likes: 0,
      comments: 0,
      shares: 0,
      postsAnalyzed: articles.length,
      sources: [],
      byNetwork: [],
    },
  };
}

function resolveSourceList(input: {
  matchedInterest: string[];
  matchedOpposition: string[];
  article: RssNewsItem;
}): "interest" | "opposition" {
  if (input.article.siteList === "opposition") {
    return "opposition";
  }

  if (
    input.matchedOpposition.length > 0 &&
    input.matchedInterest.length === 0
  ) {
    return "opposition";
  }

  return "interest";
}

export function buildSuggestionsFromArticles(
  articles: RssNewsItem[],
  profile: PoliticianProfile,
): MockSentinelSuggestion[] {
  const interestThemes = [
    ...profile.sentinelThemes,
    ...profile.customRadarThemes.map((theme) => theme.trim()).filter(Boolean),
  ];
  const oppositionThemes = profile.oppositionThemes;

  const scored = articles
    .map((article) => {
      const haystack = `${article.title} ${article.sourceName ?? ""} ${article.siteHost ?? ""}`;
      const matchedInterest = matchSentinelThemes(haystack, interestThemes);
      const matchedOpposition = matchSentinelThemes(haystack, oppositionThemes);
      const matchedThemes = [...new Set([...matchedInterest, ...matchedOpposition])];

      if (matchedThemes.length === 0) {
        return null;
      }

      const themeLabel = matchedInterest[0] ?? matchedOpposition[0] ?? matchedThemes[0];
      const sourceList = resolveSourceList({ matchedInterest, matchedOpposition, article });

      return {
        article,
        themeLabel,
        matchedThemes,
        sourceList,
        relevanceScore: 0,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const clusters = clusterScoredArticles(scored);
  const suggestions: MockSentinelSuggestion[] = [];

  for (const bucket of clusters) {
    const articlesInCluster = bucket.map((item) => item.article);
    const outletCount = countUniqueOutlets(articlesInCluster);
    const primaryItem = [...bucket].sort((left, right) => {
      const leftScore = scoreSentinelArticle(
        left.article,
        profile,
        matchSentinelThemes(
          `${left.article.title} ${left.article.sourceName ?? ""}`,
          interestThemes,
        ),
        matchSentinelThemes(
          `${left.article.title} ${left.article.sourceName ?? ""}`,
          oppositionThemes,
        ),
        { articleCount: articlesInCluster.length, outletCount },
      );
      const rightScore = scoreSentinelArticle(
        right.article,
        profile,
        matchSentinelThemes(
          `${right.article.title} ${right.article.sourceName ?? ""}`,
          interestThemes,
        ),
        matchSentinelThemes(
          `${right.article.title} ${right.article.sourceName ?? ""}`,
          oppositionThemes,
        ),
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

    const relevanceScore = scoreSentinelArticle(
      primaryItem.article,
      profile,
      matchedInterest,
      matchedOpposition,
      { articleCount: articlesInCluster.length, outletCount },
    );

    suggestions.push(
      buildSuggestionFromCluster({
        primary: primaryItem.article,
        articles: articlesInCluster,
        themeLabel: primaryItem.themeLabel,
        matchedThemes: primaryItem.matchedThemes,
        relevanceScore,
        sourceList: primaryItem.sourceList,
      }),
    );
  }

  return suggestions
    .sort((left, right) => right.relevanceScore - left.relevanceScore)
    .slice(0, MAX_SUGGESTIONS);
}

function getRadarThemesCount(profile: PoliticianProfile) {
  return (
    profile.sentinelThemes.length +
    profile.customRadarThemes.filter((theme) => theme.trim()).length
  );
}

function countMonitoredPortals(profile: PoliticianProfile) {
  const hosts = new Set(
    [...profile.interestSites, ...profile.oppositionSites]
      .map((site) => site.trim())
      .filter(Boolean),
  );
  return hosts.size;
}

function buildEmptyMeta(
  profile: PoliticianProfile,
  options?: { emptyReason?: string; articlesScanned?: number },
): SentinelSuggestionsMeta {
  return {
    source: "google-news-rss+portals",
    cached: false,
    refreshedAt: new Date().toISOString(),
    radarThemesCount: getRadarThemesCount(profile),
    articlesScanned: options?.articlesScanned ?? 0,
    portalsMonitored: countMonitoredPortals(profile),
    emptyReason: options?.emptyReason,
  };
}

export function invalidateSentinelCache(profileId: string) {
  suggestionCache.delete(profileId);
}

export async function getSentinelSuggestions(
  profile: PoliticianProfile,
  options?: { forceRefresh?: boolean },
) {
  const cacheKey = profile.id || "default";
  const cached = suggestionCache.get(cacheKey);
  const now = Date.now();

  if (!options?.forceRefresh && cached && cached.expiresAt > now) {
    return {
      suggestions: cached.suggestions,
      meta: { ...cached.meta, cached: true },
    };
  }

  const radarThemesCount = getRadarThemesCount(profile);
  const portalsMonitored = countMonitoredPortals(profile);

  if (radarThemesCount === 0 && portalsMonitored === 0) {
    const meta = buildEmptyMeta(profile, {
      emptyReason: "Configure temas de interesse ou portais no radar do Sentinela.",
    });
    return { suggestions: [], meta };
  }

  const articles = await fetchSentinelNewsItems(profile);
  const suggestions = buildSuggestionsFromArticles(articles, profile);

  const meta: SentinelSuggestionsMeta = {
    source: "google-news-rss+portals",
    cached: false,
    refreshedAt: new Date().toISOString(),
    radarThemesCount,
    articlesScanned: articles.length,
    portalsMonitored,
    emptyReason:
      suggestions.length === 0
        ? "Nenhuma materia recente encontrada para os temas e portais configurados."
        : undefined,
  };

  suggestionCache.set(cacheKey, {
    suggestions,
    meta,
    expiresAt: now + CACHE_TTL_MS,
  });

  return { suggestions, meta };
}

export async function getSentinelSuggestionById(
  profile: PoliticianProfile,
  suggestionId: string,
  options?: { forceRefresh?: boolean },
) {
  const { suggestions } = await getSentinelSuggestions(profile, options);
  return suggestions.find((suggestion) => suggestion.id === suggestionId) ?? null;
}

export function filterMockSentinelSuggestions(
  profile: PoliticianProfile,
  mocks: MockSentinelSuggestion[],
) {
  const radarThemes = new Set(
    [
      ...profile.sentinelThemes,
      ...profile.customRadarThemes.map((theme) => theme.trim()).filter(Boolean),
    ].map((theme) => theme.toLowerCase()),
  );

  if (radarThemes.size === 0) {
    return [];
  }

  return mocks.filter((suggestion) =>
    suggestion.matchedThemes.some((theme) => radarThemes.has(theme.toLowerCase())),
  );
}
