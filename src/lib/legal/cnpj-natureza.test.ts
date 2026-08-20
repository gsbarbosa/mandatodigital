import { describe, expect, it } from "vitest";

import {
  formatAddressFromLookup,
  isAllowedElectoralNatureza,
} from "@/lib/legal/cnpj-natureza";

describe("isAllowedElectoralNatureza", () => {
  it("aceita Comitê Financeiro", () => {
    expect(isAllowedElectoralNatureza("Comitê Financeiro de Candidato a Cargo Eletivo")).toBe(
      true,
    );
  });

  it("aceita Candidato a Cargo Político Eletivo", () => {
    expect(
      isAllowedElectoralNatureza("Candidato a Cargo Politico Eletivo"),
    ).toBe(true);
  });

  it("rejeita sociedade limitada comum", () => {
    expect(isAllowedElectoralNatureza("Sociedade Empresária Limitada")).toBe(false);
  });
});

describe("formatAddressFromLookup", () => {
  it("monta linha completa com CEP formatado", () => {
    expect(
      formatAddressFromLookup({
        cnpj: "1",
        razaoSocial: "X",
        naturezaJuridica: "Y",
        logradouro: "Rua X",
        numero: "123",
        bairro: "Centro",
        municipio: "Belo Horizonte",
        uf: "MG",
        cep: "30130000",
      }),
    ).toBe("Rua X, 123, Centro, Belo Horizonte - MG, CEP 30130-000");
  });

  it("retorna null sem CEP", () => {
    expect(
      formatAddressFromLookup({
        cnpj: "1",
        razaoSocial: "X",
        naturezaJuridica: "Y",
        logradouro: "Rua X",
        numero: "10",
        bairro: "Centro",
        municipio: "BH",
        uf: "MG",
      }),
    ).toBeNull();
  });

  it("retorna null sem logradouro", () => {
    expect(
      formatAddressFromLookup({
        cnpj: "1",
        razaoSocial: "X",
        naturezaJuridica: "Y",
        numero: "10",
        bairro: "Centro",
        cep: "30130000",
      }),
    ).toBeNull();
  });

  it("usa S/N e Centro quando numero/bairro faltam", () => {
    expect(
      formatAddressFromLookup({
        cnpj: "1",
        razaoSocial: "X",
        naturezaJuridica: "Y",
        logradouro: "Av Contorno",
        municipio: "Belo Horizonte",
        uf: "MG",
        cep: "30110000",
      }),
    ).toBe("Av Contorno, S/N, Centro, Belo Horizonte - MG, CEP 30110-000");
  });
});
