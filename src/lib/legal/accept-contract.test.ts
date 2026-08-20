import { describe, expect, it } from "vitest";

import { needsContractAcceptanceForCheckout } from "@/lib/legal/accept-contract";

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
