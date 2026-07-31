import { createHash } from "node:crypto";

import type { MockSentinelSuggestion, SentinelNewsArticle } from "@/lib/sentinel-mock-suggestions";
import { hasMunicipalRadar, splitProfileThemesBySphere } from "@/lib/sentinel-profile-themes";
import type { RssNewsItem } from "@/lib/sentinel-rss";
import { matchSentinelThemes, scoreSentinelArticle } from "@/lib/sentinel-rss";
import { normalizeSentinelText } from "@/lib/sentinel-text";
import type { SentinelMunicipalFallbackMeta } from "@/lib/sentinel-types";
import { isLikelyJobListingTitle, isWeakFakeNewsTitle } from "@/lib/sentinel-title-filters";
import { classifySuggestionSphere } from "@/lib/sphere-classifier";
import type { PoliticianProfile } from "@/lib/types";

/** Tema sintético dos cards promovidos sem match do radar (só esfera municipal). */
export const MUNICIPAL_GEO_FALLBACK_THEME = "Radar local";

const DEFAULT_MIN_THEME_MATCHED = 1;
const DEFAULT_MAX_PROMOTED = 4;
/** Preferir matérias com até N dias; se faltar, aceita mais antigas. */
const PREFERRED_MAX_AGE_DAYS = 30;

export function isMunicipalGeoFallbackSuggestion(suggestion: MockSentinelSuggestion) {
  return (
    suggestion.pipeline === "geo-fallback" ||
    suggestion.themeLabel.trim() === MUNICIPAL_GEO_FALLBACK_THEME
  );
}

function municipalCityNames(profile: PoliticianProfile): string[] {
  const cities = [
    ...profile.municipalCities.map((city) => city.trim()),
    profile.city.trim(),
  ].filter(Boolean);
  return [...new Set(cities)];
}

/** Título/fonte menciona algum município do radar. */
export function articleMentionsMunicipalCity(
  text: string,
  profile: PoliticianProfile,
): string | null {
  const haystack = normalizeSentinelText(text);
  for (const city of municipalCityNames(profile)) {
    const key = normalizeSentinelText(city);
    if (key.length < 3) {
      continue;
    }
    if (key.length <= 4) {
      if (new RegExp(`(?:^|\\s)${key}(?:\\s|$)`).test(haystack)) {
        return city;
      }
      continue;
    }
    if (haystack.includes(key)) {
      return city;
    }
  }
  return null;
}

function suggestionArticleText(suggestion: MockSentinelSuggestion) {
  const articles = suggestion.evidence.articles ?? [];
  return articles.map((article) => `${article.title} ${article.sourceName ?? ""}`).join(" ");
}

function isOpposition(suggestion: MockSentinelSuggestion) {
  return (suggestion.evidence.actors ?? []).some((actor) => actor.sourceList === "opposition");
}

/**
 * Card municipal que casa tema do radar (não é o fallback amplo).
 */
export function isThemeMatchedMunicipalSuggestion(
  suggestion: MockSentinelSuggestion,
  profile: PoliticianProfile,
): boolean {
  if (isOpposition(suggestion) || isMunicipalGeoFallbackSuggestion(suggestion)) {
    return false;
  }

  const interest = new Set(
    splitProfileThemesBySphere(profile).interest.map((theme) => theme.toLowerCase()),
  );
  const themeOk = interest.has(suggestion.themeLabel.trim().toLowerCase());
  if (!themeOk) {
    return false;
  }

  const cityHit = Boolean(
    articleMentionsMunicipalCity(suggestionArticleText(suggestion), profile),
  );
  const sphere = classifySuggestionSphere(
    suggestion,
    profile.interestSites,
    profile.state,
    profile.customRadarThemes,
    {
      federal: profile.sentinelThemesFederal,
      estadual: profile.sentinelThemesEstadual,
    },
    profile.municipalCities,
  );

  return cityHit || sphere === "municipal";
}

function buildFallbackId(link: string) {
  const hash = createHash("sha256").update(`geo-fallback:${link}`).digest("hex").slice(0, 16);
  return `sentinela-geo-${hash}`;
}

function toNewsArticle(article: RssNewsItem): SentinelNewsArticle {
  return {
    title: article.title,
    url: article.link,
    sourceName: article.sourceName ?? article.siteHost,
    publishedAt: article.pubDate ?? undefined,
  };
}

function articleAgeDays(article: RssNewsItem, nowMs: number): number | null {
  if (!article.publishedAt) {
    return null;
  }
  return (nowMs - article.publishedAt.getTime()) / (24 * 60 * 60 * 1000);
}

