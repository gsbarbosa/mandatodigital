import { describe, expect, it } from "vitest";

import {
  formatHeyGenAvatarGroupLockMessage,
  formatHeyGenPurgeFailureMessage,
} from "./curador-heygen-prefs";

describe("formatHeyGenAvatarGroupLockMessage", () => {
  it("traduz bloqueio de modificacao com data", () => {
    const message = formatHeyGenAvatarGroupLockMessage(
      "Cannot modify this avatar group until 2026-07-01",
    );

    expect(message).toContain("01/07/2026");
    expect(message).toContain("bloqueado");
  });

  it("retorna null para mensagens sem bloqueio", () => {
    expect(formatHeyGenAvatarGroupLockMessage("Something else")).toBeNull();
  });
});

describe("formatHeyGenPurgeFailureMessage", () => {
  it("prioriza erro de bloqueio do grupo", () => {
    const message = formatHeyGenPurgeFailureMessage([
      {
        groupId: "e9c915ac98bc4b27bbf5f4b605802d07",
        message: "Cannot modify this avatar group until 2026-07-01",
      },
    ]);

    expect(message).toContain("01/07/2026");
  });

  it("usa fallback quando nao ha erros", () => {
    expect(formatHeyGenPurgeFailureMessage(undefined, "Falha generica")).toBe(
      "Falha generica",
    );
  });
});
