import { describe, expect, it } from "vitest";

import type { MockSentinelSuggestion } from "./sentinel-mock-suggestions";
import {
  SCENARIO_JERICOACOARA,
  buildMunicipalTestProfile,
  evaluateMunicipalFeedQuality,
  evaluateMunicipalQueryShape,
  matchesCityGeo,
  matchesRadarTheme,
} from "./sentinel-quality-municipal";
import { buildSentinelRssQueries } from "./sentinel-rss";
import { normalizeSentinelText } from "./sentinel-text";

function card(
  overrides: Partial<MockSentinelSuggestion> & {
    title: string;
    publishedAt?: string;
  },
): MockSentinelSuggestion {
  const { title, publishedAt, ...rest } = overrides;
  return {
    id: rest.id ?? title,
    themeLabel: rest.themeLabel ?? "Segurança Pública",
    matchedThemes: rest.matchedThemes ?? ["Segurança Pública"],
    relevanceScore: rest.relevanceScore ?? 70,
    topic: rest.topic ?? title,
    briefing: rest.briefing,
    creativeAngle: rest.creativeAngle,
    evidence: {
      postsAnalyzed: 1,
      outletCount: 1,
      engagementTrendPercent: 0,
      byNetwork: [],
      actors: [],
      articles: [
        {
          title,
          url: "https://example.com/n",
          sourceName: "O Povo",
          publishedAt,
        },
      ],
    },
    engagement: {
      relevanceScore: 70,
      scoreTrendPercent: 0,
      likes: 0,
      comments: 0,
      postsAnalyzed: 1,
      sources: [],
      byNetwork: [],
    },
    ...rest,
  };
}

describe("sentinel-quality-municipal", () => {
  const scenario = SCENARIO_JERICOACOARA;
  const profile = buildMunicipalTestProfile(scenario);

  it("monta queries com município IBGE + UF e tema×cidade", () => {
    const queries = buildSentinelRssQueries(profile);
    const shape = evaluateMunicipalQueryShape(queries, scenario);
    expect(shape.ok).toBe(true);
    expect(
      queries.some((query) =>
        normalizeSentinelText(query).includes("jijoca de jericoacoara ceara"),
      ),
    ).toBe(true);
  });

  it("reconhece apelidos Jericoacoara/Jeri no título", () => {
    expect(
      matchesCityGeo(
        normalizeSentinelText("Temporada em Jericoacoara supera 2024"),
        scenario,
      ),
    ).toBe(true);
    expect(
      matchesCityGeo(normalizeSentinelText("Praia de Jeri recebe reforma"), scenario),
    ).toBe(true);
    expect(matchesCityGeo(normalizeSentinelText("Fortaleza tem blitz"), scenario)).toBe(
      false,
    );
    expect(
      matchesCityGeo(
        normalizeSentinelText("Inflação nos EUA desacelera, diz CNN Brasil"),
        scenario,
      ),
    ).toBe(false);
  });

  it("nao conta municipio herdado so no topic — olha titulo da materia", () => {
    const now = Date.parse("2026-07-31T12:00:00.000Z");
    const report = evaluateMunicipalFeedQuality(
      {
        suggestions: [
          card({
            title: "Inflação nos EUA desacelera, diz CNN",
            themeLabel: "Inflação e Preços",
            topic: "Inflação e Preços · Jijoca de Jericoacoara",
            publishedAt: "2026-07-28T10:00:00.000Z",
          }),
          card({
            title: "IPCA sobe em Sao Paulo",
            themeLabel: "Inflação e Preços",
            topic: "Inflação · Jijoca de Jericoacoara Ceará",
            publishedAt: "2026-07-27T10:00:00.000Z",
          }),
        ],
        meta: {
          source: "sentinel-v2-pipelines",
          cached: false,
          refreshedAt: new Date(now).toISOString(),
          radarThemesCount: 4,
          articlesScanned: 20,
          portalsMonitored: 5,
        },
        profile,
        scenario,
      },
      { nowMs: now, minCards: 2, requireCityHit: true },
    );

    expect(report.stats.cityHits).toBe(0);
    expect(report.ok).toBe(false);
    expect(report.failures.some((f) => /municipal|regional/i.test(f))).toBe(true);
  });

  it("aprova feed atual com geo + temas do radar", () => {
    const now = Date.parse("2026-07-31T12:00:00.000Z");
    const report = evaluateMunicipalFeedQuality(
      {
        suggestions: [
          card({
            title: "Jericoacoara reforça policiamento na alta temporada",
            themeLabel: "Segurança Pública",
            publishedAt: "2026-07-28T10:00:00.000Z",
          }),
          card({
            title: "Saneamento avança em Jijoca de Jericoacoara",
            themeLabel: "Saneamento Básico",
            publishedAt: "2026-07-25T10:00:00.000Z",
          }),
          card({
            title: "Turismo no Ceará cresce no litoral oeste",
            themeLabel: "turismo",
            matchedThemes: ["turismo"],
            publishedAt: "2026-07-20T10:00:00.000Z",
          }),
        ],
        meta: {
          source: "sentinel-v2-pipelines",
          cached: false,
          refreshedAt: new Date(now).toISOString(),
          radarThemesCount: 6,
          articlesScanned: 40,
          portalsMonitored: 5,
        },
        profile,
        scenario,
      },
      { nowMs: now, maxAgeDays: 14 },
    );

    expect(report.ok).toBe(true);
    expect(report.stats.cityHits).toBeGreaterThanOrEqual(2);
    expect(report.stats.freshCount).toBe(3);
    expect(report.stats.themeAligned).toBe(3);
  });

  it("reprova feed velho sem menção à região", () => {
    const now = Date.parse("2026-07-31T12:00:00.000Z");
    const report = evaluateMunicipalFeedQuality(
      {
        suggestions: [
          card({
            title: "Desemprego cai no Sudeste",
            themeLabel: "Desemprego",
            matchedThemes: ["Desemprego"],
            publishedAt: "2025-01-01T10:00:00.000Z",
          }),
          card({
            title: "Inflação sobe em São Paulo",
            themeLabel: "Inflação e Preços",
            publishedAt: "2025-02-01T10:00:00.000Z",
          }),
        ],
        meta: {
          source: "sentinel-v2-pipelines",
          cached: false,
          refreshedAt: new Date(now).toISOString(),
          radarThemesCount: 4,
          articlesScanned: 20,
          portalsMonitored: 5,
        },
        profile,
        scenario,
      },
      { nowMs: now, maxAgeDays: 14, minCards: 2 },
    );

    expect(report.ok).toBe(false);
    expect(report.failures.some((f) => /velhas|regional|municipal|Temas/i.test(f))).toBe(
      true,
    );
  });

  it("matchesRadarTheme aceita customThemes", () => {
    const suggestion = card({
      title: "Turismo em Jeri",
      themeLabel: "turismo",
      matchedThemes: ["turismo"],
    });
    expect(matchesRadarTheme(suggestion, scenario)).toBe(true);
  });
});
