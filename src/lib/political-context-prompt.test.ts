import { describe, expect, it } from "vitest";

import { buildPoliticalContextPrompt } from "@/lib/political-context-prompt";

describe("buildPoliticalContextPrompt", () => {
  it("monta raio-x imparcial com tema", () => {
    const prompt = buildPoliticalContextPrompt({ topic: "Vacina BCG" });

    expect(prompt.system).toContain("Analista Politico Senior");
    expect(prompt.system).toContain("O FATO");
    expect(prompt.system).toContain("NARRATIVA DA ESQUERDA");
    expect(prompt.user).toContain("Tema/Noticia: Vacina BCG");
  });

  it("anexa dados de campo do Sentinela quando informados", () => {
    const prompt = buildPoliticalContextPrompt({
      topic: "Seguranca publica",
      fieldIntelligence: "Posts analisados: 120",
    });

    expect(prompt.user).toContain("Dados de campo verificados");
    expect(prompt.user).toContain("Posts analisados: 120");
  });
});
