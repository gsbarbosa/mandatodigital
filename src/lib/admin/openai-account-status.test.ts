import { describe, expect, it } from "vitest";

import {
  buildOpenAiUsageSnapshot,
  parseOpenAiMeStatus,
  parseOpenAiSpendLimitUsd,
  sumOpenAiCostsUsd,
  summarizeOpenAiModels,
} from "./openai-account-status";

describe("openai-account-status", () => {
  it("extrai usuário e org de /v1/me", () => {
    const account = parseOpenAiMeStatus({
      id: "user-123",
      email: "dev@example.com",
      name: "Dev",
      orgs: {
        data: [
          { id: "org-abc", title: "Mandato Digital" },
          { id: "org-xyz", title: "Outra" },
        ],
      },
    });

    expect(account.email).toBe("dev@example.com");
    expect(account.org).toBe("Mandato Digital");
    expect(account.orgsCount).toBe(2);
  });

  it("resume modelos notáveis", () => {
    const summary = summarizeOpenAiModels({
      data: [{ id: "gpt-4.1-mini" }, { id: "gpt-image-1.5" }, { id: "whisper-1" }],
    });
    expect(summary.modelsVisible).toBe(3);
    expect(summary.notableModels).toContain("gpt-4.1-mini");
    expect(summary.notableModels).toContain("gpt-image-1.5");
  });

  it("soma custos MTD", () => {
    const total = sumOpenAiCostsUsd({
      data: [
        {
          results: [{ amount: { value: 1.25, currency: "usd" } }],
        },
        {
          result: [{ amount: { value: 0.75, currency: "usd" } }],
        },
      ],
    });
    expect(total).toBe(2);
  });

  it("converte spend limit de centavos para USD", () => {
    expect(
      parseOpenAiSpendLimitUsd({
        threshold_amount: 10000,
        interval: "month",
        enforcement: { status: "enforcing" },
      }),
    ).toEqual({
      limitUsd: 100,
      interval: "month",
      enforcement: "enforcing",
    });
  });

  it("monta barra de uso com spend limit", () => {
    const usage = buildOpenAiUsageSnapshot({
      monthSpendUsd: 35,
      spendLimitUsd: 100,
    });
    expect(usage?.remaining).toBe(65);
    expect(usage?.percentUsed).toBe(35);
    expect(usage?.exhausted).toBe(false);
  });
});
