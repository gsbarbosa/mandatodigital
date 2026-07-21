import { describe, expect, it } from "vitest";

import {
  MAX_ADVERSARY_PROFILES,
  MAX_MUNICIPAL_PORTALS,
  MAX_MUNICIPAL_PROFILES,
  MAX_RADAR_THEMES_TOTAL,
  MAX_THEMES_PER_SPHERE,
  countRadarThemes,
} from "./sphere-theme-catalog";

describe("sphere-theme-catalog limits", () => {
  it("soma federal e estadual no total de temas", () => {
    expect(
      countRadarThemes({
        federal: ["Vacinação"],
        estadual: ["Desemprego", "Segurança Pública"],
      }),
    ).toBe(3);
  });

  it("canonicaliza tema legado sem acento", async () => {
    const { canonicalizeSentinelTheme } = await import("./sphere-theme-catalog");
    expect(canonicalizeSentinelTheme("Seguranca Publica")).toBe("Segurança Pública");
    expect(canonicalizeSentinelTheme("Saude Publica (SUS)")).toBe("Saúde Pública (SUS)");
  });

  it("expõe limites do radar", () => {
    expect(MAX_THEMES_PER_SPHERE).toBe(3);
    expect(MAX_RADAR_THEMES_TOTAL).toBe(10);
    expect(MAX_MUNICIPAL_PROFILES).toBe(2);
    expect(MAX_MUNICIPAL_PORTALS).toBe(2);
    expect(MAX_ADVERSARY_PROFILES).toBe(2);
  });
});
