import { describe, expect, it } from "vitest";

import { loadAllSentinelFixtureArticles } from "@/lib/sentinel-rss-fixtures";
import { sentinelThemeSynonyms } from "@/lib/sentinel-theme-synonyms";
import { matchSentinelThemes } from "@/lib/sentinel-rss";
import {
  assertQueriesMatchProfileRadar,
  assertSuggestionsMatchProfileRadar,
  buildSentinelTestProfile,
  runSentinelPipelineOnArticles,
  SENTINEL_SINGLE_THEME_SCENARIOS,
  assertSuggestionsOnlyUseAllowedThemes,
} from "@/lib/sentinel-test-helpers";

const fixtureArticles = loadAllSentinelFixtureArticles();
describe("sentinel — cenário por tema selecionado (RSS real Campinas)", () => {
  it.each(SENTINEL_SINGLE_THEME_SCENARIOS)(
    "$id → sugestões só usam temas permitidos",
    (scenario) => {
      const profile = buildSentinelTestProfile({
        sentinelThemes: scenario.sentinelThemes,
        oppositionThemes: scenario.oppositionThemes,
        customRadarThemes: scenario.customRadarThemes ?? [],
      });

      assertQueriesMatchProfileRadar(profile);

      const { suggestions, matched } = runSentinelPipelineOnArticles(fixtureArticles, profile);

      assertSuggestionsOnlyUseAllowedThemes(suggestions, scenario.allowedThemeLabels);

      if (scenario.minSuggestions > 0) {
        expect(suggestions.length).toBeGreaterThanOrEqual(scenario.minSuggestions);
        expect(matched.length).toBeGreaterThan(0);
      } else if (scenario.id === "tema-sem-fixture-homeschooling") {
        expect(suggestions.length).toBe(0);
      }
    },
  );
});

describe("sentinel — sinônimos do catálogo", () => {
  it.each(Object.entries(sentinelThemeSynonyms))(
    "sinônimo de %s associa ao tema pai",
    (theme, synonyms) => {
      const sample = synonyms[0];
      expect(sample).toBeTruthy();

      const withTheme = buildSentinelTestProfile({ sentinelThemes: [theme], oppositionThemes: [] });
      const withoutTheme = buildSentinelTestProfile({ sentinelThemes: [], oppositionThemes: [] });

      const headline = `Campinas discute ${sample} em audiência pública`;
      const matchesWith = matchSentinelThemes(headline, withTheme.sentinelThemes);
      const matchesWithout = matchSentinelThemes(headline, withoutTheme.sentinelThemes);

      expect(matchesWith).toContain(theme);
      expect(matchesWithout).not.toContain(theme);
    },
  );
});

describe("sentinel — combinações de radar", () => {
  it("perfil completo fixture: mandato + oposição sem vazamento", () => {
    const profile = buildSentinelTestProfile({
      sentinelThemes: ["Vacinação", "Segurança Pública"],
      oppositionThemes: ["Combate à Corrupção"],
    });

    const { suggestions } = runSentinelPipelineOnArticles(fixtureArticles, profile);
    assertSuggestionsMatchProfileRadar(suggestions, profile);
    expect(suggestions.length).toBeGreaterThanOrEqual(2);
  });

  it("radar vazio não gera sugestões", () => {
    const profile = buildSentinelTestProfile({
      sentinelThemes: [],
      oppositionThemes: [],
      customRadarThemes: [],
    });

    const { suggestions } = runSentinelPipelineOnArticles(fixtureArticles, profile);
    expect(suggestions).toEqual([]);
  });
});
