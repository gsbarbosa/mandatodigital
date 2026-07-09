import { describe, expect, it } from "vitest";

import {
  getNationalPortalHosts,
  getStatePortalHosts,
  isNationalPortalHost,
  isStatePortalHost,
  NATIONAL_PORTAL_HOSTS,
} from "./sentinel-portal-catalog";
import { splitProfileThemesBySphere } from "./sentinel-profile-themes";
import type { PoliticianProfile } from "./types";

const baseProfile: PoliticianProfile = {
  id: "p1",
  fullName: "Teste",
  role: "Deputado",
  city: "Campinas",
  state: "SP",
  audience: "Geral",
  spectrum: "",
  archetype: "O Conciliador (Uniao/Pontes)",
  voiceTones: [],
  keyIssues: ["Saude"],
  slogans: [],
  redLines: [],
  referenceExamples: [],
  bio: "Bio de teste com mais de vinte caracteres para validacao.",
  personaArchetypes: [],
  sentinelThemes: ["Seguranca Publica", "Desemprego"],
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

describe("sentinel-portal-catalog", () => {
  it("expõe cinco portais nacionais fixos", () => {
    expect(getNationalPortalHosts()).toEqual([...NATIONAL_PORTAL_HOSTS]);
    expect(NATIONAL_PORTAL_HOSTS).toHaveLength(5);
  });

  it("retorna cinco portais por UF", () => {
    expect(getStatePortalHosts("SP")).toHaveLength(5);
    expect(getStatePortalHosts("sp")).toHaveLength(5);
    expect(getStatePortalHosts("XX")).toEqual([]);
  });

  it("detecta host nacional e estadual", () => {
    expect(isNationalPortalHost("www.estadao.com.br")).toBe(true);
    expect(isStatePortalHost("otempo.com.br", "MG")).toBe(true);
  });
});

describe("splitProfileThemesBySphere", () => {
  it("separa temas federal e estadual pelos catálogos", () => {
    const split = splitProfileThemesBySphere(baseProfile);
    expect(split.federal).toContain("Seguranca Publica");
    expect(split.estadual).toContain("Desemprego");
  });
});