function buildFallbackSuggestion(
  article: RssNewsItem,
  profile: PoliticianProfile,
  matchedCity: string,
): MockSentinelSuggestion {
  const relevanceScore = Math.max(
    35,
    scoreSentinelArticle(article, profile, [], [], { articleCount: 1, outletCount: 1 }),
  );
  const themeLabel = MUNICIPAL_GEO_FALLBACK_THEME;
  const title = article.title.trim();

  return {
    id: buildFallbackId(article.link),
    themeLabel,
    matchedThemes: [themeLabel],
    relevanceScore,
    pipeline: "geo-fallback",
    topic: `${matchedCity} · ${title}`.slice(0, 160),
    briefing: `Notícia local em ${matchedCity} (fora dos temas selecionados no radar).`,
    evidence: {
      postsAnalyzed: 1,
      outletCount: 1,
      engagementTrendPercent: 0,
      byNetwork: [],
      actors: [],
      articles: [toNewsArticle(article)],
    },
    engagement: {
      relevanceScore,
      scoreTrendPercent: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      postsAnalyzed: 1,
      sources: [],
      byNetwork: [],
    },
  };
}

export type PromoteMunicipalGeoFallbackResult = {
  suggestions: MockSentinelSuggestion[];
  meta?: SentinelMunicipalFallbackMeta;
};

/**
 * Se a esfera municipal ficou sem (ou quase sem) cards dos temas do radar,
 * promove matérias geo-only do município e devolve meta para o aviso na UI.
 * Exclusivo do nível municipal — não altera nacional/estadual.
 */
export function promoteMunicipalGeoFallback(input: {
  profile: PoliticianProfile;
  articles: RssNewsItem[];
  suggestions: MockSentinelSuggestion[];
  minThemeMatched?: number;
  maxPromoted?: number;
  nowMs?: number;
}): PromoteMunicipalGeoFallbackResult {
  const {
    profile,
    articles,
    suggestions,
    minThemeMatched = DEFAULT_MIN_THEME_MATCHED,
    maxPromoted = DEFAULT_MAX_PROMOTED,
    nowMs = Date.now(),
  } = input;

  if (!hasMunicipalRadar(profile) || municipalCityNames(profile).length === 0) {
    return { suggestions };
  }

  const interestThemes = splitProfileThemesBySphere(profile).interest;
  if (interestThemes.length === 0) {
    return { suggestions };
  }

  const themeMatchedMunicipal = suggestions.filter((suggestion) =>
    isThemeMatchedMunicipalSuggestion(suggestion, profile),
  );

  if (themeMatchedMunicipal.length >= minThemeMatched) {
    return { suggestions };
  }

  const usedLinks = new Set(
    suggestions.flatMap((suggestion) =>
      (suggestion.evidence.articles ?? []).map((article) => article.url.trim()).filter(Boolean),
    ),
  );

  const candidates = articles
    .map((article) => {
      const matchedCity = articleMentionsMunicipalCity(
        `${article.title} ${article.sourceName ?? ""} ${article.siteHost ?? ""}`,
        profile,
      );
      if (!matchedCity) {
        return null;
      }
      if (usedLinks.has(article.link.trim())) {
        return null;
      }
      if (isLikelyJobListingTitle(article.title) || isWeakFakeNewsTitle(article.title)) {
        return null;
      }
      // Só promove geo-only — matéria que já casa tema do radar ficaria no path temático.
      const haystack = `${article.title} ${article.sourceName ?? ""}`;
      if (matchSentinelThemes(haystack, interestThemes).length > 0) {
        return null;
      }

      const ageDays = articleAgeDays(article, nowMs);
      const score = scoreSentinelArticle(article, profile, [], [], {
        articleCount: 1,
        outletCount: 1,
      });
      return { article, matchedCity, ageDays, score };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((left, right) => {
      const leftFresh =
        left.ageDays != null && left.ageDays <= PREFERRED_MAX_AGE_DAYS ? 1 : 0;
      const rightFresh =
        right.ageDays != null && right.ageDays <= PREFERRED_MAX_AGE_DAYS ? 1 : 0;
      if (rightFresh !== leftFresh) {
        return rightFresh - leftFresh;
      }
      if ((left.ageDays ?? 999) !== (right.ageDays ?? 999)) {
        return (left.ageDays ?? 999) - (right.ageDays ?? 999);
      }
      return right.score - left.score;
    });

  const promoted = candidates.slice(0, maxPromoted).map((row) =>
    buildFallbackSuggestion(row.article, profile, row.matchedCity),
  );

  if (promoted.length === 0) {
    return {
      suggestions,
      meta: {
        reason: "themes_missed",
        themesMissed: interestThemes,
        foundTopics: [],
        promotedCount: 0,
        cities: municipalCityNames(profile),
      },
    };
  }

  const themesCovered = new Set(
    themeMatchedMunicipal.map((suggestion) => suggestion.themeLabel.trim()),
  );
  const themesMissed = interestThemes.filter((theme) => !themesCovered.has(theme));

  const meta: SentinelMunicipalFallbackMeta = {
    reason: themeMatchedMunicipal.length === 0 ? "themes_missed" : "few_local",
    themesMissed,
    foundTopics: promoted.map((suggestion) => suggestion.topic).slice(0, 8),
    promotedCount: promoted.length,
    cities: municipalCityNames(profile),
  };

  return {
    suggestions: [...suggestions, ...promoted].sort(
      (left, right) => right.relevanceScore - left.relevanceScore,
    ),
    meta,
  };
}
