import { describe, expect, it } from "vitest";

import { hasOpenBillingPackage, hasRemainingCampaignInstallments } from "./billing-package";

describe("billing-package", () => {
  it("bloqueia novo checkout se já existe pacote aberto", () => {
    expect(
      hasOpenBillingPackage({
        billingStatus: "pending_payment",
        asaasInstallmentId: "ins_1",
      }),
    ).toBe(true);
    expect(
      hasOpenBillingPackage({
        billingStatus: "past_due",
        asaasPrimaryPaymentId: "pay_1",
      }),
    ).toBe(true);
    expect(
      hasOpenBillingPackage({
        billingStatus: "active",
        asaasInstallmentId: "ins_1",
      }),
    ).toBe(true);
    expect(
      hasOpenBillingPackage({
        billingStatus: "trial",
        asaasInstallmentId: null,
      }),
    ).toBe(false);
  });

  it("detecta parcelas restantes do pacote 3x", () => {
    expect(
      hasRemainingCampaignInstallments({
        billingStatus: "active",
        paidInstallments: 1,
        installmentCount: 3,
      }),
    ).toBe(true);
    expect(
      hasRemainingCampaignInstallments({
        billingStatus: "active",
        paidInstallments: 3,
        installmentCount: 3,
      }),
    ).toBe(false);
    expect(
      hasRemainingCampaignInstallments({
        billingStatus: "past_due",
        paidInstallments: 2,
        installmentCount: 3,
      }),
    ).toBe(true);
  });
});
