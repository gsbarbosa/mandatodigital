import { describe, expect, it } from "vitest";

import {
  addressFromCnpjLookup,
  extractCepDigits,
  mergeAddressSources,
  parseFreeformCampaignAddress,
} from "@/lib/billing/asaas-customer-address";

describe("extractCepDigits", () => {
  it("extrai CEP com máscara", () => {
    expect(extractCepDigits("Belo Horizonte - MG, CEP 30.441-070")).toBe("30441070");
  });

  it("extrai CEP sem rótulo", () => {
    expect(extractCepDigits("Rua A, 1, Centro, 01310-000")).toBe("01310000");
  });
});

describe("parseFreeformCampaignAddress", () => {
  it("parseia endereço típico de campanha", () => {
    expect(
      parseFreeformCampaignAddress(
        "Av. Raja Gabaglia, nº 1000, Sala 409, Gutierrez, Belo Horizonte - MG, CEP 30.441-070",
      ),
    ).toEqual({
      postalCode: "30441070",
      address: "Av. Raja Gabaglia",
      addressNumber: "1000",
      province: "Gutierrez",
      complement: "Sala 409",
    });
  });

  it("retorna null sem CEP", () => {
    expect(parseFreeformCampaignAddress("Rua sem CEP, 10, Centro")).toBeNull();
  });
});

describe("addressFromCnpjLookup / merge", () => {
  it("mapeia BrasilAPI", () => {
    expect(
      addressFromCnpjLookup({
        logradouro: "RUA DAS FLORES",
        numero: "50",
        bairro: "CENTRO",
        cep: "30130-000",
      }),
    ).toEqual({
      postalCode: "30130000",
      address: "RUA DAS FLORES",
      addressNumber: "50",
      province: "CENTRO",
    });
  });

  it("prefere número do freeform quando Receita traz S/N", () => {
    expect(
      mergeAddressSources({
        cnpjLookup: {
          postalCode: "30130000",
          address: "RUA DAS FLORES",
          addressNumber: "S/N",
          province: "CENTRO",
        },
        freeform: {
          postalCode: "30130000",
          address: "Rua das Flores",
          addressNumber: "50",
          province: "Centro",
        },
      }),
    ).toMatchObject({ addressNumber: "50", postalCode: "30130000" });
  });
});
