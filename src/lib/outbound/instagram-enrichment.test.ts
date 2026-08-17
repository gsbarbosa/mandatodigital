import { describe, expect, it } from "vitest";

import {
  bioBelongsToSomeoneElse,
  handleMatchesName,
  validateEnrichedRow,
  type EnrichedRow,
} from "@/lib/outbound/instagram-enrichment";

function row(overrides: Partial<EnrichedRow> = {}): EnrichedRow {
  return {
    handle: "depdalmoribeiro",
    candidateName: "DALMO RIBEIRO",
    uf: "MG",
    role: "DEPUTADO ESTADUAL",
    party: "PSDB",
    phones: ["5531998895051"],
    bioLinks: [],
    ...overrides,
  };
}

const semDisputa = new Map<string, Set<string>>();

describe("handleMatchesName", () => {
  // Casos reais da base: o @ com prefixo/sufixo continua identificando a pessoa.
  it.each([
    ["depdalmoribeiro", "DALMO RIBEIRO"],
    ["helioferreiravereador", "HELIO FERREIRA"],
    ["marcoshenriques_", "MARCOS HENRIQUES"],
    ["cabo.meireles", "CABO MEIRELES"],
    ["silvinhadudu", "SILVINHA DUDU"],
  ])("aceita %s ↔ %s", (handle, nome) => {
    expect(handleMatchesName(handle, nome)).toBe(true);
  });

  // Linhas embaralhadas: @ de uma pessoa com o nome de outra.
  it.each([
    ["bomfimdf", "MILENA CÂMARA"],
    ["joelmatos2026", "LETÍCIA SAMPAIO"],
    ["vereadoraestelaalmagro", "FÁBIO FERRACINI"],
    ["monicarosenbergsp", "PROF CIDACARLOS ELASCOM O POVO"],
    ["carlosrussorj", "WELLINGTON JOSE"],
  ])("rejeita %s ↔ %s", (handle, nome) => {
    expect(handleMatchesName(handle, nome)).toBe(false);
  });

  it("ignora acento na comparação", () => {
    expect(handleMatchesName("erminiofelix", "ERMÍNIO FÉLIX")).toBe(true);
  });
});

describe("bioBelongsToSomeoneElse", () => {
  it("aceita bio do próprio perfil", () => {
    expect(bioBelongsToSomeoneElse("erminiofelix", ["https://linktr.ee/erminiofelix"])).toBe(false);
  });

  it("detecta bio de terceiro", () => {
    expect(bioBelongsToSomeoneElse("renancury", ["https://linktr.ee/marcelosimaooficial"])).toBe(
      true,
    );
  });

  it("não opina quando não há link reconhecível", () => {
    expect(bioBelongsToSomeoneElse("qualquer", ["https://exemplo.com.br"])).toBe(false);
  });
});

describe("validateEnrichedRow", () => {
  it("aprova linha consistente", () => {
    expect(validateEnrichedRow(row(), semDisputa)).toEqual({
      ok: true,
      phone: "5531998895051",
    });
  });

  it("rejeita sem telefone", () => {
    expect(validateEnrichedRow(row({ phones: [] }), semDisputa)).toEqual({
      ok: false,
      reasons: ["sem_telefone"],
    });
  });

  it("rejeita telefone reivindicado por mais de um candidato", () => {
    const owners = new Map([
      ["5522997692727", new Set(["WELLINGTON JOSE", "ANDRE LAZARONI"])],
    ]);
    const result = validateEnrichedRow(
      row({ handle: "wellingtonjose", candidateName: "WELLINGTON JOSE", uf: "RJ", phones: ["5522997692727"] }),
      owners,
    );
    expect(result).toEqual({ ok: false, reasons: ["telefone_de_varias_pessoas"] });
  });

  it("rejeita DDD de outro estado", () => {
    const result = validateEnrichedRow(
      row({ handle: "erminiofelix", candidateName: "ERMINIO FELIX", uf: "RN", phones: ["5571993838631"] }),
      semDisputa,
    );
    expect(result).toEqual({ ok: false, reasons: ["ddd_incompativel_com_uf"] });
  });

  it("acumula motivos quando há mais de um defeito", () => {
    const result = validateEnrichedRow(
      row({
        handle: "felipecarmonacantera",
        candidateName: "ARTUR ORSI",
        uf: "SP",
        phones: ["5519997575022"],
        bioLinks: ["https://linktr.ee/rafazimbaldi"],
      }),
      semDisputa,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons).toEqual(
        expect.arrayContaining(["handle_nao_bate_com_nome", "bio_de_terceiro"]),
      );
    }
  });

  it("escolhe o segundo telefone quando o primeiro está disputado", () => {
    const owners = new Map([["5511911005588", new Set(["A", "B"])]]);
    const result = validateEnrichedRow(
      row({ uf: "MG", phones: ["5511911005588", "5531988887777"] }),
      owners,
    );
    expect(result).toEqual({ ok: true, phone: "5531988887777" });
  });
});
