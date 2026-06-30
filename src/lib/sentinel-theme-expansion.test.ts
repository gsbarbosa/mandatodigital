import { describe, expect, it } from "vitest";

import {
  collectExpansionSourceThemes,
  filterExpansionsForProfile,
  filterExpansionsForThemeSelection,
  flattenExpansionSearchTerms,
} from "@/lib/sentinel-theme-expansion";
import { sentinelStorage } from "@/lib/sentinel-storage";
import type { PoliticianProfile } from "@/lib/types";

function buildProfile(overrides: Partial<PoliticianProfile> = {}): PoliticianProfile {
  return {
    id: "profile-expansion-test",
    fullName: "Teste",
    role: "Vereador",
    city: "São Paulo",
    state: "SP",
    audience: "Eleitorado",
    spectrum: "Centro",
    archetype: "O Conciliador",
    voiceTones: [],
    keyIssues: [],
    slogans: [],
    redLines: [],
    referenceExamples: [],
    bio: "Bio de teste com mais de vinte caracteres para validacao.",
    personaArchetypes: [],
    sentinelThemes: ["Vacinação"],
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
    ...overrides,
  };
}

describe("sentinel-theme-expansion", () => {
  it("limita e deduplica termos de busca da expansao", () => {
    const terms = flattenExpansionSearchTerms([
      {
        sourceTheme: "Saude",
        expandedTerms: ["UBS", "SUS", "UBS", "vacina"],
        generatedAt: "2026-06-24T00:00:00.000Z",
      },
      {
        sourceTheme: "Educacao",
        expandedTerms: Array.from({ length: 25 }, (_, index) => `termo-${index}`),
        generatedAt: "2026-06-24T00:00:00.000Z",
      },
    ]);

    expect(terms).toContain("UBS");
    expect(terms.filter((term) => term === "UBS")).toHaveLength(1);
    expect(terms.length).toBeLessThanOrEqual(20);
  });

  it("filtra expansoes para mostrar só temas do radar atual", () => {
    const profile = buildProfile({
      sentinelThemes: ["Vacinação", "Piso Salarial"],
      oppositionThemes: [],
    });

    const filtered = filterExpansionsForProfile(
      [
        {
          sourceTheme: "Vacinação",
          expandedTerms: ["campanha de vacinacao"],
          generatedAt: "2026-06-24T00:00:00.000Z",
        },
        {
          sourceTheme: "Educação Superior",
          expandedTerms: ["FIES", "ProUni"],
          generatedAt: "2026-06-24T00:00:00.000Z",
        },
        {
          sourceTheme: "Piso Salarial",
          expandedTerms: ["salario minimo"],
          generatedAt: "2026-06-24T00:00:00.000Z",
        },
      ],
      profile,
    );

    expect(filtered.map((row) => row.sourceTheme)).toEqual(["Vacinação", "Piso Salarial"]);
    expect(collectExpansionSourceThemes(profile)).toEqual(["Vacinação", "Piso Salarial"]);
  });

  it("filtra expansoes pela selecao atual de temas", () => {
    const filtered = filterExpansionsForThemeSelection(
      [
        {
          sourceTheme: "Direito Trabalhista",
          expandedTerms: ["CLT"],
          generatedAt: "2026-06-24T00:00:00.000Z",
        },
        {
          sourceTheme: "Vacinação",
          expandedTerms: ["PNI"],
          generatedAt: "2026-06-24T00:00:00.000Z",
        },
      ],
      {
        sentinelThemes: ["Direito Trabalhista", "Desemprego"],
        oppositionThemes: [],
        customRadarThemes: [],
      },
    );

    expect(filtered.map((row) => row.sourceTheme)).toEqual(["Direito Trabalhista"]);
  });

  it("substitui expansoes locais ao salvar radar com menos temas", async () => {
    process.env.SENTINEL_PERSIST_CACHE = "true";
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const profileId = "profile-expansion-replace";

    await sentinelStorage.writeThemeExpansions(profileId, [
      {
        sourceTheme: "Vacinação",
        expandedTerms: ["imunizacao"],
        generatedAt: "2026-06-24T00:00:00.000Z",
      },
      {
        sourceTheme: "Educação Superior",
        expandedTerms: ["FIES"],
        generatedAt: "2026-06-24T00:00:00.000Z",
      },
    ]);

    await sentinelStorage.writeThemeExpansions(profileId, [
      {
        sourceTheme: "Vacinação",
        expandedTerms: ["imunizacao", "gripe"],
        generatedAt: "2026-06-24T01:00:00.000Z",
      },
    ]);

    const stored = await sentinelStorage.readThemeExpansions(profileId);
    expect(stored).toHaveLength(1);
    expect(stored[0]?.sourceTheme).toBe("Vacinação");
  });
});
