import { describe, expect, it } from "vitest";

import { maxScriptWordsForPlan, maxScriptWordsForTier, maxVideoSecondsLabelForTier } from "./plan-limits";

describe("plan-limits", () => {
  it("diferencia teto de roteiro entre trial e os 3 planos", () => {
    expect(maxScriptWordsForTier("trial")).toBe(140);
    expect(maxScriptWordsForTier("essencial")).toBe(140);
    expect(maxScriptWordsForTier("avancado")).toBe(210);
    expect(maxScriptWordsForTier("elite")).toBe(420);
    expect(maxVideoSecondsLabelForTier("avancado")).toMatch(/90/);
    expect(maxVideoSecondsLabelForTier("elite")).toMatch(/3/);
  });

  it("planId sem billing ainda mapeia o teto do plano", () => {
    expect(maxScriptWordsForPlan(null)).toBe(140);
    expect(maxScriptWordsForPlan("avancado")).toBe(210);
    expect(maxScriptWordsForPlan("elite")).toBe(420);
  });
});
