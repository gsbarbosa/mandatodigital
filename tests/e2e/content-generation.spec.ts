import { expect, test } from "@playwright/test";

import {
  saveAutotestProfile,
} from "./helpers";

test.describe("geracao de conteudo com LLM", () => {
  test("salva onboarding e gera conteudo utilizavel para pauta realista", async ({
    request,
  }) => {
    const profileToken = await saveAutotestProfile(request);
    const topic = `[AUTOTEST] tema consultas especializadas ${Date.now()}`;

    const response = await request.post("/api/generate", {
      data: {
        topic,
        objective: "cobrar resposta da prefeitura com foco em solucao local",
        desiredCallToAction: "compartilhe este post e conte seu bairro",
        format: "Post Instagram",
        intensity: "Firme",
        context: `perfil de teste ${profileToken} focado em saude e fiscalizacao`,
        keyFacts: [
          "moradores relataram remarcacoes",
          "postos com alta demanda",
        ],
      },
      timeout: 90_000,
    });

    expect(response.status()).toBe(200);

    const payload = (await response.json()) as {
      request: { topic: string };
      generatedContents: Array<{
        title: string;
        angle: string;
        body: string;
        promptPreview: string;
      }>;
    };

    expect(payload.request.topic).toContain(topic);
    expect(payload.generatedContents).toHaveLength(3);

    for (const item of payload.generatedContents) {
      const normalized = item.body.toLowerCase();

      expect(item.title.length).toBeGreaterThan(8);
      expect(item.angle.length).toBeGreaterThan(12);
      expect(item.promptPreview.length).toBeGreaterThan(20);
      expect(item.body.length).toBeGreaterThan(120);
      expect(normalized).not.toContain('"versions"');
      expect(normalized).not.toContain("[object object]");
      expect(normalized).not.toContain("nao informado");
    }

    expect(
      payload.generatedContents.some((item) =>
        ["saude", "consulta", "recife", "fila", "bairro"].some((term) =>
          item.body.toLowerCase().includes(term),
        ),
      ),
    ).toBe(true);
  });
});
