import { createHash } from "node:crypto";

import { buildSocialSuggestions, mergeSentinelSuggestions } from "@/lib/sentinel-social-suggestions";
import { correlateSocialSuggestionsWithRss } from "@/lib/sentinel-social-cross-match";
import {
  enrichSentinelSuggestions,
  sortSentinelSuggestionsForDisplay,
} from "@/lib/sentinel-enrich";
import { partitionSentinelSuggestions } from "@/lib/sentinel-editorial-gate";
import {
  isSentinelLlmEnrichEnabled,
  isSentinelSocialEnabled,
  isSentinelV2PipelinesEnabled,
} from "@/lib/feature-flags";
import { preloadPlatformCredentials } from "@/lib/platform-credentials";
import {
  clusterScoredArticles,
  countUniqueOutlets,
  fetchSemanticExpansionNewsItems,
  fetchSentinelNewsItems,
  matchSentinelThemes,
  scoreSentinelArticle,
  type RssNewsItem,
} from "@/lib/sentinel-rss";
import type { MockSentinelSuggestion, SentinelNewsArticle } from "@/lib/sentinel-mock-suggestions";
import {
  flattenExpansionSearchTerms,
  loadSentinelThemeExpansionsForProfile,
} from "@/lib/sentinel-theme-expansion";
import { buildV2SuggestionsFromArticles } from "@/lib/sentinel-suggestions-v2";
import {
  filterArticlesMatchingProfileRadar,
  guardSuggestionsForProfile,
} from "@/lib/sentinel-theme-relevance";
import type { PoliticianProfile } from "@/lib/types";
import {
  isSentinelCacheExpired,
  sentinelStorage,
} from "@/lib/sentinel-storage";
import type { SentinelSuggestionsMeta } from "@/lib/sentinel-types";

export type { SentinelSuggestionsMeta } from "@/lib/sentinel-types";

const CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_SUGGESTIONS = 5;
const MAX_ARTICLES_PER_SUGGESTION = 4;

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
    profile.customRadarThemes.filter((theme) => theme.trim()).length +
    profile.oppositionThemes.length
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
  options?: {
    emptyReason?: string;
    articlesScanned?: number;
    pipelinesEnabled?: boolean;
    expansionTermsCount?: number;
  },
): SentinelSuggestionsMeta {
  return {
    source: options?.pipelinesEnabled ? "sentinel-v2-pipelines" : "google-news-rss+portals",
    cached: false,
    refreshedAt: new Date().toISOString(),
    radarThemesCount: getRadarThemesCount(profile),
    articlesScanned: options?.articlesScanned ?? 0,
    portalsMonitored: countMonitoredPortals(profile),
    pipelinesEnabled: options?.pipelinesEnabled,
    expansionTermsCount: options?.expansionTermsCount,
    emptyReason: options?.emptyReason,
  };
}

export function invalidateSentinelCache(profileId: string) {
  suggestionCache.delete(profileId);
  if (isPersistableProfileId(profileId)) {
    void sentinelStorage.clearCache(profileId);
  }
}

function isPersistableProfileId(profileId: string) {
  return profileId.trim().length > 0 && profileId !== "default";
}

async function readCachedSuggestions(cacheKey: string, forceRefresh?: boolean) {
  if (forceRefresh) {
    return null;
  }

  const memoryCached = suggestionCache.get(cacheKey);
  const now = Date.now();
  if (memoryCached && memoryCached.expiresAt > now) {
    return memoryCached;
  }

  if (!isPersistableProfileId(cacheKey)) {
    return null;
  }

  const persisted = await sentinelStorage.readCache(cacheKey);
  if (!persisted || isSentinelCacheExpired(persisted, now)) {
    return null;
  }

  const entry: SentinelCacheEntry = {
    suggestions: persisted.suggestions,
    meta: persisted.meta,
    expiresAt: Date.parse(persisted.expiresAt),
  };

  suggestionCache.set(cacheKey, entry);
  return entry;
}

async function persistSuggestionsCache(
  cacheKey: string,
  suggestions: MockSentinelSuggestion[],
  meta: SentinelSuggestionsMeta,
  expiresAt: number,
) {
  suggestionCache.set(cacheKey, {
    suggestions,
    meta,
    expiresAt,
  });

  if (!isPersistableProfileId(cacheKey)) {
    return;
  }

  await sentinelStorage.writeCache(cacheKey, {
    suggestions,
    meta,
    expiresAt: new Date(expiresAt).toISOString(),
  });

  await sentinelStorage.appendSignalHistory(cacheKey, suggestions, meta.refreshedAt);
}

