import { expect, type APIRequestContext } from "@playwright/test";

import type { PoliticianProfile } from "@/lib/types";

type SentinelRadarInput = {
  city?: string;
  state?: string;
  sentinelThemes?: string[];
  oppositionThemes?: string[];
  customRadarThemes?: string[];
};

const SENTINEL_E2E_BASE_PROFILE = {
  fullName: "[AUTOTEST] Sentinela Radar",
  role: "Vereador",
  audience: "Eleitorado local",
  spectrum: "Centro",
  archetype: "O Conciliador (Uniao/Pontes)",
  voiceTones: [] as string[],
  keyIssues: ["Saude publica"],
  slogans: ["Campinas em primeiro lugar"],
  redLines: ["nao inventar dado"],
  referenceExamples: ["linguagem simples e local"],
  bio: "Mandato de teste automatizado do Sentinela com foco em pautas locais de Campinas.",
  personaArchetypes: [] as string[],
  interestProfiles: [] as string[],
  interestSites: [] as string[],
  oppositionProfiles: [] as string[],
  oppositionSites: [] as string[],
  glossaryTerms: [] as string[],
  trainingReferenceLinks: [] as string[],
  youtubeVideoUrl: "",
  avatarType: "",
  avatarVideoTopic: "",
  argilAvatarId: "",
  argilVoiceId: "",
  avatarTrainingStatus: "",
  notificationEmail: "",
  avatarEmotions: [] as string[],
  voicePace: "Manter velocidade original",
  editingStyles: [] as string[],
  factCheckingSources: [] as string[],
  hardDataSources: [] as string[],
  distributionChannels: [] as string[],
  distributionWindows: [] as string[],
  autoPublish: false,
};

export async function saveSentinelRadarProfile(
  request: APIRequestContext,
  radar: SentinelRadarInput = {},
) {
  const response = await request.put("/api/profile", {
    data: {
      ...SENTINEL_E2E_BASE_PROFILE,
      city: radar.city ?? "Campinas",
      state: radar.state ?? "SP",
      sentinelThemes: radar.sentinelThemes ?? ["Vacinação"],
      oppositionThemes: radar.oppositionThemes ?? [],
      customRadarThemes: radar.customRadarThemes ?? [],
      draftSave: true,
    },
  });

  expect(response.status()).toBe(200);
  return (await response.json()) as { profile: PoliticianProfile };
}

export async function refreshSentinelSignals(request: APIRequestContext) {
  const response = await request.post("/api/sentinel/refresh");
  expect(response.status()).toBe(200);
  return (await response.json()) as {
    suggestions: Array<{
      id: string;
      themeLabel: string;
      matchedThemes: string[];
      topic: string;
    }>;
    meta?: {
      articlesScanned?: number;
      articlesMatchedRadar?: number;
      themeViolationsFiltered?: number;
      emptyReason?: string;
    };
  };
}

export function assertSentinelSuggestionsMatchRadar(
  suggestions: Array<{ themeLabel: string; matchedThemes: string[] }>,
  allowedThemes: string[],
) {
  const allowed = new Set(allowedThemes.map((theme) => theme.toLowerCase()));

  expect(suggestions.length).toBeGreaterThan(0);

  for (const suggestion of suggestions) {
    expect(allowed.has(suggestion.themeLabel.toLowerCase())).toBe(true);

    for (const theme of suggestion.matchedThemes) {
      expect(allowed.has(theme.toLowerCase())).toBe(true);
    }
  }
}
