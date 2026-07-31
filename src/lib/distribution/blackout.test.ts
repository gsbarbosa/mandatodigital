import { describe, expect, it } from "vitest";

import {
  BLACKOUT_HOURS_AFTER,
  BLACKOUT_HOURS_BEFORE,
  checkElectoralBlackout,
  getBlackoutWindow,
} from "@/lib/distribution/blackout";

describe("checkElectoralBlackout", () => {
  it("nao bloqueia sem data de eleicao", () => {
    expect(checkElectoralBlackout({ electionDate: null })).toEqual({ blocked: false });
    expect(checkElectoralBlackout({ electionDate: "" })).toEqual({ blocked: false });
  });

  it("bloqueia dentro da janela 72h antes / 24h depois", () => {
    const electionDate = "2026-10-04";
    const window = getBlackoutWindow(electionDate)!;
    const inside = new Date(window.start.getTime() + 60 * 60 * 1000);
    const result = checkElectoralBlackout({ electionDate, at: inside });
    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.reason).toContain("Blackout eleitoral");
      expect(result.electionDate).toBe(electionDate);
    }
  });

  it("libera fora da janela", () => {
    const electionDate = "2026-10-04";
    const window = getBlackoutWindow(electionDate)!;
    const before = new Date(window.start.getTime() - 60 * 60 * 1000);
    const after = new Date(window.end.getTime() + 60 * 60 * 1000);
    expect(checkElectoralBlackout({ electionDate, at: before }).blocked).toBe(false);
    expect(checkElectoralBlackout({ electionDate, at: after }).blocked).toBe(false);
  });

  it("usa constantes documentadas", () => {
    expect(BLACKOUT_HOURS_BEFORE).toBe(72);
    expect(BLACKOUT_HOURS_AFTER).toBe(24);
  });
});
