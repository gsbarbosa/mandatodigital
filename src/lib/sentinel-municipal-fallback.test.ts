import { describe, expect, it } from "vitest";

import type { MockSentinelSuggestion } from "./sentinel-mock-suggestions";
import {
  MUNICIPAL_GEO_FALLBACK_THEME,
  MUNICIPAL_PORTAL_FALLBACK_THEME,
  articleMentionsMunicipalCity,
  isMunicipalGeoFallbackSuggestion,
  isMunicipalPortalFallbackSuggestion,
  promoteMunicipalGeoFallback,
  promoteMunicipalPortalFallback,
} from "./sentinel-municipal-fallback";
import type { RssNewsItem } from "./sentinel-rss";
import type { PoliticianProfile } from "./types";

const profile: PoliticianProfile = {
  id: "p1",
  fullName: "Teste Arcos",
  role: "Prefeito",
  city: "Arcos",
  state: "MG",
  audience: "",
  spectrum: "",
  archetype: "",
  voiceTones: [],
  keyIssues: [],
  slogans: [],
  redLines: [],
  referenceExamples: [],
  bio: "",
  personaArchetypes: [],
  sentinelThemes: ["Segurança Pública", "Educação Básica"],
  sentinelThemesFederal: ["Segurança Pública", "Educação Básica"],
  sentinelThemesEstadual: ["Segurança Pública", "Educação Básica"],
  oppositionThemes: [],
  customRadarThemes: [],
  municipalCities: ["Arcos"],
  interestProfiles: [],
  interestSites: [],
  oppositionProfiles: [],
  oppositionSites: [],
  glossaryTerms: [],
  trainingReferenceLinks: [],
  youtubeVideoUrl: "",
  avatarType: "",
  avatarVideoTopic: "",
  notificationEmail: "",
  avatarEmotions: [],
  voicePace: "",
  editingStyles: [],
  factCheckingSources: [],
  hardDataSources: [],
  distributionChannels: [],
  distributionWindows: [],
  autoPublish: false,
  updatedAt: new Date().toISOString(),
};

function rss(title: string, link: string, publishedAt?: Date): RssNewsItem {
  return {
    title,
    link,
    sourceName: "Portal Arcos",
    siteHost: "portal arcos.com.br",
    pubDate: publishedAt?.toISOString() ?? null,
    publishedAt: publishedAt ?? null,
    origin: "google-news",
  };
}

const profileWithPortal: PoliticianProfile = {
  ...profile,
  interestSites: ["https://www.portalarcos.com.br/"],
};

function portalRss(title: string, link: string, publishedAt?: Date): RssNewsItem {
  return {
    title,
    link,
    sourceName: "Portal Arcos",
    siteHost: "portalarcos.com.br",
    pubDate: publishedAt?.toISOString() ?? null,
    publishedAt: publishedAt ?? null,
    origin: "portal-rss",
    siteList: "interest",
  };
}

