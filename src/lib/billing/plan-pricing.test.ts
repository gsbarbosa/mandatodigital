import { describe, expect, it } from "vitest";

import {
  formatBrl,
  getPlanPricing,
  parseBillingStatus,
  subscriptionEndDateFromFirstDue,
} from "./plan-pricing";

describe("plan-pricing", () => {
  it("tem 3 parcelas e totais do pacote campanha", () => {
    expect(getPlanPricing("essencial")).toMatchObject({
      installmentValue: 998,
      installmentCount: 3,
      campaignTotal: 2994,
    });
    expect(getPlanPricing("avancado").campaignTotal).toBe(5994);
    expect(getPlanPricing("elite").campaignTotal).toBe(14994);
  });

  it("formata BRL", () => {
    expect(formatBrl(998)).toContain("998");
  });

  it("parseia billingStatus com default trial", () => {
    expect(parseBillingStatus("active")).toBe("active");
    expect(parseBillingStatus("x")).toBe("trial");
  });

  it("endDate cobre 3 ciclos a partir do primeiro vencimento", () => {
    expect(subscriptionEndDateFromFirstDue("2026-08-10")).toBe("2026-10-10");
  });
});
