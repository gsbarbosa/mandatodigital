import { describe, expect, it } from "vitest";

import {
  MAX_ADVERSARY_PROFILES,
  MAX_MUNICIPAL_PORTALS,
  MAX_MUNICIPAL_PROFILES,
  MAX_RADAR_THEMES_TOTAL,
  countRadarThemes,
} from "./sphere-theme-catalog";

describe("sphere-theme-catalog limits", () => {
  it("soma federal e estadual no total de temas", () => {
    expect(
      countRadarThemes({
        federal: ["Vacinacao"],
        estadual: Array(9).fill("Desemprego"),
      }),
    ).toBe(10);
  });

  it("expõe limites do radar", () => {
    expect(MAX_RADAR_THEMES_TOTAL).toBe(10);
    expect(MAX_MUNICIPAL_PROFILES).toBe(2);
    expect(MAX_MUNICIPAL_PORTALS).toBe(2);
    expect(MAX_ADVERSARY_PROFILES).toBe(2);
  });
});
