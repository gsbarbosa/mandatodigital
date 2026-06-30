import { describe, expect, it } from "vitest";

import { stripHashtagsForThemeMatching } from "@/lib/sentinel-caption";
import {
  applyHeuristicEditorial,
  isCreativeGenerationAllowed,
  partitionSentinelSuggestions,
} from "@/lib/sentinel-editorial-gate";
import type { MockSentinelSuggestion } from "@/lib/sentinel-mock-suggestions";
import { correlateSocialSuggestionsWithRss } from "@/lib/sentinel-social-cross-match";
import { matchThemesWithSynonyms } from "@/lib/sentinel-theme-synonyms";

const bolsonaroCaption =
  "Jair Bolsonaro teve seu passaporte apreendido pela Polícia Federal em uma operação de busca e apreensão absolutamente arbitrária, supostamente motivada por um #vacina #sus #trabalhista";

function socialSuggestion(overrides: Partial<MockSentinelSuggestion> = {}): MockSentinelSuggestion {
  return {
    id: "sentinela-social-test",
    themeLabel: "Segurança Pública",
    matchedThemes: ["Segurança Pública"],
    relevanceScore: 88,
    pipeline: "social",
    topic: `Segurança Pública · @jair: ${bolsonaroCaption.slice(0, 80)}`,
    evidence: {
      postsAnalyzed: 1,
      outletCount: 1,
      engagementTrendPercent: 12,
      byNetwork: [{ network: "instagram", likes: 379000, comments: 20000, shares: 0 }],
      actors: [
        {
          handle: "jairmessiasbolsonaro",
          network: "instagram",
          postUrl: "https://instagram.com/p/test",
          sourceList: "opposition",
        },
      ],
      articles: [
        {
          title: bolsonaroCaption,
          url: "https://instagram.com/p/test",
          sourceName: "Instagram",
        },
      ],
    },
    engagement: {
      relevanceScore: 88,
      scoreTrendPercent: 12,
      likes: 379000,
      comments: 20000,
      shares: 0,
      postsAnalyzed: 1,
      sources: ["instagram"],
      byNetwork: [{ network: "instagram", likes: 379000, comments: 20000, shares: 0 }],
    },
    ...overrides,
  };
}

describe("sentinel-caption", () => {
  it("remove hashtags antes do match de temas", () => {
    expect(stripHashtagsForThemeMatching("texto #vacina #sus fim")).toBe("texto fim");
    expect(matchThemesWithSynonyms(bolsonaroCaption, ["Vacinação", "Saúde Pública (SUS)"])).toEqual(
      [],
    );
    expect(matchThemesWithSynonyms(bolsonaroCaption, ["Segurança Pública"])).toContain(
      "Segurança Pública",
    );
  });
});

describe("sentinel-editorial-gate", () => {
  it("bloqueia criativo para social de oposição sem imprensa", () => {
    const enriched = applyHeuristicEditorial(socialSuggestion());
    expect(enriched.editorial?.signalKind).toBe("social_monitoring");
    expect(enriched.editorial?.creativeWorthy).toBe(false);
    expect(enriched.editorial?.viralScore).toBe(88);
    expect(enriched.relevanceScore).toBeLessThan(60);
    expect(isCreativeGenerationAllowed(enriched)).toBe(false);
  });

  it("libera criativo para RSS com multiplos veiculos", () => {
    const rss = applyHeuristicEditorial(
      socialSuggestion({
        pipeline: "portal",
        relevanceScore: 72,
        evidence: {
          ...socialSuggestion().evidence,
          outletCount: 3,
          byNetwork: [],
          actors: [],
        },
      }),
    );

    expect(isCreativeGenerationAllowed(rss)).toBe(true);
  });

  it("particiona oportunidades e monitoramento", () => {
    const monitoring = applyHeuristicEditorial(socialSuggestion());
    const opportunity = applyHeuristicEditorial(
      socialSuggestion({
        pipeline: "portal",
        evidence: { ...socialSuggestion().evidence, outletCount: 3 },
      }),
    );

    const parts = partitionSentinelSuggestions([monitoring, opportunity]);
    expect(parts.monitoring).toHaveLength(1);
    expect(parts.opportunities).toHaveLength(1);
  });
});

describe("sentinel-social-cross-match", () => {
  it("promove social quando RSS cobre o mesmo assunto", () => {
    const social = socialSuggestion();
    const rss: MockSentinelSuggestion = {
      ...social,
      id: "rss-1",
      pipeline: "portal",
      topic: "Segurança Pública · PF apreende passaporte de Bolsonaro em operação",
      evidence: {
        ...social.evidence,
        outletCount: 2,
        articles: [
          {
            title: "PF apreende passaporte de Bolsonaro em operação de busca",
            url: "https://g1.globo.com/politica/noticia.ghtml",
            sourceName: "G1",
          },
          {
            title: "Operação da Polícia Federal mira passaporte de ex-presidente",
            url: "https://folha.com.br/politica",
            sourceName: "Folha",
          },
        ],
      },
    };

    const [promoted] = correlateSocialSuggestionsWithRss([social], [rss]);
    expect(promoted?.editorial?.signalKind).toBe("social_promoted");
    expect(promoted?.editorial?.creativeWorthy).toBe(true);
    expect((promoted?.evidence.articles ?? []).length).toBeGreaterThan(1);
    expect(isCreativeGenerationAllowed(promoted!)).toBe(true);
  });
});
