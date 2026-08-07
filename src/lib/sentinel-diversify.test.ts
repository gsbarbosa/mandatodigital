import { describe, expect, it } from "vitest";

import { diversifySuggestionsByTheme, ensureMinimumSphereRepresentation } from "./sentinel-diversify";
import type { MockSentinelSuggestion } from "./sentinel-mock-suggestions";
import type { PoliticianProfile } from "./types";

const profile: PoliticianProfile = {
  id: "profile-1",
  fullName: "Teste",
  role: "Vereador",
  city: "",
  state: "CE",
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
  sentinelThemes: [],
  sentinelThemesFederal: [],
  sentinelThemesEstadual: [],
  oppositionThemes: [],
  customRadarThemes: [],
  municipalCities: ["Crato"],
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
  updatedAt: "",
};

function suggestion(
  id: string,
  title: string,
  score: number,
  publishedAt?: string,
): MockSentinelSuggestion {
  return {
    id,
    themeLabel: "Valorização Policial",
    matchedThemes: ["Valorização Policial"],
    relevanceScore: score,
    topic: `Valorização Policial · ${title}`,
    evidence: {
      postsAnalyzed: 1,
      outletCount: 1,
      engagementTrendPercent: 0,
      byNetwork: [],
      actors: [],
      articles: [{ title, url: `https://x.com/${id}`, sourceName: "X", publishedAt }],
    },
    engagement: {
      relevanceScore: score,
      scoreTrendPercent: 0,
      likes: 0,
      comments: 0,
      postsAnalyzed: 1,
      sources: [],
      byNetwork: [],
    },
  };
}

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

describe("ensureMinimumSphereRepresentation", () => {
  it("promove o melhor candidato federal quando o corte por tema deixou a esfera sem nada", () => {
    // Mesmo tema, mas um cita a cidade monitorada (municipal) e o outro não (cai em federal).
    const local = suggestion("local", "Polícia Civil prende suspeito em Crato", 90);
    const national = suggestion("national", "Congresso debate valorização da carreira policial", 40);

    // maxPerTheme=1 deixa só o local sobreviver — igual acontecia com Nacional zerado.
    const selected = diversifySuggestionsByTheme([local, national], { maxPerTheme: 1 });
    expect(selected.map((item) => item.id)).toEqual(["local"]);

    const result = ensureMinimumSphereRepresentation({
      selected,
      allCandidates: [local, national],
      profile,
    });

    expect(result.map((item) => item.id)).toEqual(["local", "national"]);
  });

  it("nao duplica nem mexe quando a esfera ja tem representante", () => {
    const local = suggestion("local", "Polícia Civil prende suspeito em Crato", 90);
    const selected = [local];

    const result = ensureMinimumSphereRepresentation({
      selected,
      allCandidates: [local],
      profile,
    });

    expect(result).toEqual(selected);
  });

  it("prefere o candidato recente ao mais pontuado quando o mais pontuado nao sobrevive ao filtro de idade", () => {
    // Nenhum dos dois cita cidade monitorada → os dois caem em federal.
    const oldHighScore = suggestion(
      "old",
      "Congresso debate valorização da carreira policial",
      90,
      daysAgo(300), // > NATIONAL_MAX_AGE_DAYS (240) — some da tela mesmo se promovido
    );
    const recentLowScore = suggestion(
      "recent",
      "Ministério da Justiça anuncia plano de valorização policial",
      40,
      daysAgo(5),
    );

    const result = ensureMinimumSphereRepresentation({
      selected: [],
      allCandidates: [oldHighScore, recentLowScore],
      profile,
    });

    expect(result.map((item) => item.id)).toEqual(["recent"]);
  });

  it("nao quebra quando nao existe nenhum candidato pra esfera que falta", () => {
    const local = suggestion("local", "Polícia Civil prende suspeito em Crato", 90);

    const result = ensureMinimumSphereRepresentation({
      selected: [local],
      allCandidates: [local],
      profile,
    });

    // Só municipal disponível — não há o que promover pra federal/estadual, e a
    // função não deve travar nem inventar candidato.
    expect(result).toHaveLength(1);
  });
});
