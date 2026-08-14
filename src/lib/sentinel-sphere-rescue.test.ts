import { afterEach, describe, expect, it, vi } from "vitest";

import type { MockSentinelSuggestion } from "./sentinel-mock-suggestions";
import type { PoliticianProfile } from "./types";

const ENV_KEYS = ["SENTINEL_LLM_SPHERE_RESCUE"] as const;
const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  vi.resetModules();
  vi.clearAllMocks();
});

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
  sentinelThemesFederal: ["Tema Federal"],
  sentinelThemesEstadual: ["Tema Estadual"],
  oppositionThemes: [],
  customRadarThemes: [],
  municipalCities: [],
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

function federalCandidate(id: string, title: string, score: number): MockSentinelSuggestion {
  return {
    id,
    themeLabel: "Tema Federal",
    matchedThemes: ["Tema Federal"],
    relevanceScore: score,
    topic: `Tema Federal · ${title}`,
    evidence: {
      postsAnalyzed: 1,
      outletCount: 1,
      engagementTrendPercent: 0,
      byNetwork: [],
      actors: [],
      articles: [{ title, url: `https://x.com/${id}`, sourceName: "X", publishedAt: undefined }],
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

function estadualCandidate(id: string, title: string, score: number): MockSentinelSuggestion {
  const card = federalCandidate(id, title, score);
  return {
    ...card,
    themeLabel: "Tema Estadual",
    matchedThemes: ["Tema Estadual"],
    topic: `Tema Estadual · ${title}`,
  };
}

const okResponse = (body: Record<string, unknown>) => ({
  rawText: JSON.stringify(body),
  provider: "openai" as const,
  model: "test",
  latencyMs: 1,
  tokenUsage: null,
});

async function loadRescueZeroedSpheres() {
  const { rescueZeroedSpheres } = await import("./sentinel-sphere-rescue");
  return rescueZeroedSpheres;
}

describe("rescueZeroedSpheres", () => {
  it("flag desligada: fallback cego por score, zero chamadas de IA", async () => {
    delete process.env.SENTINEL_LLM_SPHERE_RESCUE;
    vi.resetModules();
    const rescueZeroedSpheres = await loadRescueZeroedSpheres();

    const candidate = federalCandidate("f1", "Congresso vota projeto", 80);
    const result = await rescueZeroedSpheres({
      selected: [],
      allCandidates: [candidate],
      profile,
    });

    expect(result.stats.llmCalls).toBe(0);
    expect(result.suggestions.map((item) => item.id)).toEqual(["f1"]);
  });

  it("enabled:false explícito mesmo com flag ligada: mesmo fallback cego", async () => {
    process.env.SENTINEL_LLM_SPHERE_RESCUE = "true";
    vi.resetModules();
    const rescueZeroedSpheres = await loadRescueZeroedSpheres();

    const candidate = federalCandidate("f1", "Congresso vota projeto", 80);
    const result = await rescueZeroedSpheres({
      selected: [],
      allCandidates: [candidate],
      profile,
      options: { enabled: false },
    });

    expect(result.stats.llmCalls).toBe(0);
    expect(result.suggestions.map((item) => item.id)).toEqual(["f1"]);
  });

  it("IA escolhe candidato que não é o de maior score — prova que não é escolha cega", async () => {
    process.env.SENTINEL_LLM_SPHERE_RESCUE = "true";
    vi.resetModules();
    vi.doMock("@/lib/llm", () => ({
      requestStructuredJson: vi.fn(async () => okResponse({ pick: true, index: 1 })),
      parseJsonResponse: (text: string) => JSON.parse(text),
    }));
    const rescueZeroedSpheres = await loadRescueZeroedSpheres();

    const high = federalCandidate("high", "Maior score", 90);
    const low = federalCandidate("low", "Menor score, mas escolhido pela IA", 40);
    const result = await rescueZeroedSpheres({
      selected: [],
      allCandidates: [high, low],
      profile,
    });

    expect(result.stats.spheresPromotedByAi).toBe(1);
    expect(result.suggestions.map((item) => item.id)).toEqual(["low"]);
  });

  it("pick:false — esfera fica vazia, sem entrar em failedSpheres", async () => {
    process.env.SENTINEL_LLM_SPHERE_RESCUE = "true";
    vi.resetModules();
    vi.doMock("@/lib/llm", () => ({
      requestStructuredJson: vi.fn(async () => okResponse({ pick: false, index: null })),
      parseJsonResponse: (text: string) => JSON.parse(text),
    }));
    const rescueZeroedSpheres = await loadRescueZeroedSpheres();

    const candidate = federalCandidate("f1", "Nenhuma presta", 90);
    const result = await rescueZeroedSpheres({
      selected: [],
      allCandidates: [candidate],
      profile,
    });

    expect(result.suggestions).toHaveLength(0);
    expect(result.stats.spheresRejectedByAi).toBe(1);
    expect(result.stats.failedSpheres).toEqual([]);
  });

  it("falha técnica (sem resposta da IA) — esfera vazia e presente em failedSpheres", async () => {
    process.env.SENTINEL_LLM_SPHERE_RESCUE = "true";
    vi.resetModules();
    vi.doMock("@/lib/llm", () => ({
      requestStructuredJson: vi.fn(async () => ({
        rawText: null,
        provider: null,
        model: null,
        latencyMs: null,
        tokenUsage: null,
      })),
      parseJsonResponse: (text: string) => JSON.parse(text),
    }));
    const rescueZeroedSpheres = await loadRescueZeroedSpheres();

    const candidate = federalCandidate("f1", "Sem resposta da IA", 90);
    const result = await rescueZeroedSpheres({
      selected: [],
      allCandidates: [candidate],
      profile,
    });

    expect(result.suggestions).toHaveLength(0);
    expect(result.stats.failedSpheres).toEqual(["federal"]);
    expect(result.stats.spheresRejectedByAi).toBe(0);
  });

  it("resposta malformada (índice fora do range) — tratada como falha técnica", async () => {
    process.env.SENTINEL_LLM_SPHERE_RESCUE = "true";
    vi.resetModules();
    vi.doMock("@/lib/llm", () => ({
      requestStructuredJson: vi.fn(async () => okResponse({ pick: true, index: 99 })),
      parseJsonResponse: (text: string) => JSON.parse(text),
    }));
    const rescueZeroedSpheres = await loadRescueZeroedSpheres();

    const candidate = federalCandidate("f1", "Índice inválido", 90);
    const result = await rescueZeroedSpheres({
      selected: [],
      allCandidates: [candidate],
      profile,
    });

    expect(result.suggestions).toHaveLength(0);
    expect(result.stats.failedSpheres).toEqual(["federal"]);
  });

  it("zero candidatos disponíveis pra esfera — não chama IA, não quebra", async () => {
    process.env.SENTINEL_LLM_SPHERE_RESCUE = "true";
    vi.resetModules();
    const requestStructuredJson = vi.fn();
    vi.doMock("@/lib/llm", () => ({
      requestStructuredJson,
      parseJsonResponse: (text: string) => JSON.parse(text),
    }));
    const rescueZeroedSpheres = await loadRescueZeroedSpheres();

    const result = await rescueZeroedSpheres({
      selected: [],
      allCandidates: [],
      profile,
    });

    expect(requestStructuredJson).not.toHaveBeenCalled();
    expect(result.stats.spheresNeeded).toBe(0);
    expect(result.suggestions).toHaveLength(0);
  });

  it("paralelismo: 2 esferas zeradas ao mesmo tempo disparam chamadas concorrentes, não serializadas", async () => {
    process.env.SENTINEL_LLM_SPHERE_RESCUE = "true";
    vi.resetModules();

    let inFlight = 0;
    let maxInFlight = 0;
    const resolvers: Array<() => void> = [];
    vi.doMock("@/lib/llm", () => ({
      requestStructuredJson: vi.fn(async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise<void>((resolve) => resolvers.push(resolve));
        inFlight -= 1;
        return okResponse({ pick: true, index: 0 });
      }),
      parseJsonResponse: (text: string) => JSON.parse(text),
    }));
    const rescueZeroedSpheres = await loadRescueZeroedSpheres();

    const federal = federalCandidate("f1", "Pauta federal", 80);
    const estadual = estadualCandidate("e1", "Pauta estadual", 80);

    const promise = rescueZeroedSpheres({
      selected: [],
      allCandidates: [federal, estadual],
      profile,
    });

    // Deixa os dois calls assíncronos chegarem ao await interno antes de resolver.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(resolvers).toHaveLength(2);

    resolvers.forEach((resolve) => resolve());
    const result = await promise;

    expect(maxInFlight).toBe(2);
    expect(result.stats.llmCalls).toBe(2);
    expect(result.stats.spheresPromotedByAi).toBe(2);
  });
});
