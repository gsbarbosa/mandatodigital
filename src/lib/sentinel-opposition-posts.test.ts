import { describe, expect, it, vi } from "vitest";

import { buildOppositionPostSuggestions } from "./sentinel-opposition-posts";
import type { PoliticianProfile } from "./types";

vi.mock("./sentinel-instagram-posts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./sentinel-instagram-posts")>();

  return {
    ...actual,
    isApifyConfigured: () => true,
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
            shares: 0,
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
          shares: 0,
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
  it("monta sinais apenas com posts reais do instagram, sem noticias externas", async () => {
    const suggestions = await buildOppositionPostSuggestions(baseProfile);

    expect(suggestions).toHaveLength(2);
    expect(suggestions.every((item) => item.evidence.articles?.length === 0)).toBe(true);
    expect(suggestions.some((item) => item.topic.includes("Voto impresso"))).toBe(true);
    expect(suggestions.some((item) => item.matchedThemes.includes("Reforma Fiscal"))).toBe(true);
    expect(suggestions.every((item) => item.evidence.actors?.[0]?.postUrl.includes("instagram.com/p/"))).toBe(
      true,
    );
  });
});
