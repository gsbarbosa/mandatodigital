import { describe, expect, it } from "vitest";

import type { MockSentinelSuggestion } from "./sentinel-mock-suggestions";
import {
  SENTINEL_PAUTAVEL_THRESHOLD,
  buildSentinelQualityReport,
  estimateSentinelLlmCost,
  scoreSuggestionPautavel,
} from "./sentinel-quality";

function newsCard(overrides: Partial<MockSentinelSuggestion> = {}): MockSentinelSuggestion {
  return {
    id: "n1",
    themeLabel: "Desemprego",
    matchedThemes: ["Desemprego"],
    relevanceScore: 72,
    topic: "Desemprego · Taxa cai a 5,6% no trimestre, diz IBGE",
    evidence: {
      postsAnalyzed: 2,
      outletCount: 2,
      engagementTrendPercent: 0,
      byNetwork: [],
      actors: [],
      articles: [
        {
          title: "Taxa de desemprego cai a 5,6% no trimestre até maio, diz IBGE",
          url: "https://g1.globo.com/exemplo",
          sourceName: "G1",
        },
      ],
    },
    engagement: {
      relevanceScore: 72,
      scoreTrendPercent: 10,
      likes: 0,
      comments: 0,
      shares: 0,
      postsAnalyzed: 2,
      sources: [],
      byNetwork: [],
    },
    ...overrides,
  };
}

describe("scoreSuggestionPautavel", () => {
  it("marca card forte de noticia como pautavel", () => {
    const scored = scoreSuggestionPautavel(newsCard());
    expect(scored.kind).toBe("news");
    expect(scored.score).toBeGreaterThanOrEqual(SENTINEL_PAUTAVEL_THRESHOLD);
    expect(scored.pautavel).toBe(true);
  });

  it("penaliza classificado de vagas", () => {
    const scored = scoreSuggestionPautavel(
      newsCard({
        relevanceScore: 80,
        topic: "Desemprego · IEL abre vagas de estágio",
        evidence: {
          postsAnalyzed: 1,
          outletCount: 2,
          engagementTrendPercent: 0,
          byNetwork: [],
          actors: [],
          articles: [
            {
              title: "IEL-MG abre vagas de estágio em Minas Gerais com bolsas",
              url: "https://x.com",
              sourceName: "Itatiaia",
            },
          ],
        },
      }),
    );
    expect(scored.reasons).toContain("classificado de vagas");
    expect(scored.pautavel).toBe(false);
  });
});

describe("buildSentinelQualityReport", () => {
  it("calcula % pautavel so em news", () => {
    const report = buildSentinelQualityReport([
      newsCard({ id: "a" }),
      newsCard({
        id: "b",
        relevanceScore: 10,
        topic: "x",
        evidence: {
          postsAnalyzed: 0,
          outletCount: 0,
          engagementTrendPercent: 0,
          byNetwork: [],
          actors: [],
          articles: [],
        },
      }),
      newsCard({
        id: "opp",
        themeLabel: "Ação da Oposição",
        evidence: {
          postsAnalyzed: 1,
          outletCount: 0,
          engagementTrendPercent: 0,
          byNetwork: [],
          actors: [
            {
              handle: "fulano",
              network: "instagram",
              postUrl: "https://instagram.com/p/1",
              sourceList: "opposition",
            },
          ],
          articles: [],
        },
      }),
    ]);
    expect(report.newsTotal).toBe(2);
    expect(report.oppositionTotal).toBe(1);
    expect(report.newsPautavel).toBe(1);
    expect(report.newsPautavelPercent).toBe(50);
  });
});

describe("estimateSentinelLlmCost", () => {
  it("estima custo > 0 com chamadas", () => {
    const cost = estimateSentinelLlmCost({
      expansionCalls: 6,
      verifyLlmCalls: 20,
      qualityRankCalls: 10,
    });
    expect(cost.estimatedUsd).toBeGreaterThan(0);
    expect(cost.qualityRankCalls).toBe(10);
  });
});
