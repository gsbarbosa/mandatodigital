import { describe, expect, it } from "vitest";

import {
  BRAZILIAN_UFS,
  getNationalPortalHosts,
  getStatePortalHosts,
  isNationalPortalHost,
  isStatePortalHost,
  NATIONAL_PORTAL_HOSTS,
  NEWS_SEARCH_ENGINES,
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
  it("expõe dez portais nacionais fixos", () => {
    expect(getNationalPortalHosts()).toEqual([...NATIONAL_PORTAL_HOSTS]);
    expect(NATIONAL_PORTAL_HOSTS).toHaveLength(10);
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

  it("mapeia cinco veículos locais distintos em todas as UFs", () => {
    for (const uf of BRAZILIAN_UFS) {
      const hosts = getStatePortalHosts(uf);
      expect(hosts, uf).toHaveLength(5);
      expect(new Set(hosts).size, uf).toBe(5);
    }
  });

  it("não repete portais nacionais genéricos nas listas estaduais", () => {
    // g1/uol/r7/terra cobrem o país inteiro — em UF eles gastavam vaga sem trazer pauta local.
    const generic = ["g1.globo.com", "uol.com.br", "r7.com", "terra.com.br"];
    for (const uf of BRAZILIAN_UFS) {
      for (const host of getStatePortalHosts(uf)) {
        expect(generic, `${uf}/${host}`).not.toContain(host);
      }
    }
  });

  it("veículo estadual em subdomínio de portal nacional não vira federal", () => {
    expect(getStatePortalHosts("PE")).toContain("jc.uol.com.br");
    expect(isNationalPortalHost("jc.uol.com.br")).toBe(false);
    expect(isStatePortalHost("jc.uol.com.br", "PE")).toBe(true);
    // O host nacional em si continua nacional, mesmo estando também numa UF.
    expect(isNationalPortalHost("folha.uol.com.br")).toBe(true);
    expect(isNationalPortalHost("metropoles.com")).toBe(true);
  });

  it("expõe Google News e Bing News como buscadores das três esferas", () => {
    expect(NEWS_SEARCH_ENGINES.map((engine) => engine.label)).toEqual([
      "Google News",
      "Bing News",
    ]);
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
    // "Fundão Eleitoral" só existe no catálogo federal — bom exemplo de tema não-sobreposto.
    expect(listOverlappingSentinelThemes()).not.toContain("Fundão Eleitoral");
    const migrated = migrateFlatSentinelThemes(["Contratos Públicos", "Fundão Eleitoral"]);
    expect(migrated.estadual).toEqual(["Contratos Públicos"]);
    expect(migrated.federal).toEqual(["Fundão Eleitoral"]);
  });

  it("perfil legado sem campos por esfera vira lista unificada", () => {
    const split = splitProfileThemesBySphere(baseProfile);
    expect(split.federal).toEqual(split.estadual);
    expect(split.interest).toEqual(
      expect.arrayContaining(["Vacinação", "Desemprego"]),
    );
  });
});
