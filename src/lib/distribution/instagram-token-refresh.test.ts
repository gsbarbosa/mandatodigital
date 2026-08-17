import { beforeEach, describe, expect, it, vi } from "vitest";

import { refreshExpiringInstagramTokens } from "@/lib/distribution/instagram-token-refresh";

const listInstagramTokensExpiringBefore = vi.fn();
const setInstagramToken = vi.fn();
const refreshInstagramLongLivedToken = vi.fn();

vi.mock("@/lib/admin/provider-secrets", () => ({
  decryptProviderSecret: (value: string) => value.replace(/^enc:/, ""),
  encryptProviderSecret: (value: string) => `enc:${value}`,
}));

vi.mock("@/lib/distribution/connection-storage", () => ({
  socialConnectionStorage: {
    listInstagramTokensExpiringBefore: (...args: unknown[]) =>
      listInstagramTokensExpiringBefore(...args),
    setInstagramToken: (...args: unknown[]) => setInstagramToken(...args),
  },
}));

vi.mock("@/lib/distribution/instagram-graph-client", () => ({
  refreshInstagramLongLivedToken: (...args: unknown[]) =>
    refreshInstagramLongLivedToken(...args),
}));

const NOW = new Date("2026-08-17T00:00:00.000Z");

function connection(overrides: Record<string, unknown> = {}) {
  return {
    profileId: "profile-1",
    instagramTokenEncrypted: "enc:token-antigo",
    instagramTokenExpiresAt: "2026-08-25T00:00:00.000Z",
    ...overrides,
  };
}

describe("refreshExpiringInstagramTokens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    refreshInstagramLongLivedToken.mockResolvedValue({
      accessToken: "token-novo",
      expiresIn: 60 * 60 * 24 * 60,
    });
  });

  it("consulta pela janela de 15 dias por padrao", async () => {
    listInstagramTokensExpiringBefore.mockResolvedValue([]);

    await refreshExpiringInstagramTokens({ now: NOW });

    expect(listInstagramTokensExpiringBefore).toHaveBeenCalledWith(
      "2026-09-01T00:00:00.000Z",
      50,
    );
  });

  it("renova e regrava o token criptografado com novo vencimento", async () => {
    listInstagramTokensExpiringBefore.mockResolvedValue([connection()]);

    const result = await refreshExpiringInstagramTokens({ now: NOW });

    expect(refreshInstagramLongLivedToken).toHaveBeenCalledWith("token-antigo");
    expect(setInstagramToken).toHaveBeenCalledWith("profile-1", {
      instagramTokenEncrypted: "enc:token-novo",
      instagramTokenExpiresAt: "2026-10-16T00:00:00.000Z",
    });
    expect(result.refreshed).toBe(1);
    expect(result.failed).toBe(0);
  });

  it("uma conexao quebrada nao derruba a varredura", async () => {
    listInstagramTokensExpiringBefore.mockResolvedValue([
      connection(),
      connection({ profileId: "profile-2" }),
    ]);
    refreshInstagramLongLivedToken
      .mockRejectedValueOnce(new Error("token expirado"))
      .mockResolvedValueOnce({ accessToken: "token-novo", expiresIn: 100 });

    const result = await refreshExpiringInstagramTokens({ now: NOW });

    expect(result.scanned).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.refreshed).toBe(1);
    expect(result.details[0]).toMatchObject({
      profileId: "profile-1",
      outcome: "failed",
    });
  });

  it("nao chama a Meta quando o token gravado esta vazio", async () => {
    listInstagramTokensExpiringBefore.mockResolvedValue([
      connection({ instagramTokenEncrypted: "enc:" }),
    ]);

    const result = await refreshExpiringInstagramTokens({ now: NOW });

    expect(refreshInstagramLongLivedToken).not.toHaveBeenCalled();
    expect(result.failed).toBe(1);
  });
});
