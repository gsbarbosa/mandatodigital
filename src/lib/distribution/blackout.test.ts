import { describe, expect, it } from "vitest";

import {
  BLACKOUT_HOURS_AFTER,
  BLACKOUT_HOURS_BEFORE,
  checkElectoralBlackout,
  ELECTION_DATE,
  getBlackoutWindow,
} from "@/lib/distribution/blackout";

describe("checkElectoralBlackout", () => {
  it("bloqueia dentro da janela 72h antes / 24h depois", () => {
    const window = getBlackoutWindow(ELECTION_DATE)!;
    const inside = new Date(window.start.getTime() + 60 * 60 * 1000);
    const result = checkElectoralBlackout({ at: inside });
    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.reason).toContain("Blackout eleitoral");
      expect(result.electionDate).toBe(ELECTION_DATE);
    }
  });

  it("libera fora da janela", () => {
    const window = getBlackoutWindow(ELECTION_DATE)!;
    const before = new Date(window.start.getTime() - 60 * 60 * 1000);
    const after = new Date(window.end.getTime() + 60 * 60 * 1000);
    expect(checkElectoralBlackout({ at: before }).blocked).toBe(false);
    expect(checkElectoralBlackout({ at: after }).blocked).toBe(false);
  });

  it("usa constantes documentadas", () => {
    expect(BLACKOUT_HOURS_BEFORE).toBe(72);
    expect(BLACKOUT_HOURS_AFTER).toBe(24);
    expect(ELECTION_DATE).toBe("2026-10-04");
  });
});
