import { describe, expect, it } from "vitest";

import {
  renderContractDocument,
  renderDossierDocument,
} from "@/lib/legal/templates";

describe("legal templates", () => {
  it("preenche placeholders e gera hash estavel para o mesmo input", () => {
    const fill = {
      acceptanceId: "11111111-1111-1111-1111-111111111111",
      campaignName: "Campanha Teste",
      campaignCnpj: "12.345.678/0001-90",
      campaignAddress: "Rua A, 1 - BH/MG",
      financialResponsible: "Fulano",
      planId: "avancado" as const,
      ip: "1.2.3.4",
      userAgent: "vitest",
      acceptedAt: new Date("2026-07-10T15:00:00.000Z"),
    };

    const contract = renderContractDocument(fill);
    const again = renderContractDocument(fill);
    expect(contract.hash).toBe(again.hash);
    expect(contract.text).toContain("Campanha Teste");
    expect(contract.text).toContain("12.345.678/0001-90");
    expect(contract.text).toContain("R$ 1.998,00");

    const dossier = renderDossierDocument(fill, contract.hash);
    expect(dossier.text).toContain(contract.hash);
    expect(dossier.text).toContain(fill.acceptanceId);
  });
});
