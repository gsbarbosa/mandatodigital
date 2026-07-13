import { describe, expect, it } from "vitest";

import { renderLegalPdf } from "@/lib/legal/pdf";
import { renderContractDocument } from "@/lib/legal/templates";

describe("legal pdf", () => {
  it("gera buffer PDF nao vazio", async () => {
    const doc = renderContractDocument({
      acceptanceId: "22222222-2222-2222-2222-222222222222",
      campaignName: "Campanha PDF",
      campaignCnpj: "12.345.678/0001-90",
      campaignAddress: "Rua B, 2",
      financialResponsible: "Beltrano",
      planId: "essencial",
      ip: "127.0.0.1",
      userAgent: "vitest",
      acceptedAt: new Date("2026-07-10T15:00:00.000Z"),
    });
    const pdf = await renderLegalPdf(doc);
    expect(pdf.byteLength).toBeGreaterThan(500);
    expect(pdf.subarray(0, 4).toString("utf8")).toBe("%PDF");
  });
});
