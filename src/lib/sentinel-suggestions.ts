import { createHash } from "node:crypto";

import {
  isSentinelV2PipelinesEnabled,
} from "@/lib/feature-flags";
import {
  beginRssFetchStats,
  clusterScoredArticles,
  countUniqueOutlets,
  fetchSemanticExpansionNewsItems,
  fetchSentinelNewsItems,
  getRssFetchStats,
  matchSentinelThemes,
  scoreSentinelArticle,
  type RssNewsItem,
} from "@/lib/sentinel-rss";
import { buildSentinelQualityReport, estimateSentinelLlmCost } from "@/lib/sentinel-quality";
import { applySentinelQualityRank } from "@/lib/sentinel-quality-rank";
import { diversifySuggestionsByTheme, interleaveSuggestionsByTheme } from "@/lib/sentinel-diversify";
import { orderClusterArticlesForDisplay } from "@/lib/sentinel-cluster-order";
import { isLikelyJobListingTitle, isWeakFakeNewsTitle } from "@/lib/sentinel-title-filters";
import type { MockSentinelSuggestion, SentinelNewsArticle } from "@/lib/sentinel-mock-suggestions";
import {
  countCatalogPortalHosts,
} from "@/lib/sentinel-portal-catalog";
import {
  splitProfileThemesBySphere,
} from "@/lib/sentinel-profile-themes";
import { buildSocialSentinelSuggestions } from "@/lib/sentinel-social";
import {
  buildOppositionPostSuggestions,
  oppositionMonitoringUnavailableReason,
} from "@/lib/sentinel-opposition-posts";
import { isApifyConfigured } from "@/lib/sentinel-instagram-posts";
import { pickBestMatchedTheme, resolveArticleMatchingSearchTerm } from "@/lib/sentinel-theme-synonyms";
import {
  applyThemeVerificationBatch,
  type ThemeVerificationStats,
} from "@/lib/sentinel-theme-verify";
import {
  flattenExpansionSearchTerms,
  loadSentinelThemeExpansionsForProfile,
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

type ReadCacheOptions = {
  forceRefresh?: boolean;
  /** Quando true, devolve cache mesmo com TTL vencido (só invalida por assinatura do radar). */
  allowStale?: boolean;
};
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
  const haystack = `${primary.title} ${primary.sourceName ?? ""} ${primary.siteHost ?? ""}`;
  const matchingSearchTerm =
    resolveArticleMatchingSearchTerm(haystack, themeLabel) ?? undefined;
  const outletCount = countUniqueOutlets(articles);
  const sortedArticles = orderClusterArticlesForDisplay(
    primary,
    articles,
    MAX_ARTICLES_PER_SUGGESTION,
  );

  return {
    id: buildSuggestionId(primary.link),
    themeLabel,
    matchedThemes,
    matchingSearchTerm,
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

export async function buildSuggestionsFromArticles(
  articles: RssNewsItem[],
  profile: PoliticianProfile,
): Promise<{
  suggestions: MockSentinelSuggestion[];
  themeVerificationStats?: ThemeVerificationStats;
}> {
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

      const themeLabel = pickBestMatchedTheme(haystack, matchedThemes);
      if (!themeLabel) {
        return null;
      }

      const sourceList = resolveSourceList({ matchedInterest, article });

      return {
        article,
        haystack,
        themeLabel,
        matchedThemes,
        sourceList,
        relevanceScore: 0,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const { items: verifiedScored, stats: themeVerificationStats } =
    await applyThemeVerificationBatch(
      scored.map((item) => ({
        article: item.article,
        haystack: item.haystack,
        themeLabel: item.themeLabel,
        matchedThemes: item.matchedThemes,
      })),
    );

  const scoredByKey = new Map(
    scored.map((item) => [`${item.article.title}|${item.article.link}`, item]),
  );
  const mergedScored = verifiedScored.map((verified) => {
    const key = `${verified.article.title}|${verified.article.link}`;
    const original = scoredByKey.get(key);
    return {
      article: verified.article,
      themeLabel: verified.themeLabel,
      matchedThemes: verified.matchedThemes,
      sourceList: original?.sourceList ?? ("interest" as const),
      relevanceScore: original?.relevanceScore ?? 0,
    };
  });

  const clusters = clusterScoredArticles(mergedScored);
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

  return {
    suggestions: interleaveSuggestionsByTheme(
      diversifySuggestionsByTheme(suggestions, {
        maxTotal: MAX_SUGGESTIONS,
        maxPerTheme: 4,
        maxPerPipeline: 10,
      }),
    ),
    themeVerificationStats,
  };
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

function hasOppositionSuggestions(suggestions: MockSentinelSuggestion[]) {
  return suggestions.some((suggestion) =>
    (suggestion.evidence.actors ?? []).some((actor) => actor.sourceList === "opposition"),
  );
}

function buildOppositionUnavailableMeta(profile: PoliticianProfile) {
  const reason = oppositionMonitoringUnavailableReason();
  return profile.oppositionProfiles.some((row) => row.handle.trim()) && reason
    ? reason
    : undefined;
}

async function hydrateCachedOppositionSuggestions(
  profile: PoliticianProfile,
  cacheKey: string,
  cached: SentinelCacheEntry,
): Promise<SentinelCacheEntry> {
  if (!isApifyConfigured()) {
    return cached;
  }

  if (!profile.oppositionProfiles.some((row) => row.handle.trim())) {
    return cached;
  }

  if (hasOppositionSuggestions(cached.suggestions)) {
    return cached;
  }

  const oppositionSuggestions = await buildOppositionPostSuggestions(profile);
  if (!oppositionSuggestions.length) {
    return cached;
  }

  const suggestions = mergeSuggestions(cached.suggestions, oppositionSuggestions);
  const meta: SentinelSuggestionsMeta = {
    ...cached.meta,
    oppositionUnavailableReason: undefined,
    refreshedAt: new Date().toISOString(),
  };

  const entry: SentinelCacheEntry = {
    suggestions,
    meta,
    expiresAt: cached.expiresAt,
  };

  suggestionCache.set(cacheKey, entry);

  if (isPersistableProfileId(cacheKey)) {
    await sentinelStorage.writeCache(cacheKey, {
      suggestions,
      meta,
      expiresAt: new Date(entry.expiresAt).toISOString(),
    });
  }

  return entry;
}

function withOppositionMeta(
  profile: PoliticianProfile,
  meta: SentinelSuggestionsMeta,
  cached: boolean,
): SentinelSuggestionsMeta {
  return {
    ...meta,
    cached,
    oppositionUnavailableReason: buildOppositionUnavailableMeta(profile),
  };
}

function isOppositionSuggestion(suggestion: MockSentinelSuggestion) {
  return (suggestion.evidence.actors ?? []).some((actor) => actor.sourceList === "opposition");
}

function isLowQualityNewsSuggestion(suggestion: MockSentinelSuggestion) {
  if (isOppositionSuggestion(suggestion)) {
    return false;
  }
  const title = suggestion.evidence.articles?.[0]?.title ?? suggestion.topic;
  return isLikelyJobListingTitle(title) || isWeakFakeNewsTitle(title);
}

function mergeSuggestions(...groups: MockSentinelSuggestion[][]): MockSentinelSuggestion[] {
  const byId = new Map<string, MockSentinelSuggestion>();
  const oppositionById = new Map<string, MockSentinelSuggestion>();

  for (const suggestion of groups.flat()) {
    if (isOppositionSuggestion(suggestion)) {
      const existing = oppositionById.get(suggestion.id);
      if (!existing || suggestion.relevanceScore > existing.relevanceScore) {
        oppositionById.set(suggestion.id, suggestion);
      }
      continue;
    }

    if (isLowQualityNewsSuggestion(suggestion)) {
      continue;
    }

    const existing = byId.get(suggestion.id);
    if (!existing || suggestion.relevanceScore > existing.relevanceScore) {
      byId.set(suggestion.id, suggestion);
    }
  }

  const coreSuggestions = interleaveSuggestionsByTheme(
    diversifySuggestionsByTheme(
      [...byId.values()].sort((left, right) => right.relevanceScore - left.relevanceScore),
      { maxTotal: MAX_SUGGESTIONS, maxPerTheme: 4, maxPerPipeline: 10 },
    ),
  );

  const oppositionSuggestions = [...oppositionById.values()].sort(
    (left, right) => right.relevanceScore - left.relevanceScore,
  );

  return [...coreSuggestions, ...oppositionSuggestions].sort(
    (left, right) => right.relevanceScore - left.relevanceScore,
  );
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
    radarThemesSignature: buildRadarThemesSignature(profile),
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

/** Só memória — não apaga cache persistido (evita convidado ficar sem pautas se o refresh falhar). */
export function invalidateSentinelMemoryCache(profileId: string) {
  suggestionCache.delete(profileId);
}

export async function invalidateSentinelCacheAsync(profileId: string) {
  suggestionCache.delete(profileId);
  if (isPersistableProfileId(profileId)) {
    await sentinelStorage.clearCache(profileId);
  }
}

/** Identidade do radar salvo — invalida cache quando temas mudam. */
export function buildRadarThemesSignature(profile: PoliticianProfile) {
  const themes = splitProfileThemesBySphere(profile);
  const payload = [
    themes.federal.join("\n"),
    themes.estadual.join("\n"),
    themes.municipalCustom.join("\n"),
    profile.oppositionThemes.join("\n"),
    profile.oppositionProfiles
      .map((row) => `${row.network}:${row.handle}`.trim())
      .join("\n"),
    profile.interestSites.join("\n"),
  ].join("\n::\n");

  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

function cacheMatchesProfile(cached: SentinelCacheEntry, profile: PoliticianProfile) {
  const currentSignature = buildRadarThemesSignature(profile);
  if (!cached.meta.radarThemesSignature) {
    return false;
  }

  return cached.meta.radarThemesSignature === currentSignature;
}

function isPersistableProfileId(profileId: string) {
  return profileId.trim().length > 0 && profileId !== "default";
}

async function readCachedSuggestions(
  cacheKey: string,
  profile: PoliticianProfile,
  options?: ReadCacheOptions,
) {
  if (options?.forceRefresh) {
    return null;
  }

  const allowStale = options?.allowStale ?? true;
  const now = Date.now();
  const memoryCached = suggestionCache.get(cacheKey);
  if (memoryCached && (allowStale || memoryCached.expiresAt > now)) {
    if (!cacheMatchesProfile(memoryCached, profile)) {
      invalidateSentinelCache(cacheKey);
      return null;
    }
    return memoryCached;
  }

  if (!isPersistableProfileId(cacheKey)) {
    return null;
  }

  const persisted = await sentinelStorage.readCache(cacheKey);
  if (!persisted) {
    return null;
  }

  if (!allowStale && isSentinelCacheExpired(persisted, now)) {
    return null;
  }

  const entry: SentinelCacheEntry = {
    suggestions: persisted.suggestions,
    meta: persisted.meta,
    expiresAt: Date.parse(persisted.expiresAt),
  };

  if (!Number.isFinite(entry.expiresAt)) {
    entry.expiresAt = now + CACHE_TTL_MS;
  }

  if (!cacheMatchesProfile(entry, profile)) {
    await invalidateSentinelCacheAsync(cacheKey);
    return null;
  }

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
  beginRssFetchStats();
  const v2Enabled = isSentinelV2PipelinesEnabled();
  const baseArticles = await fetchSentinelNewsItems(profile);

  if (!v2Enabled) {
    return {
      articles: baseArticles,
      expansions: [],
      expandedTerms: [],
      rssFetchStats: getRssFetchStats(),
    };
  }

  const profileId = profile.id?.trim() || "default";
  // Só expansões dos temas ativos — órfãos (ex.: Cameras Corporais após troca do radar)
  // não podem buscar nem rotular pautas.
  const expansions =
    profileId !== "default" ? await loadSentinelThemeExpansionsForProfile(profile) : [];
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

  return {
    articles,
    expansions,
    expandedTerms,
    rssFetchStats: getRssFetchStats(),
  };
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
  options?: { forceRefresh?: boolean; qualityRankEnabled?: boolean },
) {
  const cacheKey = profile.id || "default";
  const forceRefresh = Boolean(options?.forceRefresh);
  const qualityRankEnabled = options?.qualityRankEnabled !== false;
  const cached = await readCachedSuggestions(cacheKey, profile, {
    forceRefresh,
    allowStale: true,
  });

  if (cached) {
    const hydrated = await hydrateCachedOppositionSuggestions(profile, cacheKey, cached);
    const suggestions = filterSuggestionsForProfile(profile, hydrated.suggestions);
    return {
      suggestions,
      meta: withOppositionMeta(profile, hydrated.meta, true),
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

  // GET do monitoramento só lê cache. Varredura nova: Atualizar pautas ou troca do radar.
  if (!forceRefresh) {
    const meta = buildEmptyMeta(profile, {
      emptyReason:
        "Nenhuma pauta em cache para este radar. Clique em Atualizar pautas para buscar notícias.",
    });
    return { suggestions: [], meta };
  }

  const articlesBundle = await collectSentinelArticles(profile);
  const articleBuild = await buildSuggestions(profile, articlesBundle.articles, articlesBundle);
  const articleSuggestions = articleBuild.suggestions;
  const [socialSuggestions, oppositionSuggestions] = await Promise.all([
    buildSocialSentinelSuggestions(profile),
    buildOppositionPostSuggestions(profile),
  ]);
  const suggestionsFiltered = filterSuggestionsForProfile(
    profile,
    mergeSuggestions(articleSuggestions, socialSuggestions, oppositionSuggestions),
  );

  const qualityRank = await applySentinelQualityRank(suggestionsFiltered, {
    profileLabel: [profile.fullName, profile.city, profile.state].filter(Boolean).join(" · "),
    enabled: qualityRankEnabled,
  });
  const suggestions = qualityRank.suggestions;

  const oppositionUnavailableReason = buildOppositionUnavailableMeta(profile);
  const v2Enabled = isSentinelV2PipelinesEnabled();
  const rssFetchStats = articlesBundle.rssFetchStats;
  const fetchLooksBroken =
    articlesBundle.articles.length === 0 &&
    rssFetchStats.attempted > 0 &&
    rssFetchStats.succeeded === 0;

  const qualityReport = buildSentinelQualityReport(suggestions);
  const llmCostEstimate = estimateSentinelLlmCost({
    // Expansões costumam vir do cache; o custo variável do refresh é verify + quality rank.
    expansionCalls: 0,
    verifyLlmCalls: articleBuild.themeVerificationStats?.llmCalls ?? 0,
    qualityRankCalls: qualityRank.stats.llmCalls,
  });

  const meta: SentinelSuggestionsMeta = {
    source: v2Enabled ? "sentinel-v2-pipelines" : "google-news-rss+portals",
    cached: false,
    refreshedAt: new Date().toISOString(),
    radarThemesCount,
    radarThemesSignature: buildRadarThemesSignature(profile),
    articlesScanned: articlesBundle.articles.length,
    portalsMonitored,
    pipelinesEnabled: v2Enabled,
    expansionTermsCount: articlesBundle.expandedTerms.length,
    themeVerificationStats: articleBuild.themeVerificationStats,
    rssFetchStats,
    qualityReport: {
      newsTotal: qualityReport.newsTotal,
      newsPautavel: qualityReport.newsPautavel,
      newsPautavelPercent: qualityReport.newsPautavelPercent,
      oppositionTotal: qualityReport.oppositionTotal,
    },
    qualityRankStats: qualityRank.stats.llmCalls > 0 ? qualityRank.stats : undefined,
    llmCostEstimate,
    emptyReason:
      suggestions.length === 0
        ? fetchLooksBroken
          ? "Falha ao consultar fontes de noticias (Google News/portais). Tente atualizar novamente em alguns minutos."
          : "Nenhuma materia recente encontrada para os temas e portais configurados."
        : undefined,
    oppositionUnavailableReason,
  };

  if (fetchLooksBroken) {
    console.warn("[sentinel] coleta RSS zerada", rssFetchStats);
  }

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

export function filterSuggestionsForProfile(
  profile: PoliticianProfile,
  suggestions: MockSentinelSuggestion[],
) {
  const interestThemes = new Set(
    splitProfileThemesBySphere(profile).interest.map((theme) => theme.toLowerCase()),
  );

  if (interestThemes.size === 0) {
    return suggestions.filter((suggestion) =>
      (suggestion.evidence.actors ?? []).some((actor) => actor.sourceList === "opposition"),
    );
  }

  return suggestions.filter((suggestion) => {
    if ((suggestion.evidence.actors ?? []).some((actor) => actor.sourceList === "opposition")) {
      return true;
    }

    // O tema exibido no card precisa ser um tema ativo do radar.
    // matchedThemes sozinho não basta: expansão órfã pode rotular "Cameras Corporais"
    // e ainda assim cruzar um tema fiscal por falso positivo de sinônimo.
    const themeLabel = suggestion.themeLabel.trim().toLowerCase();
    return Boolean(themeLabel && interestThemes.has(themeLabel));
  });
}
