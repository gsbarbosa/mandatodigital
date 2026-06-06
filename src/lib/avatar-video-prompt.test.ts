import { describe, expect, it } from "vitest";

import {
  buildAvatarVideoPrompt,
  pickCuradorVideoContext,
} from "@/lib/avatar-video-prompt";

const baseProfile = {
  id: "p1",
  fullName: "Perfil em configuracao",
  role: "Mandato",
  city: "Cidade",
  state: "SP",
  audience: "Eleitorado local",
  spectrum: "",
  archetype: "O Estadista (Serio, Longo prazo)",
  voiceTones: [] as string[],
  keyIssues: ["Comunicacao politica"],
  slogans: [],
  redLines: [],
  referenceExamples: [],
  bio: "Mandato focado em entregas concretas, linguagem clara e defesa consistente das pautas prioritarias.",
  personaArchetypes: [] as string[],
  sentinelThemes: [],
  oppositionThemes: [],
  customRadarThemes: [],
  interestProfiles: [],
  interestSites: [],
  oppositionProfiles: [],
  oppositionSites: [],
  glossaryTerms: [] as string[],
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

describe("pickCuradorVideoContext", () => {
  it("ignora defaults de rascunho e campos de outras etapas", () => {
    const context = pickCuradorVideoContext("Obras publicas", baseProfile);

    expect(context.topic).toBe("Obras publicas");
    expect(context.spectrum).toBeUndefined();
    expect(context.personaArchetypes).toBeUndefined();
    expect(context.glossaryTerms).toBeUndefined();
  });

  it("inclui somente o que o usuario preencheu no Curador", () => {
    const context = pickCuradorVideoContext("Saude publica", {
      ...baseProfile,
      fullName: "Maria Souza",
      role: "Vereadora",
      spectrum: "Centro-Direita",
      personaArchetypes: ["O Gestor/CEO (Eficiencia)"],
      voiceTones: ["Popular"],
      glossaryTerms: ["ne", "ta"],
      avatarType: "Caricatura",
    });

    expect(context.spectrum).toBe("Centro-Direita");
    expect(context.personaArchetypes).toEqual(["O Gestor/CEO (Eficiencia)"]);
    expect(context.voiceTones).toEqual(["Popular"]);
    expect(context.glossaryTerms).toEqual(["ne", "ta"]);
    expect(context.avatarType).toBe("Caricatura");
  });
});

describe("buildAvatarVideoPrompt", () => {
  it("omite blocos de ideologia e glossario quando nao foram informados", () => {
    const prompt = buildAvatarVideoPrompt({
      topic: "Transparencia",
      profile: baseProfile,
    });

    expect(prompt.system).not.toContain("posicionamento ideologico");
    expect(prompt.system).not.toContain("incorporar de forma natural");
    expect(prompt.user).not.toContain("Palavras Obrigatorias");
    expect(prompt.user).toContain("Tema Central: Transparencia");
    expect(prompt.user).toContain("140 palavras");
  });

  it("inclui contexto politico no system e regra de centro", () => {
    const prompt = buildAvatarVideoPrompt({
      topic: "Transparencia",
      profile: {
        ...baseProfile,
        spectrum: "Centro",
        glossaryTerms: ["ne"],
        voiceTones: ["Indignado"],
      },
      curadorContext: {
        politicalContext: "1. O FATO\n- Exemplo.",
      },
    });

    expect(prompt.system).toContain("posicionamento ideologico de: Centro");
    expect(prompt.system).toContain("rejeite a polarizacao extrema");
    expect(prompt.system).toContain("INTELIGENCIA DE CENARIO");
    expect(prompt.system).toContain("1. O FATO");
    expect(prompt.system).toContain("Tom: Indignado");
    expect(prompt.system).toContain("HeyGen");
    expect(prompt.user).toContain("Palavras Obrigatorias");
  });
});
