import { createHash } from "node:crypto";

import {
  isSentinelV2PipelinesEnabled,
} from "@/lib/feature-flags";
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
  countCatalogPortalHosts,
} from "@/lib/sentinel-portal-catalog";
import {
  splitProfileThemesBySphere,
} from "@/lib/sentinel-profile-themes";
import { buildSocialSentinelSuggestions } from "@/lib/sentinel-social";
import {
  flattenExpansionSearchTerms,
  loadSentinelThemeExpansions,
} from "@/lib/sentinel-theme-expansion";
import { buildV2SuggestionsFromArticles } from "@/lib/sentinel-suggestions-v2";
import type { PoliticianProfile } from "@/lib/types";
import {
  isSentinelCacheExpired,
  sentinelStorage,
} from "@/lib/sentinel-storage";
import type { SentinelSuggestionsMeta } from "@/lib/sentinel-types";

export type { SentinelSuggestionsMeta } from "@/lib/sentinel-types";

const CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_SUGGESTIONS = 20;
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
  article: RssNewsItem;
}): "interest" | "opposition" {
  if (input.article.siteList === "interest") {
    return "interest";
  }

  return "interest";
}

export function buildSuggestionsFromArticles(
  articles: RssNewsItem[],
  profile: PoliticianProfile,
): MockSentinelSuggestion[] {
  const themes = splitProfileThemesBySphere(profile);
  const interestThemes = themes.interest;

  const scored = articles
    .map((article) => {
      const haystack = `${article.title} ${article.sourceName ?? ""} ${article.siteHost ?? ""}`;
      const matchedFederal = matchSentinelThemes(haystack, themes.federal);
      const matchedEstadual = matchSentinelThemes(haystack, themes.estadual);
      const matchedMunicipal = matchSentinelThemes(haystack, themes.municipalCustom);
      const matchedInterest = [
        ...new Set([...matchedFederal, ...matchedEstadual, ...matchedMunicipal]),
      ];
      const matchedThemes = matchedInterest;

      if (matchedThemes.length === 0) {
        return null;
      }

      const themeLabel = matchedThemes[0] ?? "";
      const sourceList = resolveSourceList({ matchedInterest, article });

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
        [],
        { articleCount: articlesInCluster.length, outletCount },
      );
      const rightScore = scoreSentinelArticle(
        right.article,
        profile,
        matchSentinelThemes(
          `${right.article.title} ${right.article.sourceName ?? ""}`,
          interestThemes,
        ),
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

    const relevanceScore = scoreSentinelArticle(
      primaryItem.article,
      profile,
      matchedInterest,
      [],
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
  return splitProfileThemesBySphere(profile).interest.length;
}

function countMonitoredPortals(profile: PoliticianProfile) {
  const themes = splitProfileThemesBySphere(profile);
  const hosts = new Set(
    profile.interestSites.map((site) => site.trim()).filter(Boolean),
  );
  return hosts.size + countCatalogPortalHosts({
    federalThemeCount: themes.federal.length,
    estadualThemeCount: themes.estadual.length,
    state: profile.state,
  });
}

function mergeSuggestions(
  articleSuggestions: MockSentinelSuggestion[],
  socialSuggestions: MockSentinelSuggestion[],
): MockSentinelSuggestion[] {
  const byId = new Map<string, MockSentinelSuggestion>();

  for (const suggestion of [...articleSuggestions, ...socialSuggestions]) {
    const existing = byId.get(suggestion.id);
    if (!existing || suggestion.relevanceScore > existing.relevanceScore) {
      byId.set(suggestion.id, suggestion);
    }
  }

  return [...byId.values()]
    .sort((left, right) => right.relevanceScore - left.relevanceScore)
    .slice(0, MAX_SUGGESTIONS);
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
  const expansions =
    profileId !== "default" ? await loadSentinelThemeExpansions(profileId) : [];
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
  options?: { forceRefresh?: boolean },
) {
  const cacheKey = profile.id || "default";
  const cached = await readCachedSuggestions(cacheKey, options?.forceRefresh);

  if (cached) {
    return {
      suggestions: cached.suggestions,
      meta: { ...cached.meta, cached: true },
    };
  }

  const radarThemesCount = getRadarThemesCount(profile);
  const portalsMonitored = countMonitoredPortals(profile);
  const hasSocialRadar =
    profile.interestProfiles.some((row) => row.handle.trim()) ||
    profile.oppositionProfiles.some((row) => row.handle.trim());

  if (radarThemesCount === 0 && portalsMonitored === 0 && !hasSocialRadar) {
    const meta = buildEmptyMeta(profile, {
      emptyReason: "Configure temas de interesse, portais municipais ou perfis @ no radar.",
    });
    return { suggestions: [], meta };
  }

  const articlesBundle = await collectSentinelArticles(profile);
  const articleSuggestions = await buildSuggestions(profile, articlesBundle.articles, articlesBundle);
  const socialSuggestions = await buildSocialSentinelSuggestions(profile);
  const suggestions = mergeSuggestions(articleSuggestions, socialSuggestions);
  const v2Enabled = isSentinelV2PipelinesEnabled();

  const meta: SentinelSuggestionsMeta = {
    source: v2Enabled ? "sentinel-v2-pipelines" : "google-news-rss+portals",
    cached: false,
    refreshedAt: new Date().toISOString(),
    radarThemesCount,
    articlesScanned: articlesBundle.articles.length,
    portalsMonitored,
    pipelinesEnabled: v2Enabled,
    expansionTermsCount: articlesBundle.expandedTerms.length,
    emptyReason:
      suggestions.length === 0
        ? "Nenhuma materia recente encontrada para os temas e portais configurados."
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
    splitProfileThemesBySphere(profile).interest.map((theme) => theme.toLowerCase()),
  );

  if (radarThemes.size === 0) {
    return mocks.filter((suggestion) =>
      (suggestion.evidence.actors ?? []).some((actor) => actor.sourceList === "opposition"),
    );
  }

  return mocks.filter(
    (suggestion) =>
      suggestion.matchedThemes.some((theme) => radarThemes.has(theme.toLowerCase())) ||
      (suggestion.evidence.actors ?? []).some((actor) => actor.sourceList === "opposition"),
  );
}
