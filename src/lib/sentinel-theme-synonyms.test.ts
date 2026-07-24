import { describe, expect, it } from "vitest";

import {
  matchThemesWithSynonyms,
  scoreThemeMatch,
} from "./sentinel-theme-synonyms";

describe("sentinel-theme-synonyms fiscal", () => {
  it("nao casa Carga Tributaria so com imposto/taxa genericos", () => {
    expect(matchThemesWithSynonyms("Empresa abre vagas e paga imposto", ["Carga Tributária"])).toEqual(
      [],
    );
    expect(matchThemesWithSynonyms("Prefeitura eleva taxa de lixo", ["Carga Tributária"])).toEqual([]);
  });

  it("casa Carga Tributaria com sinais concretos", () => {
    expect(
      matchThemesWithSynonyms("Carga tributária sobe a 32% do PIB", ["Carga Tributária"]),
    ).toContain("Carga Tributária");
    expect(
      matchThemesWithSynonyms("Pressao tributaria sobre empresas cresce", ["Carga Tributária"]),
    ).toContain("Carga Tributária");
    expect(scoreThemeMatch("Arrecadacao tributaria recorde em 2026", "Carga Tributária")).toBeGreaterThan(
      0,
    );
  });

  it("nao casa SUS dentro de sustentabilidade", () => {
    expect(
      matchThemesWithSynonyms(
        "Nova Lima e a 6a cidade com melhor indice de Sustentabilidade Fiscal",
        ["Saúde Pública (SUS)"],
      ),
    ).toEqual([]);
    expect(
      matchThemesWithSynonyms("Fila do SUS cresce em Belo Horizonte", ["Saúde Pública (SUS)"]),
    ).toContain("Saúde Pública (SUS)");
  });
});
