import { describe, expect, it, vi } from "vitest";

import type { MockSentinelSuggestion } from "@/lib/sentinel-mock-suggestions";
import type { PoliticianProfile } from "@/lib/types";
import {
  buildRadarThemesSignature,
  filterSuggestionsForProfile,
  invalidateSentinelCache,
} from "@/lib/sentinel-suggestions";

vi.mock("@/lib/sentinel-rss", () => ({
  fetchSentinelNewsItems: vi.fn(async () => []),
  clusterScoredArticles: vi.fn(() => []),
  countUniqueOutlets: vi.fn(() => 0),
  matchSentinelThemes: vi.fn(() => []),
  scoreSentinelArticle: vi.fn(() => 0),
}));

const profile: PoliticianProfile = {
  id: "profile-cache-test",
  fullName: "Teste",
  role: "Vereador",
  city: "Campinas",
  state: "SP",
  audience: "Eleitorado",
  spectrum: "Centro",
  archetype: "O Conciliador (Uniao/Pontes)",
  voiceTones: [],
  keyIssues: ["Saude"],
  slogans: [],
  redLines: [],
  referenceExamples: [],
  bio: "Bio de teste com mais de vinte caracteres para validacao.",
  personaArchetypes: [],
  sentinelThemes: ["Vacinacao"],
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
};

describe("sentinel-suggestions cache", () => {
  it("invalida cache em memoria sem erro", () => {
    expect(() => invalidateSentinelCache(profile.id)).not.toThrow();
  });

  it("muda assinatura quando temas do radar mudam", () => {
    const before = buildRadarThemesSignature({
      ...profile,
      sentinelThemesFederal: ["Reforma Fiscal"],
      sentinelThemesEstadual: [],
    });
    const after = buildRadarThemesSignature({
      ...profile,
      sentinelThemesFederal: ["Subsidios Estatais"],
      sentinelThemesEstadual: [],
    });

    expect(before).not.toBe(after);
  });

  it("remove sugestoes de temas que sairam do radar", () => {
    const activeProfile = {
      ...profile,
      sentinelThemesFederal: ["Subsidios Estatais", "Endurecimento de Penas"],
      sentinelThemesEstadual: [],
    } as PoliticianProfile;

    const suggestions: MockSentinelSuggestion[] = [
      {
        id: "keep",
        themeLabel: "Subsidios Estatais",
        matchedThemes: ["Subsidios Estatais"],
        topic: "Subsidios",
        relevanceScore: 80,
        evidence: {
          postsAnalyzed: 1,
          outletCount: 1,
          byNetwork: [],
          actors: [],
          articles: [],
          engagementTrendPercent: 0,
        },
        engagement: {
          relevanceScore: 80,
          scoreTrendPercent: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          postsAnalyzed: 1,
          sources: [],
          byNetwork: [],
        },
      },
      {
        id: "drop",
        themeLabel: "Desemprego",
        matchedThemes: ["Desemprego"],
        topic: "Desemprego",
        relevanceScore: 70,
        evidence: {
          postsAnalyzed: 1,
          outletCount: 1,
          byNetwork: [],
          actors: [],
          articles: [],
          engagementTrendPercent: 0,
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
      },
    ];

    const filtered = filterSuggestionsForProfile(activeProfile, suggestions);
    expect(filtered.map((item) => item.id)).toEqual(["keep"]);
  });

  it("descarta card cujo tema principal saiu do radar mesmo com matchedThemes residual", () => {
    const activeProfile = {
      ...profile,
      sentinelThemesFederal: ["Reforma Fiscal", "Subsidios Estatais", "Privatizacoes"],
      sentinelThemesEstadual: [],
      sentinelThemes: ["Reforma Fiscal", "Subsidios Estatais", "Privatizacoes"],
    } as PoliticianProfile;

    const suggestions: MockSentinelSuggestion[] = [
      {
        id: "cameras-orphan",
        themeLabel: "Cameras Corporais",
        matchedThemes: ["Cameras Corporais", "Privatizacoes"],
        topic: "Cameras",
        relevanceScore: 90,
        evidence: {
          postsAnalyzed: 1,
          outletCount: 1,
          byNetwork: [],
          actors: [],
          articles: [],
          engagementTrendPercent: 0,
        },
        engagement: {
          relevanceScore: 90,
          scoreTrendPercent: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          postsAnalyzed: 1,
          sources: [],
          byNetwork: [],
        },
      },
    ];

    expect(filterSuggestionsForProfile(activeProfile, suggestions)).toEqual([]);
  });

  it("retorna meta consistente quando radar esta vazio", async () => {
    const { getSentinelSuggestions } = await import("@/lib/sentinel-suggestions");
    const emptyProfile = {
      ...profile,
      sentinelThemes: [],
      customRadarThemes: [],
      interestSites: [],
      oppositionSites: [],
    };

    const result = await getSentinelSuggestions(emptyProfile);
    expect(result.suggestions).toEqual([]);
    expect(result.meta.emptyReason).toContain("Configure temas");
    expect(result.meta.source).toBe("google-news-rss+portals");
  });

  it("nao varre noticias no GET quando nao ha cache", async () => {
    const { fetchSentinelNewsItems } = await import("@/lib/sentinel-rss");
    const { getSentinelSuggestions } = await import("@/lib/sentinel-suggestions");
    const fetchMock = vi.mocked(fetchSentinelNewsItems);
    fetchMock.mockClear();

    const activeProfile = {
      ...profile,
      id: "profile-no-cache-get",
      sentinelThemesFederal: ["Reforma Fiscal"],
      sentinelThemesEstadual: [],
      sentinelThemes: ["Reforma Fiscal"],
    } as PoliticianProfile;

    const result = await getSentinelSuggestions(activeProfile);
    expect(result.suggestions).toEqual([]);
    expect(result.meta.emptyReason).toMatch(/Atualizar pautas/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
