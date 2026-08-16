import { describe, expect, it } from "vitest";

import {
  evaluateFactCheckForApproval,
  normalizeFactCheckVerdict,
} from "@/lib/auditor/fact-check-gate";
import type { FactCheckResult } from "@/lib/auditor/types";

function result(overrides: Partial<FactCheckResult>): FactCheckResult {
  return {
    verdict: "verified",
    confidence: 80,
    summary: "ok",
    claims: [],
    sources: [],
    checkedAt: new Date().toISOString(),
    provider: "openai",
    model: "gpt-4.1-mini",
    ...overrides,
  };
}

describe("normalizeFactCheckVerdict", () => {
  it("nao deixa verified passar com claim unsupported", () => {
    const out = normalizeFactCheckVerdict(
      result({
        claims: [{ text: "O Lula morreu de infarto.", verdict: "unsupported" }],
      }),
    );
    expect(out.verdict).toBe("inconclusive");
  });

  it("sobe contradicao para disputed", () => {
    const out = normalizeFactCheckVerdict(
      result({
        claims: [{ text: "Investiu 5 milhoes.", verdict: "contradicted" }],
      }),
    );
    expect(out.verdict).toBe("disputed");
  });
});

describe("evaluateFactCheckForApproval", () => {
  it("libera so verified sem claims unproven", () => {
    expect(evaluateFactCheckForApproval(result({}))).toEqual({ ok: true });
  });

  it("bloqueia disputed, inconclusive e skipped", () => {
    expect(evaluateFactCheckForApproval(result({ verdict: "disputed", summary: "mente" })).ok).toBe(
      false,
    );
    expect(evaluateFactCheckForApproval(result({ verdict: "inconclusive" })).ok).toBe(false);
    expect(evaluateFactCheckForApproval(result({ verdict: "skipped" })).ok).toBe(false);
  });

  it("bloqueia fallback heuristico mesmo com inconclusive", () => {
    const decision = evaluateFactCheckForApproval(
      result({
        verdict: "inconclusive",
        confidence: 0,
        provider: null,
        model: null,
        summary: "Nao foi possivel validar automaticamente. Revise manualmente antes de publicar.",
      }),
    );
    expect(decision.ok).toBe(false);
  });

  it("bloqueia claim unsupported mesmo se o verdict geral vier verified", () => {
    const decision = evaluateFactCheckForApproval(
      result({
        claims: [{ text: "O Lula morreu de infarto.", verdict: "unsupported" }],
      }),
    );
    expect(decision.ok).toBe(false);
  });
});
