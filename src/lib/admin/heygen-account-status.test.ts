import { describe, expect, it } from "vitest";

import { parseHeyGenUserMeStatus } from "./heygen-account-status";

describe("parseHeyGenUserMeStatus", () => {
  it("lê wallet pay-as-you-go (billing_type=wallet)", () => {
    const parsed = parseHeyGenUserMeStatus({
      data: {
        username: "gstvbba",
        email: "gs@example.com",
        first_name: "Gustavo",
        last_name: "Barbosa",
        billing_type: "wallet",
        wallet: {
          currency: "usd",
          remaining_balance: 12.5,
          auto_reload: { enabled: true, threshold_usd: 5, amount_usd: 20 },
        },
        subscription: null,
        usage_based: null,
      },
    });

    expect(parsed.account?.billingType).toBe("wallet");
    expect(parsed.account?.plan).toContain("pay-as-you-go");
    expect(parsed.account?.autoReload).toBe(true);
    expect(parsed.usage?.label).toContain("wallet");
    expect(parsed.usage?.remaining).toBe(12.5);
    expect(parsed.usage?.unit).toBe("USD");
    expect(parsed.usage?.exhausted).toBe(false);
  });

  it("lê subscription com créditos premium e plano", () => {
    const parsed = parseHeyGenUserMeStatus({
      data: {
        username: "jane",
        email: "jane@example.com",
        billing_type: "subscription",
        wallet: null,
        subscription: {
          plan: "creator",
          credits: {
            premium_credits: {
              remaining: 80,
              resets_at: "2026-08-01T00:00:00.000Z",
            },
            add_on_credits: { remaining: 10 },
          },
          included_credits: 100,
        },
        usage_based: null,
      },
    });

    expect(parsed.account?.billingType).toBe("subscription");
    expect(parsed.account?.plan).toBe("creator");
    expect(parsed.account?.addOnCredits).toBe(10);
    expect(parsed.usage?.used).toBe(20);
    expect(parsed.usage?.remaining).toBe(80);
    expect(parsed.usage?.limit).toBe(100);
    expect(parsed.usage?.cycleEnd).toContain("2026-08-01");
  });

  it("lê usage_based com cap de gasto", () => {
    const parsed = parseHeyGenUserMeStatus({
      data: {
        username: "metered",
        billing_type: "usage_based",
        usage_based: {
          spending_current_usd: 35,
          spending_cap_usd: 100,
        },
      },
    });

    expect(parsed.account?.billingType).toBe("usage_based");
    expect(parsed.usage?.used).toBe(35);
    expect(parsed.usage?.limit).toBe(100);
    expect(parsed.usage?.remaining).toBe(65);
    expect(parsed.usage?.unit).toBe("USD");
  });
});
