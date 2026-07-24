import { describe, expect, it } from "vitest";

import {
  isLikelyJobListingTitle,
  isWeakFakeNewsTitle,
  softQualityPenaltyForTitle,
} from "./sentinel-title-filters";
import { diversifySuggestionsByTheme } from "./sentinel-diversify";
import type { MockSentinelSuggestion } from "./sentinel-mock-suggestions";

describe("isLikelyJobListingTitle", () => {
  it("detecta classificados de estágio e candidatura", () => {
    expect(isLikelyJobListingTitle("IEL-MG abre vagas de estágio em Minas Gerais")).toBe(true);
    expect(
      isLikelyJobListingTitle("Bradesco abre inscrições para programa de estágio com vagas em MG"),
    ).toBe(true);
    expect(
      isLikelyJobListingTitle("Minas Gerais tem 14 mil vagas; saiba como se candidatar"),
    ).toBe(true);
  });

  it("nao marca fato politico de desemprego", () => {
    expect(
      isLikelyJobListingTitle("Minas Gerais atinge menor taxa de desemprego desde 2012"),
    ).toBe(false);
    expect(
      isLikelyJobListingTitle("Carga tributária do Brasil atinge recorde de 32,4% do PIB"),
    ).toBe(false);
  });
});

describe("isWeakFakeNewsTitle", () => {
  it("marca conteudo educativo generico", () => {
    expect(isWeakFakeNewsTitle("No Dia da Mentira, saiba identificar e como evitar as fake news")).toBe(
      true,
    );
    expect(isWeakFakeNewsTitle("Alerta de fake news! Barreiras continuam em funcionamento")).toBe(
      true,
    );
  });

  it("preserva fato politico sobre PL / TRE", () => {
    expect(
      isWeakFakeNewsTitle("TRE-MG firma pacto com partidos para combater fake news nas eleições"),
    ).toBe(false);
  });
});

describe("softQualityPenaltyForTitle", () => {
  it("aplica penalidade forte em classificado", () => {
    expect(softQualityPenaltyForTitle("Tem emprego! Empresa abre 23 vagas")).toBe(35);
  });
});

describe("diversifySuggestionsByTheme", () => {
  function card(id: string, theme: string, relevance: number): MockSentinelSuggestion {
    return {
      id,
      themeLabel: theme,
      matchedThemes: [theme],
      relevanceScore: relevance,
      topic: `${theme} · ${id}`,
      evidence: {
        postsAnalyzed: 1,
        outletCount: 1,
        engagementTrendPercent: 0,
        byNetwork: [],
        actors: [],
        articles: [{ title: id, url: "https://x.com", sourceName: "X" }],
      },
      engagement: {
        relevanceScore: relevance,
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

  it("limita cards por tema sem completar com o mesmo tema", () => {
    const input = [
      card("d1", "Desemprego", 90),
      card("d2", "Desemprego", 89),
      card("d3", "Desemprego", 88),
      card("d4", "Desemprego", 87),
      card("d5", "Desemprego", 86),
      card("c1", "Carga Tributária", 85),
      card("c2", "Carga Tributária", 84),
    ];
    const out = diversifySuggestionsByTheme(input, { maxTotal: 6, maxPerTheme: 2 });
    expect(out).toHaveLength(4);
    expect(out.filter((s) => s.themeLabel === "Desemprego")).toHaveLength(2);
    expect(out.filter((s) => s.themeLabel === "Carga Tributária")).toHaveLength(2);
  });
});
