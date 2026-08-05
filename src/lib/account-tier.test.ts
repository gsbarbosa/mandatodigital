import { describe, expect, it } from "vitest";

import {
  getEntitlements,
  isPaidAccountTier,
  resolveAccountTierFromBilling,
} from "./account-tier";

describe("account-tier", () => {
  it("mantém trial até o pagamento confirmar", () => {
    expect(
      resolveAccountTierFromBilling({ billingStatus: "trial", planId: "essencial" }),
    ).toBe("trial");
    expect(
      resolveAccountTierFromBilling({
        billingStatus: "pending_payment",
        planId: "elite",
      }),
    ).toBe("trial");
    expect(
      resolveAccountTierFromBilling({ billingStatus: "past_due", planId: "avancado" }),
    ).toBe("trial");
  });

  it("mapeia os 3 planos pagos só com billing active", () => {
    expect(
      resolveAccountTierFromBilling({ billingStatus: "active", planId: "essencial" }),
    ).toBe("essencial");
    expect(
      resolveAccountTierFromBilling({ billingStatus: "active", planId: "avancado" }),
    ).toBe("avancado");
    expect(
      resolveAccountTierFromBilling({ billingStatus: "active", planId: "elite" }),
    ).toBe("elite");
    expect(resolveAccountTierFromBilling({ billingStatus: "active", planId: "" })).toBe(
      "essencial",
    );
  });

  it("diferencia entitlements entre trial e os 3 pagos", () => {
    expect(isPaidAccountTier("trial")).toBe(false);
    expect(getEntitlements("trial").guestQuotas).toBe(true);
    expect(getEntitlements("essencial")).toMatchObject({
      isPaid: true,
      avatarsPerMonth: 5,
      maxScriptWords: 140,
      multiNetworkPublish: false,
    });
    expect(getEntitlements("avancado")).toMatchObject({
      avatarsPerMonth: 22,
      maxScriptWords: 210,
      complianceLegalPack: true,
      advancedDigitalTwinRender: true,
    });
    expect(getEntitlements("elite")).toMatchObject({
      avatarsPerMonth: 60,
      maxScriptWords: 420,
      multiNetworkPublish: true,
      maxPublishNetworks: 7,
    });
  });
});
