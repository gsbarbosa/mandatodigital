import { describe, expect, it } from "vitest";

import { heygenStatusBadge, readHeyGenWalletHealth } from "./heygen-provider-insights";

describe("readHeyGenWalletHealth", () => {
  it("lê saúde válida do account dump", () => {
    expect(readHeyGenWalletHealth({ walletHealth: "low" })).toBe("low");
    expect(readHeyGenWalletHealth({ walletHealth: "nope" })).toBeNull();
    expect(readHeyGenWalletHealth(null)).toBeNull();
  });
});

describe("heygenStatusBadge", () => {
  it("prioriza erro de key", () => {
    expect(heygenStatusBadge({ ok: false, health: "ok" }).label).toBe("Sem key / erro");
  });

  it("reflete saúde da wallet", () => {
    expect(heygenStatusBadge({ ok: true, health: "empty" }).label).toBe("Wallet zerada");
    expect(heygenStatusBadge({ ok: true, health: "critical" }).label).toBe("Saldo crítico");
    expect(heygenStatusBadge({ ok: true, health: "low" }).label).toBe("Saldo baixo");
    expect(heygenStatusBadge({ ok: true, health: "ok" }).label).toBe("Configurado");
  });
});
