import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildSentinelFixtureProfile,
  createSentinelFixtureFetch,
  loadAllSentinelFixtureArticles,
  loadSentinelFixtureManifest,
  resolveSentinelFixtureFileForRssUrl,
} from "@/lib/sentinel-rss-fixtures";
import { buildSentinelRssQueries, fetchSentinelNewsItems } from "@/lib/sentinel-rss";
import { buildSuggestionsFromArticles } from "@/lib/sentinel-suggestions";
import {
  filterArticlesMatchingProfileRadar,
  findQueryThemeViolations,
  findSuggestionThemeViolations,
  guardSuggestionsForProfile,
  matchArticleToProfileRadar,
} from "@/lib/sentinel-theme-relevance";

describe("sentinel integration — fixtures RSS reais", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", createSentinelFixtureFetch());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("manifesto cobre todas as queries do perfil fixture", () => {
    const profile = buildSentinelFixtureProfile();
    const manifest = loadSentinelFixtureManifest();
    const queries = buildSentinelRssQueries(profile);

    expect(findQueryThemeViolations(profile)).toEqual([]);
    expect(queries.length).toBeGreaterThanOrEqual(manifest.feeds.length - 1);

    for (const feed of manifest.feeds) {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(feed.query)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
      expect(resolveSentinelFixtureFileForRssUrl(url)).toBe(feed.file);
    }
  });

  it("fetchSentinelNewsItems carrega matérias reais dos fixtures", async () => {
    const profile = buildSentinelFixtureProfile();
    const articles = await fetchSentinelNewsItems(profile);

    expect(articles.length).toBeGreaterThan(20);
    expect(articles.every((article) => article.title.trim().length > 0)).toBe(true);
    expect(articles.every((article) => article.link.startsWith("http"))).toBe(true);
  });

  it("filtra matérias reais para só as que batem com temas selecionados", () => {
    const profile = buildSentinelFixtureProfile();
    const articles = loadAllSentinelFixtureArticles();
    const matched = filterArticlesMatchingProfileRadar(articles, profile);

    expect(articles.length).toBeGreaterThan(matched.length);
    expect(matched.length).toBeGreaterThan(10);

    for (const article of matched) {
      const match = matchArticleToProfileRadar(article, profile);
      expect(match.matchedThemes.length).toBeGreaterThan(0);
    }
  });

  it("gera sugestões a partir de RSS real sem temas fora do radar", () => {
    const profile = buildSentinelFixtureProfile();
    const articles = loadAllSentinelFixtureArticles();
    const suggestions = buildSuggestionsFromArticles(articles, profile);
    const guarded = guardSuggestionsForProfile(suggestions, profile);

    expect(suggestions.length).toBeGreaterThan(0);
    expect(guarded.removedCount).toBe(0);
    expect(findSuggestionThemeViolations(guarded.suggestions, profile)).toEqual([]);

    const allowedThemes = new Set([
      ...profile.sentinelThemes,
      ...profile.oppositionThemes,
      ...profile.customRadarThemes,
    ]);

    for (const suggestion of guarded.suggestions) {
      expect(allowedThemes.has(suggestion.themeLabel)).toBe(true);
      expect(suggestion.matchedThemes.length).toBeGreaterThan(0);
      expect(suggestion.evidence.articles?.length).toBeGreaterThan(0);
      expect(suggestion.relevanceScore).toBeGreaterThanOrEqual(10);
    }
  });

  it("pipeline fetch + sugestão mantém relevância tema a tema", async () => {
    const profile = buildSentinelFixtureProfile();
    const fetched = await fetchSentinelNewsItems(profile);
    const suggestions = buildSuggestionsFromArticles(fetched, profile);

    expect(fetched.length).toBeGreaterThan(0);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(findSuggestionThemeViolations(suggestions, profile)).toEqual([]);

    const themeLabels = new Set(suggestions.map((item) => item.themeLabel));
    expect(themeLabels.size).toBeGreaterThanOrEqual(1);
  });
});
