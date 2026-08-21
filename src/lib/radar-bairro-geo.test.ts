import { describe, expect, it } from "vitest";

import {
  normalizeCityName,
  rankNeighborhoodCandidates,
  RADAR_BAIRRO_POPULATION_THRESHOLD,
  type OsmNeighborhood,
} from "@/lib/radar-bairro-geo";

function bairro(
  name: string,
  options: Partial<Omit<OsmNeighborhood, "name">> = {},
): OsmNeighborhood {
  return { name, population: options.population ?? null, isSuburb: options.isSuburb ?? false };
}

describe("normalizeCityName", () => {
  it("ignora acento, caixa e espaço extra", () => {
    expect(normalizeCityName("  BETÂNIA ")).toBe("betania");
    expect(normalizeCityName("Governador  Valadares")).toBe("governador valadares");
  });
});

describe("RADAR_BAIRRO_POPULATION_THRESHOLD", () => {
  /**
   * Governador Valadares (266.561 hab.) foi o caso que derrubou o critério
   * anterior ("capital ou região metropolitana"): é cidade grande sem ser
   * nenhum dos dois. Tem que cair no modo bairro.
   */
  it("coloca Governador Valadares no modo bairro e Arcos no modo cidade", () => {
    expect(266_561).toBeGreaterThanOrEqual(RADAR_BAIRRO_POPULATION_THRESHOLD);
    expect(38_000).toBeLessThan(RADAR_BAIRRO_POPULATION_THRESHOLD);
  });
});

describe("rankNeighborhoodCandidates", () => {
  it("prioriza bairro com população conhecida", () => {
    const ranked = rankNeighborhoodCandidates([
      bairro("Jardim Presidente", { population: 5_000 }),
      bairro("Santana", { population: 327_279 }),
      bairro("Bairro Sem Dado"),
    ]);

    expect(ranked[0]).toBe("Santana");
    expect(ranked[1]).toBe("Jardim Presidente");
  });

  it("usa place=suburb quando a tag de fato separa (caso Belo Horizonte)", () => {
    // Em BH só 36 de 289 são suburb — a tag filtra de verdade.
    const neighborhoods = [
      ...Array.from({ length: 20 }, (_, index) => bairro(`Comum ${index}`)),
      bairro("Buritis", { isSuburb: true }),
    ];

    expect(rankNeighborhoodCandidates(neighborhoods)[0]).toBe("Buritis");
  });

  it("ignora place=suburb quando quase tudo é suburb (caso São Paulo)", () => {
    // Em SP 320 de 520 são suburb — a tag não separa nada e viraria ruído.
    const neighborhoods = [
      ...Array.from({ length: 9 }, (_, index) => bairro(`Suburb ${index}`, { isSuburb: true })),
      bairro("Conhecido"),
    ];

    const ranked = rankNeighborhoodCandidates(neighborhoods, ["Conhecido"]);

    expect(ranked[0]).toBe("Conhecido");
  });

  it("dá peso a nome conhecido informado pelo time", () => {
    const ranked = rankNeighborhoodCandidates(
      [bairro("Aleatório"), bairro("Centro")],
      ["Centro"],
    );

    expect(ranked[0]).toBe("Centro");
  });
});
