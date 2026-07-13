import { describe, expect, it, beforeEach } from "vitest";

import { checkRateLimit, releaseRateLimit, resetRateLimitBuckets } from "./rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    resetRateLimitBuckets();
  });

  it("peek nao consome cota", () => {
    const peek1 = checkRateLimit({
      key: "k",
      max: 1,
      windowMs: 60_000,
      consume: false,
    });
    const peek2 = checkRateLimit({
      key: "k",
      max: 1,
      windowMs: 60_000,
      consume: false,
    });
    expect(peek1.allowed).toBe(true);
    expect(peek2.allowed).toBe(true);

    const consumed = checkRateLimit({ key: "k", max: 1, windowMs: 60_000, consume: true });
    expect(consumed.allowed).toBe(true);
    const blocked = checkRateLimit({ key: "k", max: 1, windowMs: 60_000, consume: false });
    expect(blocked.allowed).toBe(false);
  });

  it("releaseRateLimit devolve cota apos falha", () => {
    checkRateLimit({ key: "k2", max: 1, windowMs: 60_000, consume: true });
    releaseRateLimit({ key: "k2" });
    const again = checkRateLimit({ key: "k2", max: 1, windowMs: 60_000, consume: true });
    expect(again.allowed).toBe(true);
  });
});
