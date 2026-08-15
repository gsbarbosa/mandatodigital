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

/** Tema sintético dos cards que mostram o portal cadastrado sem match de tema. */
export const MUNICIPAL_PORTAL_FALLBACK_THEME = "Fonte cadastrada";

const DEFAULT_MAX_PORTAL_PROMOTED = 3;

export function isMunicipalPortalFallbackSuggestion(suggestion: MockSentinelSuggestion) {
  return (
    suggestion.pipeline === "portal-fallback" ||
    suggestion.themeLabel.trim() === MUNICIPAL_PORTAL_FALLBACK_THEME
  );
}

function buildPortalFallbackId(articles: RssNewsItem[]) {
  const hash = createHash("sha256")
    .update(`portal-fallback:${articles.map((article) => article.link).join("|")}`)
    .digest("hex")
    .slice(0, 16);
  return `sentinela-portal-${hash}`;
}

function buildPortalFallbackSuggestion(
  articles: RssNewsItem[],
  profile: PoliticianProfile,
): MockSentinelSuggestion {
  const themeLabel = MUNICIPAL_PORTAL_FALLBACK_THEME;
  const primary = articles[0];
  const hosts = [...new Set(articles.map((article) => article.siteHost).filter(Boolean))] as string[];
  const hostsLabel = hosts.join(", ") || "o site que você cadastrou";
  const relevanceScore = Math.max(
    30,
    scoreSentinelArticle(primary, profile, [], [], {
      articleCount: articles.length,
      outletCount: hosts.length || 1,
    }),
  );

  return {
    id: buildPortalFallbackId(articles),
    themeLabel,
    matchedThemes: [themeLabel],
    relevanceScore,
    pipeline: "portal-fallback",
    topic: `${themeLabel} · ${primary.title}`.slice(0, 160),
    briefing: `Não encontramos os temas selecionados em ${hostsLabel}. Mostrando as notícias mais recentes de lá.`,
    evidence: {
      postsAnalyzed: articles.length,
      outletCount: hosts.length || 1,
      engagementTrendPercent: 0,
      byNetwork: [],
      actors: [],
      articles: articles.map(toNewsArticle),
    },
    engagement: {
      relevanceScore,
      scoreTrendPercent: 0,
      likes: 0,
      comments: 0,
      postsAnalyzed: articles.length,
      sources: [],
      byNetwork: [],
    },
  };
}

export type PromoteMunicipalPortalFallbackResult = {
  suggestions: MockSentinelSuggestion[];
  meta?: SentinelMunicipalFallbackMeta;
};

/**
 * Quando o usuário cadastrou portal(is) próprio(s) pro município e, mesmo assim,
 * nenhum card municipal temático tem matéria que realmente cite a cidade dele,
 * troca o resultado (provavelmente vindo da busca ampla, de outra cidade) por um
 * aviso explícito + as matérias mais recentes do(s) portal(is) cadastrado(s).
 * Roda depois do promoteMunicipalGeoFallback, sobre o resultado dele.
 */
export function promoteMunicipalPortalFallback(input: {
  profile: PoliticianProfile;
  articles: RssNewsItem[];
  suggestions: MockSentinelSuggestion[];
  maxPromoted?: number;
  nowMs?: number;
}): PromoteMunicipalPortalFallbackResult {
  const { profile, articles, suggestions, maxPromoted = DEFAULT_MAX_PORTAL_PROMOTED } = input;

  if (!hasMunicipalRadar(profile) || municipalCityNames(profile).length === 0) {
    return { suggestions };
  }

  if (!profile.interestSites.some((site) => site.trim())) {
    return { suggestions };
  }

  const interestThemes = splitProfileThemesBySphere(profile).interest;
  if (interestThemes.length === 0) {
    return { suggestions };
  }

  // Só o que realmente veio dos portais que o usuário cadastrou (interestSites).
  const portalArticles = articles.filter((article) => article.siteList === "interest");
  if (portalArticles.length === 0) {
    return { suggestions };
  }

  const themeMatchedMunicipal = suggestions.filter((suggestion) =>
    isThemeMatchedMunicipalSuggestion(suggestion, profile),
  );

  // Se algum card temático já cita de fato uma das cidades monitoradas, está tudo certo —
  // o ajuste de pontuação já garante que ele fica em destaque. Nada a substituir aqui.
  const hasGenuineCityMatch = themeMatchedMunicipal.some((suggestion) =>
    (suggestion.evidence.articles ?? []).some((article) =>
      articleMentionsMunicipalCity(`${article.title} ${article.sourceName ?? ""}`, profile),
    ),
  );
  if (hasGenuineCityMatch) {
    return { suggestions };
  }

  const sortedPortalArticles = [...portalArticles].sort((left, right) => {
    const leftTime = left.publishedAt?.getTime() ?? 0;
    const rightTime = right.publishedAt?.getTime() ?? 0;
    return rightTime - leftTime;
  });
  const promoted = sortedPortalArticles.slice(0, maxPromoted);
  const fallbackSuggestion = buildPortalFallbackSuggestion(promoted, profile);

  // Tira os cards temáticos municipais sem citação real da cidade (prováveis "achismos"
  // da busca ampla) — o card informativo + o portal cadastrado assumem o lugar deles.
  const remaining = suggestions.filter(
    (suggestion) => !isThemeMatchedMunicipalSuggestion(suggestion, profile),
  );

  const meta: SentinelMunicipalFallbackMeta = {
    reason: "portal_no_theme_match",
    themesMissed: interestThemes,
    foundTopics: promoted.map((article) => article.title).slice(0, 8),
    promotedCount: promoted.length,
    cities: municipalCityNames(profile),
  };

  return {
    suggestions: [...remaining, fallbackSuggestion],
    meta,
  };
}
