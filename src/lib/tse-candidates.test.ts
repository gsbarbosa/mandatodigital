import { describe, expect, it } from "vitest";

import {
  hasAnyPrefillValue,
  isTsePlaceholder,
  mergeCandidatePrefills,
  normalizeCandidateName,
  normalizeTseCargo,
  normalizeTseParty,
  normalizeTseUf,
  toCandidatePrefill,
} from "@/lib/tse-candidates";

describe("isTsePlaceholder", () => {
  it("reconhece os marcadores de ausência do TSE", () => {
    expect(isTsePlaceholder("#NULO")).toBe(true);
    expect(isTsePlaceholder("#NE")).toBe(true);
    expect(isTsePlaceholder("NÃO DIVULGÁVEL")).toBe(true);
    expect(isTsePlaceholder("   ")).toBe(true);
    expect(isTsePlaceholder("PT")).toBe(false);
  });
});

describe("normalizeCandidateName", () => {
  it("converte o caixa alta do TSE em caixa mista", () => {
    expect(normalizeCandidateName("SUÊD HAIDAR NOGUEIRA")).toBe("Suêd Haidar Nogueira");
  });

  it("mantém partículas em minúscula, menos na primeira posição", () => {
    expect(normalizeCandidateName("HEITOR DE SOUZA QUEIROZ FILHO")).toBe(
      "Heitor de Souza Queiroz Filho",
    );
    expect(normalizeCandidateName("DOS SANTOS SILVA")).toBe("Dos Santos Silva");
  });

  it("capitaliza depois de hífen e apóstrofo", () => {
    expect(normalizeCandidateName("MARIA D'ÁVILA SANTA-RITA")).toBe(
      "Maria D'Ávila Santa-Rita",
    );
  });

  it("colapsa espaços repetidos e devolve vazio em placeholder", () => {
    expect(normalizeCandidateName("ANA   PAULA")).toBe("Ana Paula");
    expect(normalizeCandidateName("#NULO")).toBe("");
  });
});

describe("normalizeTseParty", () => {
  it("casa a sigla direto quando ela existe no select", () => {
    expect(normalizeTseParty("PT")).toBe("PT");
    expect(normalizeTseParty("MISSÃO")).toBe("MISSÃO");
    expect(normalizeTseParty("DEMOCRATA")).toBe("DEMOCRATA");
  });

  it("preserva a grafia do select em vez da do TSE", () => {
    expect(normalizeTseParty("PCDOB")).toBe("PCdoB");
  });

  it("aplica o alias UNIÃO -> UNIÃO BRASIL", () => {
    expect(normalizeTseParty("UNIÃO")).toBe("UNIÃO BRASIL");
    expect(normalizeTseParty("UNIAO")).toBe("UNIÃO BRASIL");
  });

  it("devolve vazio para sigla desconhecida", () => {
    expect(normalizeTseParty("PARTIDO INEXISTENTE")).toBe("");
    expect(normalizeTseParty("#NULO")).toBe("");
  });
});

describe("normalizeTseCargo", () => {
  it("mapeia os cargos disponíveis no cadastro", () => {
    expect(normalizeTseCargo("DEPUTADO FEDERAL")).toBe("Deputado Federal");
    expect(normalizeTseCargo("DEPUTADO ESTADUAL")).toBe("Deputado Estadual");
    expect(normalizeTseCargo("DEPUTADO DISTRITAL")).toBe("Deputado Distrital");
    expect(normalizeTseCargo("SENADOR")).toBe("Senador");
    expect(normalizeTseCargo("GOVERNADOR")).toBe("Governador");
    expect(normalizeTseCargo("PRESIDENTE")).toBe("Presidente");
  });

  it("devolve vazio para vice e suplente, que não existem no select", () => {
    expect(normalizeTseCargo("VICE-GOVERNADOR")).toBe("");
    expect(normalizeTseCargo("VICE-PRESIDENTE")).toBe("");
    expect(normalizeTseCargo("1º SUPLENTE")).toBe("");
    expect(normalizeTseCargo("2º SUPLENTE")).toBe("");
  });
});

describe("normalizeTseUf", () => {
  it("aceita UF válida e rejeita o BR de presidente/vice", () => {
    expect(normalizeTseUf("SP")).toBe("SP");
    expect(normalizeTseUf("df")).toBe("DF");
    expect(normalizeTseUf("BR")).toBe("");
  });
});

describe("toCandidatePrefill", () => {
  it("converte uma linha do TSE nos campos do cadastro", () => {
    expect(
      toCandidatePrefill({
        NR_CPF_CANDIDATO: "51287641768",
        NM_CANDIDATO: "MARIA DE LOURDES MELO",
        SG_UF: "MG",
        SG_PARTIDO: "UNIÃO",
        DS_CARGO: "DEPUTADO ESTADUAL",
      }),
    ).toEqual({
      fullName: "Maria de Lourdes Melo",
      party: "UNIÃO BRASIL",
      uf: "MG",
      role: "Deputado Estadual",
    });
  });

  it("zera os campos sem equivalente, mantendo o resto", () => {
    expect(
      toCandidatePrefill({
        NR_CPF_CANDIDATO: "51287641768",
        NM_CANDIDATO: "SUÊD HAIDAR NOGUEIRA",
        SG_UF: "BR",
        SG_PARTIDO: "DEMOCRATA",
        DS_CARGO: "VICE-PRESIDENTE",
      }),
    ).toEqual({
      fullName: "Suêd Haidar Nogueira",
      party: "DEMOCRATA",
      uf: "",
      role: "",
    });
  });
});

describe("mergeCandidatePrefills", () => {
  it("mantém o que é consenso e zera o que diverge", () => {
    // Caso real: mesmo CPF como Dep. Estadual/PL e Dep. Federal/SOLIDARIEDADE.
    expect(
      mergeCandidatePrefills([
        {
          fullName: "Heitor de Souza Queiroz Filho",
          party: "PL",
          uf: "RJ",
          role: "Deputado Estadual",
        },
        {
          fullName: "Heitor de Souza Queiroz Filho",
          party: "SOLIDARIEDADE",
          uf: "RJ",
          role: "Deputado Federal",
        },
      ]),
    ).toEqual({
      fullName: "Heitor de Souza Queiroz Filho",
      party: "",
      uf: "RJ",
      role: "",
    });
  });

  it("aproveita o valor único quando o outro registro veio vazio", () => {
    expect(
      mergeCandidatePrefills([
        { fullName: "Ana Paula", party: "PT", uf: "BA", role: "" },
        { fullName: "Ana Paula", party: "PT", uf: "BA", role: "Senador" },
      ]).role,
    ).toBe("Senador");
  });
});

describe("hasAnyPrefillValue", () => {
  it("distingue prefill útil de prefill totalmente vazio", () => {
    expect(hasAnyPrefillValue({ fullName: "", party: "", uf: "", role: "" })).toBe(false);
    expect(hasAnyPrefillValue({ fullName: "", party: "", uf: "SP", role: "" })).toBe(true);
  });
});
