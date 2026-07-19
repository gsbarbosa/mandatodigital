import { describe, expect, it } from "vitest";

import {
  filterExpansionsForProfile,
  filterGeoExpansionTerms,
  groupExpansionsBySphere,
  type SentinelThemeExpansion,
} from "./sentinel-theme-expansion";
import type { PoliticianProfile } from "./types";

const profile = {
  city: "Belo Horizonte",
  state: "MG",
} as unknown as PoliticianProfile;

const baseProfile = {
  sentinelThemes: [],
  sentinelThemesFederal: ["Saude Publica (SUS)"],
  sentinelThemesEstadual: ["Privatizacoes"],
  oppositionThemes: ["Saude Publica / Filas"],
} as unknown as PoliticianProfile;

const sampleExpansions: SentinelThemeExpansion[] = [
  {
    sourceTheme: "Saude Publica (SUS)",
    expandedTerms: ["SUS", "hospital"],
    generatedAt: "2026-01-01",
  },
  {
    sourceTheme: "Privatizacoes",
    expandedTerms: ["privatizacao"],
    generatedAt: "2026-01-01",
  },
  {
    sourceTheme: "Saude Publica / Filas",
    expandedTerms: ["fila do SUS"],
    generatedAt: "2026-01-01",
  },
  {
    sourceTheme: "Tema removido",
    expandedTerms: ["orfao"],
    generatedAt: "2026-01-01",
  },
  {
    sourceTheme: "Saude Publica (SUS)",
    expandedTerms: ["duplicata"],
    generatedAt: "2026-01-02",
  },
];

describe("filterGeoExpansionTerms", () => {
  it("remove cidade e UF dos termos expandidos", () => {
    expect(
      filterGeoExpansionTerms(
        ["Belo Horizonte", "MG", "venda de estatais", "belo horizonte"],
        profile,
      ),
    ).toEqual(["venda de estatais"]);
  });
});

describe("filterExpansionsForProfile", () => {
  it("mantem apenas temas ativos no radar e remove duplicatas", () => {
    expect(filterExpansionsForProfile(sampleExpansions, baseProfile).map((row) => row.sourceTheme)).toEqual([
      "Privatizacoes",
      "Saude Publica (SUS)",
      "Saude Publica / Filas",
    ]);
  });
});

describe("groupExpansionsBySphere", () => {
  it("separa expansoes por esfera do perfil", () => {
    const grouped = groupExpansionsBySphere(sampleExpansions, baseProfile);

    expect(grouped.federal.map((row) => row.sourceTheme)).toEqual(["Saude Publica (SUS)"]);
    expect(grouped.estadual.map((row) => row.sourceTheme)).toEqual(["Privatizacoes"]);
    expect(grouped.opposition.map((row) => row.sourceTheme)).toEqual(["Saude Publica / Filas"]);
  });
});
