import { describe, expect, it } from "vitest";

import {
  GUEST_SENTINEL_REFRESH_WINDOW_MS,
  guestSentinelRefreshCooldownRemainingMs,
  isGuestSentinelRefreshSourceFailure,
} from "./guest-limits";

describe("guestSentinelRefreshCooldownRemainingMs", () => {
  it("permite refresh quando nunca atualizou", () => {
    expect(guestSentinelRefreshCooldownRemainingMs(null)).toBe(0);
  });

  it("bloqueia dentro da janela de 24h", () => {
    const now = Date.parse("2026-07-10T12:00:00.000Z");
    const last = "2026-07-10T10:00:00.000Z";
    expect(guestSentinelRefreshCooldownRemainingMs(last, now)).toBe(
      GUEST_SENTINEL_REFRESH_WINDOW_MS - 2 * 60 * 60 * 1000,
    );
  });

  it("libera apos 24h", () => {
    const now = Date.parse("2026-07-11T12:00:01.000Z");
    const last = "2026-07-10T12:00:00.000Z";
    expect(guestSentinelRefreshCooldownRemainingMs(last, now)).toBe(0);
  });

  it("nao consome cota quando a coleta RSS falhou por completo", () => {
    const now = Date.parse("2026-07-10T12:00:00.000Z");
    const last = "2026-07-10T11:00:00.000Z";
    expect(
      guestSentinelRefreshCooldownRemainingMs(last, now, GUEST_SENTINEL_REFRESH_WINDOW_MS, {
        refreshedAt: last,
        articlesScanned: 0,
        rssFetchStats: { attempted: 40, succeeded: 0 },
      }),
    ).toBe(0);
  });
});

describe("isGuestSentinelRefreshSourceFailure", () => {
  it("detecta falha total de fonte", () => {
    expect(
      isGuestSentinelRefreshSourceFailure({
        articlesScanned: 0,
        rssFetchStats: { attempted: 10, succeeded: 0 },
      }),
    ).toBe(true);
  });

  it("trata cache legado sem rssFetchStats e 0 artigos como falha de fonte", () => {
    expect(
      isGuestSentinelRefreshSourceFailure({
        refreshedAt: "2026-07-10T11:00:00.000Z",
        articlesScanned: 0,
      }),
    ).toBe(true);
  });
});