async function collectSentinelArticles(profile: PoliticianProfile) {
  const v2Enabled = isSentinelV2PipelinesEnabled();
  const baseArticles = await fetchSentinelNewsItems(profile);

  if (!v2Enabled) {
    return { articles: baseArticles, expansions: [], expandedTerms: [] };
  }

  const profileId = profile.id?.trim() || "default";
  const expansions = await loadSentinelThemeExpansionsForProfile(profile);
  const expandedTerms = flattenExpansionSearchTerms(expansions);
  const semanticArticles = await fetchSemanticExpansionNewsItems(profile, expandedTerms);

  const seen = new Set<string>();
  const articles: RssNewsItem[] = [];

  for (const item of [...baseArticles, ...semanticArticles]) {
    const key = `${item.title}|${item.link}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    articles.push(item);
  }

  return { articles, expansions, expandedTerms };
}

async function buildSuggestions(
  profile: PoliticianProfile,
  articles: RssNewsItem[],
  bundle: Awaited<ReturnType<typeof collectSentinelArticles>>,
) {
  if (!isSentinelV2PipelinesEnabled()) {
    return buildSuggestionsFromArticles(articles, profile);
  }

  const profileId = profile.id?.trim() || "default";
  const geoLabel = [profile.city.trim(), profile.state.trim()].filter(Boolean).join(", ") || "Brasil";

  return buildV2SuggestionsFromArticles(articles, profile, {
    profileId,
    geoLabel,
    expansions: bundle.expansions,
    expandedTerms: bundle.expandedTerms,
  });
}

export async function getSentinelSuggestions(
  profile: PoliticianProfile,
  options?: { forceRefresh?: boolean; cacheOnly?: boolean },
) {
  if (!options?.cacheOnly) {
    await preloadPlatformCredentials(["apify", "openai", "anthropic", "heygen", "serpapi"]);
  }

  const cacheKey = profile.id || "default";
  const cached = await readCachedSuggestions(cacheKey, options?.forceRefresh);

  if (cached) {
    return {
      suggestions: cached.suggestions,
      meta: { ...cached.meta, cached: true },
    };
  }

  if (options?.cacheOnly) {
    const radarThemesCount = getRadarThemesCount(profile);
    const portalsMonitored = countMonitoredPortals(profile);

    if (radarThemesCount === 0 && portalsMonitored === 0) {
      return {
        suggestions: [],
        meta: buildEmptyMeta(profile, {
          emptyReason: "Configure temas ou portais em Configurações › Radar antes de buscar sinais.",
          pipelinesEnabled: isSentinelV2PipelinesEnabled(),
        }),
      };
    }

    return {
      suggestions: [],
      meta: buildEmptyMeta(profile, {
        emptyReason:
          "Nenhum sinal em cache. Clique em «Atualizar sinais» para buscar pautas recentes.",
        pipelinesEnabled: isSentinelV2PipelinesEnabled(),
      }),
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

  const articlesBundle = await collectSentinelArticles(profile);
  const articlesMatchedRadar = filterArticlesMatchingProfileRadar(
    articlesBundle.articles,
    profile,
  ).length;
  let suggestions = await buildSuggestions(profile, articlesBundle.articles, articlesBundle);

  let socialProfilesScanned = 0;
  let socialPostsScanned = 0;

  if (isSentinelSocialEnabled()) {
    const social = await buildSocialSuggestions(profile);
    socialProfilesScanned = social.profilesScanned;
    socialPostsScanned = social.postsScanned;

    const socialCorrelated = correlateSocialSuggestionsWithRss(
      social.suggestions,
      suggestions,
    );
    const { opportunities: socialOpportunities, monitoring: socialMonitoring } =
      partitionSentinelSuggestions(socialCorrelated);

    suggestions = mergeSentinelSuggestions([suggestions, socialOpportunities]);
    suggestions = [
      ...suggestions,
      ...socialMonitoring.slice(0, 3),
    ];
  }

  suggestions = await enrichSentinelSuggestions(profile, suggestions);
  suggestions = sortSentinelSuggestionsForDisplay(suggestions).slice(0, MAX_SUGGESTIONS + 3);

  const guarded = guardSuggestionsForProfile(suggestions, profile);
  suggestions = guarded.suggestions;
  const v2Enabled = isSentinelV2PipelinesEnabled();

  const meta: SentinelSuggestionsMeta = {
    source: v2Enabled ? "sentinel-v2-pipelines" : "google-news-rss+portals",
    cached: false,
    refreshedAt: new Date().toISOString(),
    radarThemesCount,
    articlesScanned: articlesBundle.articles.length,
    articlesMatchedRadar,
    portalsMonitored,
    pipelinesEnabled: v2Enabled,
    expansionTermsCount: articlesBundle.expandedTerms.length,
    socialProfilesScanned: socialProfilesScanned > 0 ? socialProfilesScanned : undefined,
    socialPostsScanned: socialPostsScanned > 0 ? socialPostsScanned : undefined,
    socialEnabled: isSentinelSocialEnabled() || undefined,
    enrichmentEnabled: isSentinelLlmEnrichEnabled() || undefined,
    themeViolationsFiltered: guarded.removedCount > 0 ? guarded.removedCount : undefined,
    emptyReason:
      suggestions.length === 0
        ? articlesBundle.articles.length === 0
          ? "Nenhuma materia recente encontrada para os temas e portais configurados."
          : articlesMatchedRadar === 0
            ? "Matérias encontradas não correspondem aos temas selecionados no radar."
            : "Nenhuma materia recente encontrada para os temas e portais configurados."
        : undefined,
  };

  const expiresAt = Date.now() + CACHE_TTL_MS;
  await persistSuggestionsCache(cacheKey, suggestions, meta, expiresAt);

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
