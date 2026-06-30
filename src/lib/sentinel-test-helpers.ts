import { expect } from "vitest";

import type { MockSentinelSuggestion } from "@/lib/sentinel-mock-suggestions";
import { buildSentinelRssQueries, type RssNewsItem } from "@/lib/sentinel-rss";
import { buildSuggestionsFromArticles } from "@/lib/sentinel-suggestions";
import {
  collectProfileRadarThemes,
  filterArticlesMatchingProfileRadar,
  findQueryThemeViolations,
  findSuggestionThemeViolations,
  guardSuggestionsForProfile,
} from "@/lib/sentinel-theme-relevance";
import { normalizeSentinelText } from "@/lib/sentinel-text";
import type { PoliticianProfile } from "@/lib/types";

export function buildSentinelTestProfile(
  overrides: Partial<PoliticianProfile> = {},
): PoliticianProfile {
  return {
    id: "sentinel-test-profile",
    fullName: "Teste Sentinela",
    role: "Vereador",
    city: "Campinas",
    state: "SP",
    audience: "Eleitorado local",
    spectrum: "Centro",
    archetype: "O Conciliador (Uniao/Pontes)",
    voiceTones: [],
    keyIssues: ["Saude"],
    slogans: [],
    redLines: [],
    referenceExamples: [],
    bio: "Bio de teste com mais de vinte caracteres para validacao do Sentinela.",
    personaArchetypes: [],
    sentinelThemes: ["Vacinação"],
    oppositionThemes: [],
    customRadarThemes: [],
    interestProfiles: [],
    interestSites: [],
    oppositionProfiles: [],
    oppositionSites: [],
    glossaryTerms: [],
    trainingReferenceLinks: [],
    youtubeVideoUrl: "",
    avatarType: "",
    avatarVideoTopic: "",
    argilAvatarId: "",
    argilVoiceId: "",
    avatarTrainingStatus: "",
    notificationEmail: "",
    avatarEmotions: [],
    voicePace: "Manter velocidade original",
    editingStyles: [],
    factCheckingSources: [],
    hardDataSources: [],
    distributionChannels: [],
    distributionWindows: [],
    autoPublish: false,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function buildSentinelTestArticle(
  title: string,
  link = `https://example.com/${normalizeSentinelText(title).replace(/\s+/g, "-").slice(0, 40)}`,
): RssNewsItem {
  return {
    title,
    link,
    pubDate: "Mon, 23 Jun 2026 10:00:00 GMT",
    publishedAt: new Date("2026-06-23T10:00:00.000Z"),
    sourceName: "G1",
    origin: "google-news",
  };
}

/** Falha o teste se alguma sugestão tiver tema fora do radar salvo. */
export function assertSuggestionsMatchProfileRadar(
  suggestions: MockSentinelSuggestion[],
  profile: PoliticianProfile,
) {
  const allowed = new Set(
    collectProfileRadarThemes(profile).allSelectable.map(normalizeSentinelText),
  );
  const guarded = guardSuggestionsForProfile(suggestions, profile);

  expect(findSuggestionThemeViolations(guarded.suggestions, profile)).toEqual([]);
  expect(guarded.removedCount).toBe(0);

  for (const suggestion of guarded.suggestions) {
    expect(allowed.has(normalizeSentinelText(suggestion.themeLabel))).toBe(true);

    for (const theme of suggestion.matchedThemes) {
      expect(allowed.has(normalizeSentinelText(theme))).toBe(true);
    }

    expect(suggestion.matchedThemes.length).toBeGreaterThan(0);
    expect(suggestion.evidence.articles?.length ?? 0).toBeGreaterThan(0);
  }

  return guarded.suggestions;
}

/** Falha se queries RSS não refletirem o perfil. */
export function assertQueriesMatchProfileRadar(profile: PoliticianProfile) {
  expect(findQueryThemeViolations(profile)).toEqual([]);

  const queries = buildSentinelRssQueries(profile);
  expect(queries.length).toBeGreaterThan(0);

  return queries;
}

export function runSentinelPipelineOnArticles(
  articles: RssNewsItem[],
  profile: PoliticianProfile,
) {
  const matched = filterArticlesMatchingProfileRadar(articles, profile);
  const suggestions = buildSuggestionsFromArticles(articles, profile);
  const aligned = assertSuggestionsMatchProfileRadar(suggestions, profile);

  return {
    matched,
    suggestions: aligned,
    rawSuggestions: suggestions,
  };
}

export type SingleThemeScenario = {
  id: string;
  sentinelThemes: string[];
  oppositionThemes: string[];
  customRadarThemes?: string[];
  /** Mínimo de sugestões esperadas com fixtures Campinas (0 = pode vir vazio). */
  minSuggestions: number;
  /** Temas permitidos nos matchedThemes (normalizados). */
  allowedThemeLabels: string[];
};

export const SENTINEL_SINGLE_THEME_SCENARIOS: SingleThemeScenario[] = [
  {
    id: "somente-vacinacao",
    sentinelThemes: ["Vacinação"],
    oppositionThemes: [],
    minSuggestions: 1,
    allowedThemeLabels: ["Vacinação"],
  },
  {
    id: "somente-seguranca-publica",
    sentinelThemes: ["Segurança Pública"],
    oppositionThemes: [],
    minSuggestions: 1,
    allowedThemeLabels: ["Segurança Pública"],
  },
  {
    id: "somente-combate-corrupcao-oposicao",
    sentinelThemes: [],
    oppositionThemes: ["Combate à Corrupção"],
    minSuggestions: 1,
    allowedThemeLabels: ["Combate à Corrupção"],
  },
  {
    id: "vacinacao-e-seguranca",
    sentinelThemes: ["Vacinação", "Segurança Pública"],
    oppositionThemes: [],
    minSuggestions: 2,
    allowedThemeLabels: ["Vacinação", "Segurança Pública"],
  },
  {
    id: "tema-sem-fixture-homeschooling",
    sentinelThemes: ["Homeschooling"],
    oppositionThemes: [],
    minSuggestions: 0,
    allowedThemeLabels: ["Homeschooling"],
  },
  {
    id: "tema-personalizado-literal",
    sentinelThemes: [],
    oppositionThemes: [],
    customRadarThemes: ["terminal urbano"],
    minSuggestions: 0,
    allowedThemeLabels: ["terminal urbano"],
  },
];

export function assertSuggestionsOnlyUseAllowedThemes(
  suggestions: MockSentinelSuggestion[],
  allowedThemeLabels: string[],
) {
  const allowed = new Set(allowedThemeLabels.map(normalizeSentinelText));

  for (const suggestion of suggestions) {
    expect(allowed.has(normalizeSentinelText(suggestion.themeLabel))).toBe(true);

    for (const theme of suggestion.matchedThemes) {
      expect(allowed.has(normalizeSentinelText(theme))).toBe(true);
    }
  }
}
