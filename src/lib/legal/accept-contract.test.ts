import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  ContractAcceptanceError,
  deriveContractFields,
  needsContractAcceptanceForCheckout,
} from "@/lib/legal/accept-contract";

vi.mock("@/lib/legal/cnpj-natureza", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/legal/cnpj-natureza")>();
  return {
    ...actual,
    lookupCnpjBrasilApi: vi.fn(),
  };
});

import { lookupCnpjBrasilApi } from "@/lib/legal/cnpj-natureza";

const lookupMock = vi.mocked(lookupCnpjBrasilApi);

describe("needsContractAcceptanceForCheckout", () => {
  it("exige aceite quando nao ha contrato", () => {
    expect(needsContractAcceptanceForCheckout(null, "essencial")).toBe(true);
  });

  it("nao exige aceite quando plano coincide", () => {
    expect(
      needsContractAcceptanceForCheckout({ planId: "avancado" }, "avancado"),
    ).toBe(false);
  });

  it("exige aceite quando plano mudou", () => {
    expect(
      needsContractAcceptanceForCheckout({ planId: "essencial" }, "elite"),
    ).toBe(true);
  });
});

describe("deriveContractFields", () => {
  beforeEach(() => {
    lookupMock.mockReset();
  });

  it("trava nome e endereco quando a Receita traz dados completos", async () => {
    lookupMock.mockResolvedValue({
      cnpj: "12345678000190",
      razaoSocial: "ELEICAO 2026 JOAO DA SILVA",
      naturezaJuridica: "Candidato a Cargo Politico Eletivo",
      logradouro: "Rua das Flores",
      numero: "100",
      bairro: "Centro",
      municipio: "Belo Horizonte",
      uf: "MG",
      cep: "30130100",
    });

    const derived = await deriveContractFields({
      cnpjDigits: "12345678000190",
      fallbackCampaignName: "Fallback Nome",
      fallbackCampaignAddress: "Fallback Endereco",
      party: "PT",
    });

    expect(derived.campaignNameLocked).toBe(true);
    expect(derived.campaignAddressLocked).toBe(true);
    expect(derived.campaignName).toBe("ELEICAO 2026 JOAO DA SILVA");
    expect(derived.campaignAddress).toContain("Rua das Flores");
    expect(derived.campaignAddress).toContain("Belo Horizonte");
    expect(derived.campaignAddress).not.toContain("Fallback");
  });

  it("usa fallback de nome quando razao social vem vazia e anexa partido", async () => {
    lookupMock.mockResolvedValue({
      cnpj: "12345678000190",
      razaoSocial: "",
      naturezaJuridica: "Comite Financeiro de Candidato a Cargo Eletivo",
      logradouro: "Av Brasil",
      numero: "50",
      bairro: "Savassi",
      municipio: "Belo Horizonte",
      uf: "MG",
      cep: "30140000",
    });

    const derived = await deriveContractFields({
      cnpjDigits: "12345678000190",
      fallbackCampaignName: "Maria Souza",
      fallbackCampaignAddress: "Ignorado",
      party: "PSDB",
    });

    expect(derived.campaignNameLocked).toBe(false);
    expect(derived.campaignAddressLocked).toBe(true);
    expect(derived.campaignName).toBe("Maria Souza (PSDB)");
  });

  it("usa fallback de endereco quando CEP/logradouro faltam", async () => {
    lookupMock.mockResolvedValue({
      cnpj: "12345678000190",
      razaoSocial: "CAMPANHA X",
      naturezaJuridica: "Candidato a Cargo Politico Eletivo",
      municipio: "BH",
      uf: "MG",
    });

    const derived = await deriveContractFields({
      cnpjDigits: "12345678000190",
      fallbackCampaignName: "X",
      fallbackCampaignAddress: "Rua Cadastro, 1, BH - MG, CEP 30130-000",
    });

    expect(derived.campaignNameLocked).toBe(true);
    expect(derived.campaignAddressLocked).toBe(false);
    expect(derived.campaignAddress).toBe("Rua Cadastro, 1, BH - MG, CEP 30130-000");
  });

  it("rejeita natureza inelegivel com 422", async () => {
    lookupMock.mockResolvedValue({
      cnpj: "12345678000190",
      razaoSocial: "EMPRESA LTDA",
      naturezaJuridica: "Sociedade Empresaria Limitada",
    });

    await expect(
      deriveContractFields({
        cnpjDigits: "12345678000190",
        fallbackCampaignName: "A",
        fallbackCampaignAddress: "B",
      }),
    ).rejects.toMatchObject({
      name: "ContractAcceptanceError",
      status: 422,
    } satisfies Partial<ContractAcceptanceError>);
  });

  it("mapeia falha de rede da Brasil API para 502", async () => {
    lookupMock.mockRejectedValue(new Error("Falha ao consultar CNPJ (HTTP 503)."));

    await expect(
      deriveContractFields({
        cnpjDigits: "12345678000190",
        fallbackCampaignName: "A",
        fallbackCampaignAddress: "B",
      }),
    ).rejects.toMatchObject({
      name: "ContractAcceptanceError",
      status: 502,
    });
  });
});
