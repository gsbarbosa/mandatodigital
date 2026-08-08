import { describe, expect, it, vi } from "vitest";

import { buildOppositionPostSuggestions } from "./sentinel-opposition-posts";
import type { PoliticianProfile } from "./types";

vi.mock("./sentinel-rss", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./sentinel-rss")>();

  return {
    ...actual,
    fetchGoogleNewsQuery: vi.fn(async (query: string) => {
      if (query.includes("tiktokador")) {
        return [
          {
            title: "TikTokador critica projeto na camara",
            link: "https://noticias.exemplo.com/tiktokador-critica",
            pubDate: "2026-07-10T09:00:00.000Z",
            publishedAt: new Date("2026-07-10T09:00:00.000Z"),
            sourceName: "Exemplo News",
          },
        ];
      }
      return [];
    }),
  };
});

vi.mock("./sentinel-instagram-posts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./sentinel-instagram-posts")>();

  return {
    ...actual,
    isApifyReady: async () => true,
    fetchInstagramProfilePosts: vi.fn(async (handle: string) => {
      if (handle === "kimkataguiri") {
        return [
          {
            id: "post-1",
            url: "https://www.instagram.com/p/abc123/",
            caption: "Voto impresso e transparencia nas urnas agora",
            publishedAt: "2026-07-09T10:00:00.000Z",
            likes: 900,
            comments: 40,
            postType: "Image",
            ownerUsername: "kimkataguiri",
          },
        ];
      }

      return [
        {
          id: "post-2",
          url: "https://www.instagram.com/p/def456/",
          caption: "Reforma tributaria e carga fiscal sobre o trabalhador",
          publishedAt: "2026-07-08T08:00:00.000Z",
          likes: 500,
          comments: 20,
          postType: "Image",
          ownerUsername: "cirogomes",
        },
      ];
    }),
  };
});

const baseProfile: PoliticianProfile = {
  id: "test",
  fullName: "Test",
  role: "Deputado",
  city: "Sao Paulo",
  state: "SP",
  audience: "Eleitorado",
  spectrum: "Centro",
  archetype: "O Conciliador (Uniao/Pontes)",
  voiceTones: [],
  keyIssues: [],
  slogans: [],
  redLines: [],
  referenceExamples: [],
  bio: "Bio de teste com mais de vinte caracteres para validacao.",
  personaArchetypes: [],
  sentinelThemes: ["Reforma Fiscal"],
  sentinelThemesFederal: ["Reforma Fiscal"],
  sentinelThemesEstadual: [],
  customRadarThemes: [],
  municipalCities: [],
  interestProfiles: [],
  interestSites: [],
  oppositionThemes: ["Voto Impresso"],
  oppositionProfiles: [
    { handle: "@kimkataguiri", network: "Instagram" },
    { handle: "cirogomes", network: "Instagram" },
  ],
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
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("sentinel-opposition-posts", () => {
  it("monta sinais com posts reais do instagram, sem cruzar temas do radar", async () => {
    const suggestions = await buildOppositionPostSuggestions(baseProfile);

    expect(suggestions).toHaveLength(2);
    expect(suggestions.every((item) => item.evidence.articles?.length === 0)).toBe(true);
    expect(suggestions.every((item) => item.matchedThemes.every((theme) => theme.startsWith("@")))).toBe(
      true,
    );
    expect(suggestions[0]?.engagement.likes).toBeGreaterThanOrEqual(
      suggestions[1]?.engagement.likes ?? 0,
    );
    expect(suggestions.every((item) => item.evidence.actors?.[0]?.postUrl.includes("instagram.com/p/"))).toBe(
      true,
    );
  });

  it("usa fallback de Google News pra perfis de TikTok/X sem scraper dedicado", async () => {
    const profile: PoliticianProfile = {
      ...baseProfile,
      oppositionProfiles: [
        { handle: "@kimkataguiri", network: "Instagram" },
        { handle: "@tiktokador", network: "TikTok" },
        { handle: "@xador", network: "Twitter/X" },
      ],
    };

    const suggestions = await buildOppositionPostSuggestions(profile);

    const tiktokSuggestion = suggestions.find((item) =>
      item.evidence.actors?.[0]?.handle === "tiktokador",
    );
    expect(tiktokSuggestion).toBeDefined();
    expect(tiktokSuggestion?.evidence.actors?.[0]?.network).toBe("tiktok");
    expect(tiktokSuggestion?.evidence.articles?.[0]?.url).toBe(
      "https://noticias.exemplo.com/tiktokador-critica",
    );

    // @xador não teve nenhuma menção no mock do Google News, então não gera pauta — mas não quebra o fluxo.
    expect(suggestions.some((item) => item.evidence.actors?.[0]?.handle === "xador")).toBe(false);

    // Perfil do Instagram continua vindo normalmente pelo Apify.
    expect(
      suggestions.some((item) => item.evidence.actors?.[0]?.handle === "kimkataguiri"),
    ).toBe(true);
  });
});
