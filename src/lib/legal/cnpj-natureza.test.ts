import { describe, expect, it } from "vitest";

import { isAllowedElectoralNatureza } from "@/lib/legal/cnpj-natureza";

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
