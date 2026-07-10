import { describe, expect, it, afterEach } from "vitest";

import { runFactCheck } from "@/lib/auditor/fact-check";
import { isFactCheckHeuristicFallback } from "@/lib/auditor/types";
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

  it("identifica fallback heuristico local", () => {
    expect(
      isFactCheckHeuristicFallback({
        verdict: "inconclusive",
        confidence: 0,
        summary: "Nao foi possivel validar automaticamente. Revise manualmente antes de publicar.",
        claims: [],
        sources: [],
        checkedAt: new Date().toISOString(),
        provider: null,
        model: null,
      }),
    ).toBe(true);

    expect(
      isFactCheckHeuristicFallback({
        verdict: "inconclusive",
        confidence: 42,
        summary: "Fontes insuficientes.",
        claims: [],
        sources: [],
        checkedAt: new Date().toISOString(),
        provider: "openai",
        model: "gpt-4.1-mini",
      }),
    ).toBe(false);
  });
});
