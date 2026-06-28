import { describe, expect, it, afterEach } from "vitest";

import { runFactCheck } from "@/lib/auditor/fact-check";
import { checkRateLimit, resetRateLimitBuckets } from "@/lib/rate-limit";

describe("rate-limit", () => {
  afterEach(() => {
    resetRateLimitBuckets();
  });

  it("bloqueia apos atingir o limite na janela", () => {
    const now = 1_000_000;
    const first = checkRateLimit({ key: "user-1", max: 2, windowMs: 60_000, now });
    const second = checkRateLimit({ key: "user-1", max: 2, windowMs: 60_000, now: now + 1 });
    const third = checkRateLimit({ key: "user-1", max: 2, windowMs: 60_000, now: now + 2 });

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
  });
});

describe("auditor/fact-check", () => {
  it("retorna skipped quando roteiro vazio", async () => {
    const result = await runFactCheck({ script: "   " });
    expect(result.verdict).toBe("skipped");
  });
});
