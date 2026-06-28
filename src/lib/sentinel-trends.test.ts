import { describe, expect, it } from "vitest";

import { applyTrendScoreBoost } from "@/lib/sentinel-trends";

describe("sentinel-trends", () => {
  it("aplica boost crescente conforme volumeDelta", () => {
    expect(applyTrendScoreBoost(50, null)).toBe(50);
    expect(
      applyTrendScoreBoost(
        50,
        { keyword: "saude", geoLabel: "SP", changePercent: 25, periodDays: 7 },
      ),
    ).toBe(56);
    expect(
      applyTrendScoreBoost(
        50,
        { keyword: "saude", geoLabel: "SP", changePercent: 120, periodDays: 7 },
      ),
    ).toBe(65);
  });
});
