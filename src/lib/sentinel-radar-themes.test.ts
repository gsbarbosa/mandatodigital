import { describe, expect, it } from "vitest";

import {
  isRadarThemeSelected,
  sanitizeMandateThemesOnLoad,
  sanitizeOppositionThemesOnLoad,
  updateRadarThemeToggle,
} from "@/lib/sentinel-radar-themes";

describe("sentinel-radar-themes", () => {
  it("descarta variantes fantasma sem acento do catálogo", () => {
    const sanitized = sanitizeMandateThemesOnLoad([
      "Contratos Publicos",
      "Inflacao e Precos",
      "Direito Trabalhista",
      "Desemprego",
    ]);

    expect(sanitized).toEqual(["Direito Trabalhista", "Desemprego"]);
  });

  it("mantém temas personalizados fora do catálogo", () => {
    const sanitized = sanitizeMandateThemesOnLoad([
      "Direito Trabalhista",
      "Zona Azul em Campinas",
    ]);

    expect(sanitized).toEqual(["Direito Trabalhista", "Zona Azul em Campinas"]);
  });

  it("detecta seleção por normalização de texto", () => {
    expect(isRadarThemeSelected(["Contratos Publicos"], "Contratos Públicos")).toBe(true);
    expect(isRadarThemeSelected(["Direito Trabalhista"], "Desemprego")).toBe(false);
  });

  it("remove variantes fantasma ao desmarcar no toggle", () => {
    const next = updateRadarThemeToggle(
      ["Contratos Publicos", "Direito Trabalhista"],
      "Contratos Públicos",
    );

    expect(next).toEqual(["Direito Trabalhista"]);
  });

  it("adiciona rótulo canônico do catálogo ao marcar", () => {
    const next = updateRadarThemeToggle([], "Inflação e Preços");

    expect(next).toEqual(["Inflação e Preços"]);
  });

  it("sanitiza temas da oposição da mesma forma", () => {
    const sanitized = sanitizeOppositionThemesOnLoad([
      "Seguranca Publica",
      "Desemprego",
    ]);

    expect(sanitized).toEqual(["Desemprego"]);
  });
});
