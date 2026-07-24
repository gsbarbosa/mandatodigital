import { describe, expect, it } from "vitest";

import {
  MAX_ADVERSARY_PROFILES,
  MAX_INTEREST_PROFILES,
  MAX_INTEREST_THEMES,
  MAX_MUNICIPAL_CITIES,
  MAX_MUNICIPAL_PORTALS,
  MAX_MUNICIPAL_PROFILES,
  MAX_RADAR_THEMES_TOTAL,
  MAX_THEMES_PER_SPHERE,
  countInterestThemes,
  countRadarThemes,
} from "./sphere-theme-catalog";

describe("sphere-theme-catalog limits", () => {
  it("conta temas únicos no radar unificado", () => {
    expect(
      countRadarThemes({
        federal: ["Vacinação", "Desemprego"],
        estadual: ["Desemprego", "Segurança Pública"],
      }),
    ).toBe(3);
    expect(countInterestThemes(["Vacinação", "Vacinação", "Desemprego"])).toBe(2);
  });

  it("canonicaliza tema legado sem acento", async () => {
    const { canonicalizeSentinelTheme } = await import("./sphere-theme-catalog");
    expect(canonicalizeSentinelTheme("Seguranca Publica")).toBe("Segurança Pública");
    expect(canonicalizeSentinelTheme("Saude Publica (SUS)")).toBe("Saúde Pública (SUS)");
  });

  it("expõe limites unificados do convidado", () => {
    expect(MAX_INTEREST_THEMES).toBe(8);
    expect(MAX_THEMES_PER_SPHERE).toBe(8);
    expect(MAX_RADAR_THEMES_TOTAL).toBe(8);
    expect(MAX_MUNICIPAL_CITIES).toBe(2);
    expect(MAX_MUNICIPAL_PORTALS).toBe(2);
    expect(MAX_INTEREST_PROFILES).toBe(2);
    expect(MAX_MUNICIPAL_PROFILES).toBe(2);
    expect(MAX_ADVERSARY_PROFILES).toBe(2);
  });
});
