import { describe, expect, it } from "vitest";

import {
  formatHeyGenDurationSeconds,
  parseHeyGenUserMeStatus,
  resolveHeyGenWalletHealth,
} from "./heygen-account-status";

describe("resolveHeyGenWalletHealth", () => {
  it("classifica faixas de saldo", () => {
    expect(resolveHeyGenWalletHealth(0)).toBe("empty");
    expect(resolveHeyGenWalletHealth(1.99)).toBe("critical");
    expect(resolveHeyGenWalletHealth(2.35)).toBe("low");
    expect(resolveHeyGenWalletHealth(5)).toBe("ok");
  });
});

describe("formatHeyGenDurationSeconds", () => {
  it("formata segundos e minutos", () => {
    expect(formatHeyGenDurationSeconds(47)).toBe("47s");
    expect(formatHeyGenDurationSeconds(60)).toBe("1min");
    expect(formatHeyGenDurationSeconds(95)).toBe("1min 35s");
  });
});

describe("parseHeyGenUserMeStatus", () => {
  it("lê wallet pay-as-you-go com saúde, autonomia e auto-reload", () => {
    const parsed = parseHeyGenUserMeStatus({
      data: {
        username: "gstvbba",
        email: "gs@example.com",
        first_name: "Gustavo",
        last_name: "Barbosa",
        billing_type: "wallet",
        wallet: {
          currency: "usd",
          remaining_balance: 2.35,
          auto_reload: { enabled: false },
        },
        subscription: null,
        usage_based: null,
      },
    });

    expect(parsed.account?.billingType).toBe("wallet");
    expect(parsed.account?.plan).toContain("pay-as-you-go");
    expect(parsed.account?.autoReload).toBe(false);
    expect(parsed.account?.walletRemainingUsd).toBe(2.35);
    expect(parsed.account?.walletHealth).toBe("low");
    expect(parsed.account?.estPhotoVideoSeconds).toBe(47);
    expect(parsed.account?.estTwinVideoSeconds).toBe(35);
    expect(parsed.usage?.kind).toBe("balance");
    expect(parsed.usage?.label).toContain("wallet");
    expect(parsed.usage?.remaining).toBe(2.35);
    expect(parsed.usage?.unit).toBe("USD");
    expect(parsed.usage?.exhausted).toBe(false);
  });

  it("marca wallet zerada como exhausted + empty", () => {
    const parsed = parseHeyGenUserMeStatus({
      data: {
        billing_type: "wallet",
        wallet: { currency: "usd", remaining_balance: 0, auto_reload: { enabled: true, threshold_usd: 5, amount_usd: 20 } },
      },
    });

    expect(parsed.account?.walletHealth).toBe("empty");
    expect(parsed.account?.autoReload).toBe(true);
    expect(parsed.account?.autoReloadThresholdUsd).toBe(5);
    expect(parsed.account?.autoReloadAmountUsd).toBe(20);
    expect(parsed.usage?.exhausted).toBe(true);
    expect(parsed.usage?.kind).toBe("balance");
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
    expect(parsed.account?.subscriptionPlan).toBe("creator");
    expect(parsed.account?.addOnCredits).toBe(10);
    expect(parsed.account?.premiumCreditsRemaining).toBe(80);
    expect(parsed.usage?.kind).toBe("quota");
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
    expect(parsed.account?.spendingCurrentUsd).toBe(35);
    expect(parsed.account?.spendingCapUsd).toBe(100);
    expect(parsed.usage?.kind).toBe("quota");
    expect(parsed.usage?.used).toBe(35);
    expect(parsed.usage?.limit).toBe(100);
    expect(parsed.usage?.remaining).toBe(65);
    expect(parsed.usage?.unit).toBe("USD");
  });

  it("mantém add-on de subscription visível mesmo em wallet", () => {
    const parsed = parseHeyGenUserMeStatus({
      data: {
        billing_type: "wallet",
        wallet: { currency: "usd", remaining_balance: 12, auto_reload: { enabled: true } },
        subscription: {
          plan: "pro",
          credits: { add_on_credits: { remaining: 4 } },
        },
      },
    });

    expect(parsed.usage?.kind).toBe("balance");
    expect(parsed.account?.subscriptionPlan).toBe("pro");
    expect(parsed.account?.addOnCredits).toBe(4);
    expect(parsed.account?.walletHealth).toBe("ok");
  });
});
