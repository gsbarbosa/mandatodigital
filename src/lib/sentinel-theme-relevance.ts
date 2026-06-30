import type { MockSentinelSuggestion } from "@/lib/sentinel-mock-suggestions";
import {
  buildSentinelRssQueries,
  matchLiteralThemes,
  matchSentinelThemes,
  type RssNewsItem,
} from "@/lib/sentinel-rss";
import { normalizeSentinelText } from "@/lib/sentinel-text";
import type { PoliticianProfile } from "@/lib/types";

export type ProfileRadarThemes = {
  interest: string[];
  opposition: string[];
  custom: string[];
  allSelectable: string[];
};

export type ThemeRelevanceViolation =
  | {
      type: "suggestion_theme_not_in_radar";
      suggestionId: string;
      theme: string;
    }
  | {
      type: "query_missing_selected_theme";
      theme: string;
    }
  | {
      type: "query_contains_unselected_theme";
      theme: string;
    };

export function collectProfileRadarThemes(profile: PoliticianProfile): ProfileRadarThemes {
  const interest = [...profile.sentinelThemes];
  const custom = profile.customRadarThemes.map((theme) => theme.trim()).filter(Boolean);
  const opposition = [...profile.oppositionThemes];

  return {
    interest,
    opposition,
    custom,
    allSelectable: [...interest, ...custom, ...opposition],
  };
}

function articleHaystack(article: RssNewsItem) {
  return `${article.title} ${article.sourceName ?? ""} ${article.siteHost ?? ""}`;
}

export function matchArticleToProfileRadar(
  article: RssNewsItem,
  profile: PoliticianProfile,
) {
  const radar = collectProfileRadarThemes(profile);
  const haystack = articleHaystack(article);
  const matchedCatalogInterest = matchSentinelThemes(haystack, radar.interest);
  const matchedCustom = matchLiteralThemes(haystack, radar.custom);
  const matchedInterest = [...new Set([...matchedCatalogInterest, ...matchedCustom])];
  const matchedOpposition = matchSentinelThemes(haystack, radar.opposition);

  return {
    matchedInterest,
    matchedOpposition,
    matchedThemes: [...new Set([...matchedInterest, ...matchedOpposition])],
  };
}

export function articleMatchesProfileRadar(article: RssNewsItem, profile: PoliticianProfile) {
  return matchArticleToProfileRadar(article, profile).matchedThemes.length > 0;
}

export function findSuggestionThemeViolations(
  suggestions: MockSentinelSuggestion[],
  profile: PoliticianProfile,
): ThemeRelevanceViolation[] {
  const radar = collectProfileRadarThemes(profile);
  const allowed = new Set(radar.allSelectable.map(normalizeSentinelText));
  const violations: ThemeRelevanceViolation[] = [];

  for (const suggestion of suggestions) {
    const themesToCheck = [
      suggestion.themeLabel,
      ...suggestion.matchedThemes,
    ].filter(Boolean);

    for (const theme of themesToCheck) {
      if (!allowed.has(normalizeSentinelText(theme))) {
        violations.push({
          type: "suggestion_theme_not_in_radar",
          suggestionId: suggestion.id,
          theme,
        });
      }
    }
  }

  return violations;
}

function queryIncludesTheme(query: string, theme: string) {
  return normalizeSentinelText(query).includes(normalizeSentinelText(theme));
}

export function findQueryThemeViolations(profile: PoliticianProfile): ThemeRelevanceViolation[] {
  const radar = collectProfileRadarThemes(profile);
  const queries = buildSentinelRssQueries(profile);
  const violations: ThemeRelevanceViolation[] = [];

  const selectedForQueries = [
    ...radar.interest,
    ...radar.custom,
    ...radar.opposition.slice(0, 2),
  ].slice(0, 6);

  for (const theme of selectedForQueries) {
    if (!queries.some((query) => queryIncludesTheme(query, theme))) {
      violations.push({
        type: "query_missing_selected_theme",
        theme,
      });
    }
  }

  const allowed = new Set(
    [...radar.interest, ...radar.custom, ...radar.opposition, profile.city, profile.state]
      .map((value) => value.trim())
      .filter(Boolean)
      .map(normalizeSentinelText),
  );

  for (const query of queries) {
    const normalizedQuery = normalizeSentinelText(query);
    const geo = normalizeSentinelText(
      [profile.city.trim(), profile.state.trim()].filter(Boolean).join(" "),
    );

    if (geo && normalizedQuery === geo) {
      continue;
    }

    const matchesAllowedTheme = [...allowed].some(
      (theme) => theme.length >= 3 && normalizedQuery.includes(theme),
    );

    if (!matchesAllowedTheme) {
      violations.push({
        type: "query_contains_unselected_theme",
        theme: query,
      });
    }
  }

  return violations;
}

export function filterArticlesMatchingProfileRadar(
  articles: RssNewsItem[],
  profile: PoliticianProfile,
) {
  return articles.filter((article) => articleMatchesProfileRadar(article, profile));
}

export function guardSuggestionsForProfile(
  suggestions: MockSentinelSuggestion[],
  profile: PoliticianProfile,
) {
  const violations = findSuggestionThemeViolations(suggestions, profile);
  if (violations.length === 0) {
    return { suggestions, removedCount: 0, violations: [] as ThemeRelevanceViolation[] };
  }

  const invalidIds = new Set(
    violations
      .filter(
        (violation): violation is Extract<ThemeRelevanceViolation, { type: "suggestion_theme_not_in_radar" }> =>
          violation.type === "suggestion_theme_not_in_radar",
      )
      .map((violation) => violation.suggestionId),
  );

  return {
    suggestions: suggestions.filter((suggestion) => !invalidIds.has(suggestion.id)),
    removedCount: invalidIds.size,
    violations,
  };
}
