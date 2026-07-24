import { describe, expect, it } from "vitest";

import type { MockSentinelSuggestion } from "./sentinel-mock-suggestions";
import { evaluateSentinelFeedQuality } from "./sentinel-quality-assertions";

function card(
  overrides: Partial<MockSentinelSuggestion> & { title: string },
): MockSentinelSuggestion {
  const { title, ...rest } = overrides;
  return {
    id: rest.id ?? title,
    themeLabel: rest.themeLabel ?? "Desemprego",
    matchedThemes: rest.matchedThemes ?? ["Desemprego"],
    relevanceScore: rest.relevanceScore ?? 70,
    topic: rest.topic ?? `Desemprego · ${title}`,
    briefing: rest.briefing,
    creativeAngle: rest.creativeAngle,
    evidence: {
      postsAnalyzed: 1,
      outletCount: 1,
      engagementTrendPercent: 0,
      byNetwork: [],
      actors: [],
      articles: [{ title, url: "https://x.com", sourceName: "X" }],
    },
    engagement: {
      relevanceScore: 70,
      scoreTrendPercent: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      postsAnalyzed: 1,
      sources: [],
      byNetwork: [],
    },
    ...rest,
  };
}

describe("evaluateSentinelFeedQuality", () => {
  it("reprova feed cheio de classificado", () => {
    const report = evaluateSentinelFeedQuality({
      suggestions: [
        card({ title: "IEL abre vagas de estágio em Minas" }),
        card({ title: "Tem emprego! Empresa abre 23 vagas" }),
        card({ title: "Saiba como se candidatar às vagas do Sine" }),
        card({ title: "Bradesco abre programa de estágio" }),
      ],
    });
    expect(report.ok).toBe(false);
    expect(report.failures.some((f) => f.includes("Classificados"))).toBe(true);
  });

  it("aprova feed diversificado com rank e briefing", () => {
    const report = evaluateSentinelFeedQuality(
      {
        suggestions: [
          card({
            themeLabel: "Desemprego",
            title: "Minas atinge menor taxa de desemprego desde 2012",
            briefing: "Dado oficial da FJP.",
            creativeAngle: "MG no menor desemprego da década",
          }),
          card({
            themeLabel: "Carga Tributária",
            title: "Carga tributária sobe a 32,4% do PIB",
            briefing: "Recorde histórico da série.",
            creativeAngle: "Imposto alto, retorno baixo",
          }),
          card({
            themeLabel: "Contratos Públicos",
            title: "TCEMG suspende licitação por cobrança irregular",
            briefing: "Tribunal freia edital irregular.",
            creativeAngle: "Fiscalização em licitação",
          }),
        ],
        meta: {
          source: "sentinel-v2-pipelines",
          cached: false,
          refreshedAt: new Date().toISOString(),
          radarThemesCount: 3,
          articlesScanned: 100,
          portalsMonitored: 4,
          qualityRankStats: {
            considered: 3,
            ranked: 3,
            llmCalls: 3,
            kept: 3,
            dropped: 0,
          },
        },
      },
      { expectQualityRank: true },
    );
    expect(report.ok).toBe(true);
    expect(report.stats.withBriefing).toBe(3);
  });

  it("aceita theme verify saudavel so com cacheHits", () => {
    const report = evaluateSentinelFeedQuality(
      {
        suggestions: [
          card({ title: "Minas atinge menor taxa de desemprego desde 2012" }),
          card({
            themeLabel: "Carga Tributária",
            title: "Carga tributária sobe a 32,4% do PIB",
          }),
          card({
            themeLabel: "Contratos Públicos",
            title: "TCEMG suspende licitação por cobrança irregular",
          }),
        ],
        meta: {
          source: "sentinel-v2-pipelines",
          cached: true,
          refreshedAt: new Date().toISOString(),
          radarThemesCount: 5,
          articlesScanned: 80,
          portalsMonitored: 4,
          themeVerificationStats: {
            articlesProcessed: 12,
            cacheHits: 12,
            llmCalls: 0,
            articlesRejected: 2,
          },
        },
      },
      { expectThemeVerify: true },
    );
    expect(report.ok).toBe(true);
    expect(report.stats.verifyCacheHits).toBe(12);
  });

  it("reprova theme verify morto com processed>0 e zero hits", () => {
    const report = evaluateSentinelFeedQuality(
      {
        suggestions: [
          card({ title: "Minas atinge menor taxa de desemprego desde 2012" }),
          card({
            themeLabel: "Carga Tributária",
            title: "Carga tributária sobe a 32,4% do PIB",
          }),
          card({
            themeLabel: "Contratos Públicos",
            title: "TCEMG suspende licitação por cobrança irregular",
          }),
        ],
        meta: {
          source: "sentinel-v2-pipelines",
          cached: false,
          refreshedAt: new Date().toISOString(),
          radarThemesCount: 5,
          articlesScanned: 80,
          portalsMonitored: 4,
          themeVerificationStats: {
            articlesProcessed: 10,
            cacheHits: 0,
            llmCalls: 0,
            articlesRejected: 0,
          },
        },
      },
      { expectThemeVerify: true },
    );
    expect(report.ok).toBe(false);
    expect(report.failures.some((f) => f.includes("Theme verify"))).toBe(true);
  });
});