function themedCard(title: string): MockSentinelSuggestion {
  return {
    id: "themed-1",
    themeLabel: "Segurança Pública",
    matchedThemes: ["Segurança Pública"],
    relevanceScore: 70,
    topic: `Segurança Pública · ${title}`,
    evidence: {
      postsAnalyzed: 1,
      outletCount: 1,
      engagementTrendPercent: 0,
      byNetwork: [],
      actors: [],
      articles: [{ title, url: "https://x.com/1", sourceName: "G1" }],
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
  };
}

describe("sentinel-municipal-fallback", () => {
  it("detecta cidade no titulo", () => {
    expect(
      articleMentionsMunicipalCity("MP destina viatura em Arcos", profile),
    ).toBe("Arcos");
    expect(articleMentionsMunicipalCity("Assalto em Belo Horizonte", profile)).toBeNull();
  });

  it("promove noticias locais quando nao ha card municipal tematico", () => {
    const now = Date.parse("2026-07-31T12:00:00.000Z");
    const result = promoteMunicipalGeoFallback({
      profile,
      suggestions: [
        themedCard("Inflação sobe no Brasil"), // nacional — sem Arcos
      ],
      articles: [
        rss(
          "Feira livre de Arcos reabre no centro",
          "https://local/1",
          new Date("2026-07-28T10:00:00.000Z"),
        ),
        rss(
          "Campeonato de futebol em Arcos atrai publico",
          "https://local/2",
          new Date("2026-07-20T10:00:00.000Z"),
        ),
      ],
      nowMs: now,
    });

    expect(result.meta?.reason).toBe("themes_missed");
    expect(result.meta?.promotedCount).toBe(2);
    expect(result.meta?.themesMissed).toContain("Segurança Pública");
    expect(result.meta?.foundTopics.length).toBeGreaterThan(0);
    expect(
      result.suggestions.some((s) => isMunicipalGeoFallbackSuggestion(s)),
    ).toBe(true);
    expect(
      result.suggestions.filter((s) => s.themeLabel === MUNICIPAL_GEO_FALLBACK_THEME),
    ).toHaveLength(2);
  });

  it("nao promove se ja existe card municipal do tema", () => {
    const result = promoteMunicipalGeoFallback({
      profile,
      suggestions: [themedCard("Policia reforca patrulha em Arcos")],
      articles: [
        rss("Feira livre de Arcos reabre", "https://local/1", new Date()),
      ],
    });

    expect(result.meta).toBeUndefined();
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]?.themeLabel).toBe("Segurança Pública");
  });

  it("ignora artigo que ja casa tema do radar", () => {
    const result = promoteMunicipalGeoFallback({
      profile,
      suggestions: [],
      articles: [
        rss(
          "Segurança Pública: PM recebe viatura em Arcos",
          "https://local/tema",
          new Date(),
        ),
      ],
    });

    // Sem promoção geo (seria path temático); meta com promotedCount 0.
    expect(result.meta?.promotedCount).toBe(0);
    expect(result.suggestions).toHaveLength(0);
  });

  it("troca o card tematico sem citar a cidade pelas noticias do portal cadastrado", () => {
    // Tema personalizado (esfera municipal pelo catálogo) casando em outra cidade —
    // é assim que a busca ampla classifica "municipal" sem nenhuma matéria citar Arcos.
    const profileWithCustomTheme: PoliticianProfile = {
      ...profileWithPortal,
      customRadarThemes: ["Mobilidade Urbana"],
    };
    const wrongCityCard: MockSentinelSuggestion = {
      ...themedCard("Mobilidade urbana avança em Uberlândia"),
      themeLabel: "Mobilidade Urbana",
      matchedThemes: ["Mobilidade Urbana"],
      evidence: {
        postsAnalyzed: 1,
        outletCount: 1,
        engagementTrendPercent: 0,
        byNetwork: [],
        actors: [],
        articles: [
          {
            title: "Mobilidade urbana avança em Uberlândia",
            url: "https://x.com/1",
            sourceName: "G1",
          },
        ],
      },
    };

    const result = promoteMunicipalPortalFallback({
      profile: profileWithCustomTheme,
      suggestions: [wrongCityCard],
      articles: [
        portalRss(
          "Prefeitura de Arcos divulga horários de ônibus",
          "https://portalarcos.com.br/1",
          new Date("2026-08-01T10:00:00.000Z"),
        ),
        portalRss(
          "Feira de artesanato acontece neste fim de semana",
          "https://portalarcos.com.br/2",
          new Date("2026-07-30T10:00:00.000Z"),
        ),
        portalRss(
          "Prefeitura anuncia obra na praça central",
          "https://portalarcos.com.br/3",
          new Date("2026-07-25T10:00:00.000Z"),
        ),
        portalRss(
          "Notícia mais antiga, fora do top 3",
          "https://portalarcos.com.br/4",
          new Date("2026-07-01T10:00:00.000Z"),
        ),
      ],
    });

    expect(result.meta?.reason).toBe("portal_no_theme_match");
    expect(result.meta?.promotedCount).toBe(3);
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]?.themeLabel).toBe(MUNICIPAL_PORTAL_FALLBACK_THEME);
    expect(isMunicipalPortalFallbackSuggestion(result.suggestions[0]!)).toBe(true);
    expect(result.suggestions[0]?.evidence.articles).toHaveLength(3);
    // Mais recentes primeiro; a 4ª (mais antiga) fica de fora.
    expect(result.suggestions[0]?.evidence.articles?.[0]?.url).toBe("https://portalarcos.com.br/1");
    expect(
      result.suggestions[0]?.evidence.articles?.some((a) => a.url === "https://portalarcos.com.br/4"),
    ).toBe(false);
  });

  it("nao mexe em nada quando ja existe card tematico citando a cidade de verdade", () => {
    const result = promoteMunicipalPortalFallback({
      profile: profileWithPortal,
      suggestions: [themedCard("Policia reforca patrulha em Arcos")],
      articles: [
        portalRss("Feira de artesanato", "https://portalarcos.com.br/1", new Date()),
      ],
    });

    expect(result.meta).toBeUndefined();
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]?.themeLabel).toBe("Segurança Pública");
  });

  it("nao faz nada quando nao ha artigo vindo do portal cadastrado", () => {
    const result = promoteMunicipalPortalFallback({
      profile: profileWithPortal,
      suggestions: [themedCard("Mobilidade urbana avança em Uberlândia")],
      articles: [
        rss("Notícia da busca ampla, não do portal", "https://x.com/1", new Date()),
      ],
    });

    expect(result.meta).toBeUndefined();
    expect(result.suggestions).toHaveLength(1);
  });

  it("nao faz nada quando o perfil nao tem portal cadastrado", () => {
    const result = promoteMunicipalPortalFallback({
      profile,
      suggestions: [themedCard("Mobilidade urbana avança em Uberlândia")],
      articles: [
        portalRss("Feira de artesanato", "https://portalarcos.com.br/1", new Date()),
      ],
    });

    expect(result.meta).toBeUndefined();
    expect(result.suggestions).toHaveLength(1);
  });
});
