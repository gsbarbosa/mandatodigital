import { describe, expect, it } from "vitest";

import {
  buildSentinelRefreshStatusMessage,
  isSentinelCacheNewer,
} from "@/lib/sentinel-refresh-client";

describe("sentinel-refresh-client", () => {
  it("monta mensagem de sucesso com contagem de sinais", () => {
    expect(buildSentinelRefreshStatusMessage([{ id: "1" } as never], null)).toContain(
      "1 sinal atualizado",
    );
    expect(buildSentinelRefreshStatusMessage([{ id: "1" } as never, { id: "2" } as never], null)).toContain(
      "2 sinais atualizados",
    );
  });

  it("detecta cache mais recente pelo refreshedAt", () => {
    expect(
      isSentinelCacheNewer("2026-06-24T10:00:00.000Z", {
        refreshedAt: "2026-06-24T11:00:00.000Z",
      } as never),
    ).toBe(true);

    expect(
      isSentinelCacheNewer("2026-06-24T11:00:00.000Z", {
        refreshedAt: "2026-06-24T10:00:00.000Z",
      } as never),
    ).toBe(false);
  });
});
