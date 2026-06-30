import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSentinelFixtureFetch, buildSentinelFixtureProfile } from "@/lib/sentinel-rss-fixtures";
import {
  assertSuggestionsMatchProfileRadar,
  buildSentinelTestProfile,
} from "@/lib/sentinel-test-helpers";
import { findSuggestionThemeViolations } from "@/lib/sentinel-theme-relevance";
import { invalidateSentinelCache, getSentinelSuggestions } from "@/lib/sentinel-suggestions";

vi.mock("@/lib/sentinel-storage", () => ({
  sentinelStorage: {
    readCache: vi.fn(async () => null),
    writeCache: vi.fn(async () => undefined),
    appendSignalHistory: vi.fn(async () => undefined),
    clearCache: vi.fn(async () => undefined),
  },
  isSentinelCacheExpired: vi.fn(() => true),
}));

vi.mock("@/lib/sentinel-theme-expansion", () => ({
  loadSentinelThemeExpansions: vi.fn(async () => []),
  flattenExpansionSearchTerms: vi.fn(() => []),
  syncSentinelThemeExpansions: vi.fn(async () => undefined),
}));

describe("sentinel pipeline — getSentinelSuggestions com RSS real", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", createSentinelFixtureFetch());
    invalidateSentinelCache("sentinel-fixture-profile");
    invalidateSentinelCache("sentinel-test-profile");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("refresh completo retorna sinais alinhados ao radar Campinas", async () => {
    const profile = buildSentinelFixtureProfile();

    const result = await getSentinelSuggestions(profile, { forceRefresh: true });

    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.meta.articlesScanned).toBeGreaterThan(20);
    expect(result.meta.articlesMatchedRadar).toBeGreaterThan(10);
    expect(result.meta.themeViolationsFiltered ?? 0).toBe(0);
    expect(findSuggestionThemeViolations(result.suggestions, profile)).toEqual([]);
    assertSuggestionsMatchProfileRadar(result.suggestions, profile);
  });

  it("radar com só Vacinação retorna só esse tema nas sugestões", async () => {
    const profile = buildSentinelTestProfile({
      id: "sentinel-test-profile",
      sentinelThemes: ["Vacinação"],
      oppositionThemes: [],
    });

    const result = await getSentinelSuggestions(profile, { forceRefresh: true });

    expect(result.suggestions.length).toBeGreaterThan(0);

    for (const suggestion of result.suggestions) {
      expect(suggestion.matchedThemes.every((theme) => theme === "Vacinação")).toBe(true);
      expect(suggestion.themeLabel).toBe("Vacinação");
    }
  });

  it("radar só com oposição busca e retorna sinais adversários", async () => {
    const profile = buildSentinelTestProfile({
      id: "sentinel-opposition-only",
      sentinelThemes: [],
      oppositionThemes: ["Combate à Corrupção"],
    });

    const result = await getSentinelSuggestions(profile, { forceRefresh: true });

    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(findSuggestionThemeViolations(result.suggestions, profile)).toEqual([]);

    for (const suggestion of result.suggestions) {
      expect(suggestion.matchedThemes).toContain("Combate à Corrupção");
    }
  });

  it("cacheOnly não busca RSS quando não há cache", async () => {
    const profile = buildSentinelFixtureProfile();
    invalidateSentinelCache(profile.id!);

    const result = await getSentinelSuggestions(profile, { cacheOnly: true });

    expect(result.suggestions).toEqual([]);
    expect(result.meta.emptyReason).toContain("Atualizar sinais");
  });

  it("radar sem temas retorna emptyReason de configuração", async () => {
    const profile = buildSentinelTestProfile({
      sentinelThemes: [],
      oppositionThemes: [],
      customRadarThemes: [],
      interestSites: [],
      oppositionSites: [],
    });

    const result = await getSentinelSuggestions(profile, { forceRefresh: true });

    expect(result.suggestions).toEqual([]);
    expect(result.meta.emptyReason).toMatch(/Configure temas|portais/i);
  });
});
