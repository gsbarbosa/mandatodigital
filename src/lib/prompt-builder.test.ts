import { describe, expect, it } from "vitest";

import { buildFallbackVariants } from "@/lib/fallback-generator";
import {
  GENERATION_PROMPT_TEMPLATE_ID,
  GENERATION_PROMPT_VERSION,
  buildGenerationPrompt,
} from "@/lib/prompt-builder";
import type { ContentRequestInput } from "@/lib/schemas";
import type { PoliticianProfile } from "@/lib/types";

const profile: PoliticianProfile = {
  id: "profile-1",
  fullName: "Maria Souza",
  role: "Vereadora",
  city: "Recife",
  state: "PE",
  audience: "familias de bairro e pequenos empreendedores",
  spectrum: "Centro-Direita",
  archetype: "Fiscal",
  voiceTones: ["Didatico", "Popular"],
  keyIssues: ["Saude publica", "Emprego e renda"],
  slogans: ["Gente em primeiro lugar"],
  redLines: ["não inventar dado", "não atacar servidor publico"],
  referenceExamples: ["fala curta, direta e com exemplos locais"],
  bio: "Atua com fiscalizacao, defesa de entregas concretas e linguagem acessivel.",
  updatedAt: "2026-05-25T00:00:00.000Z",
};

const request: ContentRequestInput = {
  topic: "alagamentos recorrentes após chuva forte no centro",
  objective: "cobrar resposta da prefeitura sem perder foco em solucao",
  format: "Post Instagram",
  intensity: "Firme",
  context: "os moradores relataram perda de moveis e transito travado",
  keyFacts: ["dois bairros ficaram ilhados", "comerciantes perderam estoque"],
  desiredCallToAction: "mande este post para quem esta cobrando providencias",
};

describe("buildGenerationPrompt", () => {
  it("inclui a persona e o pedido editorial no preview", () => {
    const prompt = buildGenerationPrompt(profile, request);

    expect(prompt.preview).toContain("Maria Souza");
    expect(prompt.preview).toContain("alagamentos recorrentes");
    expect(prompt.user).toContain("Pautas prioritarias");
    expect(prompt.system).toContain("Gere exatamente 3 versões");
    expect(prompt.templateId).toBe(GENERATION_PROMPT_TEMPLATE_ID);
    expect(prompt.promptVersion).toBe(GENERATION_PROMPT_VERSION);
    expect(prompt.fingerprint.length).toBe(64);
  });
});

describe("buildFallbackVariants", () => {
  it("gera tres versoes prontas para revisao humana", () => {
    const variants = buildFallbackVariants(profile, request, "preview");

    expect(variants).toHaveLength(3);
    expect(variants[0].body).toContain("alagamentos recorrentes");
    expect(variants[1].provider).toBe("fallback-local");
    expect(variants[2].title).toContain("Versao 3");
  });
});
