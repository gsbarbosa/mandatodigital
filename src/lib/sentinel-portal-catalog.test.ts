import { describe, expect, it } from "vitest";

import {
  getNationalPortalHosts,
  getStatePortalHosts,
  isNationalPortalHost,
  isStatePortalHost,
  NATIONAL_PORTAL_HOSTS,
} from "./sentinel-portal-catalog";
import {
  listOverlappingSentinelThemes,
  migrateFlatSentinelThemes,
  resolveSentinelThemeSpheres,
  splitProfileThemesBySphere,
} from "./sentinel-profile-themes";
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
  sentinelThemes: ["Vacinação", "Desemprego"],
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

describe("sentinel-profile-themes", () => {
  it("unifica temas de interesse nas duas colunas (compat RSS)", () => {
    const split = splitProfileThemesBySphere({
      ...baseProfile,
      sentinelThemesFederal: ["Reforma Fiscal"],
      sentinelThemesEstadual: ["Desemprego"],
      sentinelThemes: ["Reforma Fiscal", "Desemprego"],
    });
    expect(split.federal).toEqual(["Reforma Fiscal", "Desemprego"]);
    expect(split.estadual).toEqual(["Reforma Fiscal", "Desemprego"]);
    expect(split.interest).toEqual(["Reforma Fiscal", "Desemprego"]);
  });

  it("resolve colunas explícitas sem forçar união no resolveSentinelThemeSpheres", () => {
    const spheres = resolveSentinelThemeSpheres({
      sentinelThemes: ["Contratos Públicos"],
      sentinelThemesFederal: [],
      sentinelThemesEstadual: ["Contratos Públicos"],
    });
    expect(spheres.federal).toEqual([]);
    expect(spheres.estadual).toEqual(["Contratos Públicos"]);
  });

  it("espelha sentinelThemes quando colunas novas estao vazias", () => {
    const spheres = resolveSentinelThemeSpheres({
      sentinelThemes: ["Vacinação", "Desemprego"],
      sentinelThemesFederal: [],
      sentinelThemesEstadual: [],
    });
    expect(spheres.federal).toEqual(["Vacinação", "Desemprego"]);
    expect(spheres.estadual).toEqual(["Vacinação", "Desemprego"]);
  });

  it("migra lista unica priorizando estadual para temas sobrepostos (legado)", () => {
    expect(listOverlappingSentinelThemes()).toContain("Contratos Públicos");
    const migrated = migrateFlatSentinelThemes(["Contratos Públicos", "Vacinação"]);
    expect(migrated.estadual).toEqual(["Contratos Públicos"]);
    expect(migrated.federal).toEqual(["Vacinação"]);
  });

  it("perfil legado sem campos por esfera vira lista unificada", () => {
    const split = splitProfileThemesBySphere(baseProfile);
    expect(split.federal).toEqual(split.estadual);
    expect(split.interest).toEqual(
      expect.arrayContaining(["Vacinação", "Desemprego"]),
    );
  });
});
