import { describe, expect, it, vi } from "vitest";

import type { PoliticianProfile } from "@/lib/types";
import { invalidateSentinelCache } from "@/lib/sentinel-suggestions";

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
  argilAvatarId: "",
  argilVoiceId: "",
  avatarTrainingStatus: "",
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
});
