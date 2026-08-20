import { describe, expect, it } from "vitest";

import { renderContractDocument, renderDossierDocument } from "@/lib/legal/templates";
import { renderLegalPdf } from "@/lib/legal/pdf";

describe("renderLegalPdf", () => {
  it("gera pdf com carimbo no rodape", async () => {
    const document = renderContractDocument({
      acceptanceId: "11111111-1111-1111-1111-111111111111",
      campaignName: "Campanha Teste",
      campaignCnpj: "12.345.678/0001-90",
      campaignAddress: "Rua A, 1 - BH/MG",
      financialResponsible: "Fulano",
      planId: "essencial",
      ip: "203.0.113.10",
      userAgent: "vitest",
      acceptedAt: new Date("2026-07-10T15:00:00.000Z"),
    });

    const pdf = await renderLegalPdf(document);
    const countMatch = pdf.toString("latin1").match(/\/Count (\d+)/);

    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(2_000);
    expect(document.stamp.contractReference).toBe("MD-111111111111");
    expect(document.hash).toHaveLength(64);
    expect(Number(countMatch?.[1] ?? 0)).toBeGreaterThan(0);
    expect(Number(countMatch?.[1] ?? 99)).toBeLessThanOrEqual(6);
  });

  it("gera dossie em poucas paginas", async () => {
    const fill = {
      acceptanceId: "11111111-1111-1111-1111-111111111111",
      campaignName: "Campanha Teste",
      campaignCnpj: "12.345.678/0001-90",
      campaignAddress: "Rua A, 1 - BH/MG",
      financialResponsible: "Fulano",
      planId: "avancado" as const,
      ip: "203.0.113.10",
      userAgent: "vitest",
      acceptedAt: new Date("2026-07-10T15:00:00.000Z"),
    };
    const contract = renderContractDocument(fill);
    const dossier = renderDossierDocument(fill, contract.hash);
    const pdf = await renderLegalPdf(dossier);
    const countMatch = pdf.toString("latin1").match(/\/Count (\d+)/);
    expect(Number(countMatch?.[1] ?? 99)).toBeLessThanOrEqual(6);
  });
});
