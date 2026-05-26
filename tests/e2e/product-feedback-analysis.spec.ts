import { expect, test } from "@playwright/test";

test.describe("analise de feedback do produto", () => {
  test("classifica bug com criticidade alta", async ({ request }) => {
    const response = await request.post("/api/product-feedback", {
      data: {
        screen: "onboarding",
        workedWell: "a estrutura da tela ficou clara",
        issueObserved:
          "[AUTOTEST] ao clicar em salvar onboarding o botao trava e os dados nao salvam",
      },
      timeout: 90_000,
    });

    expect(response.status()).toBe(201);

    const payload = (await response.json()) as {
      feedback: {
        classification: string;
        criticality: string;
        implementationPrompt: string;
      };
    };

    expect(payload.feedback.classification).toBe("bug");
    expect(payload.feedback.criticality).toBe("alta");
    expect(payload.feedback.implementationPrompt.length).toBeGreaterThan(12);
  });

  test("classifica melhoria com criticidade media", async ({ request }) => {
    const response = await request.post("/api/product-feedback", {
      data: {
        screen: "feedback lateral",
        workedWell: "a classificacao final apareceu corretamente",
        issueObserved:
          "[AUTOTEST] o fluxo funciona, mas faltou indicar progresso mais claro enquanto a IA analisa o feedback",
      },
      timeout: 90_000,
    });

    expect(response.status()).toBe(201);

    const payload = (await response.json()) as {
      feedback: {
        classification: string;
        criticality: string;
        implementationPrompt: string;
      };
    };

    expect(payload.feedback.classification).toBe("melhoria");
    expect(payload.feedback.criticality).toBe("media");
    expect(payload.feedback.implementationPrompt.length).toBeGreaterThan(12);
  });

  test("classifica demanda fora do escopo atual com criticidade baixa", async ({
    request,
  }) => {
    const response = await request.post("/api/product-feedback", {
      data: {
        screen: "monitoramento",
        workedWell: "o MVP atual gera conteudo manualmente",
        issueObserved:
          "[AUTOTEST] quero que o sistema puxe automaticamente assuntos via Apify e publique sozinho nas redes",
      },
      timeout: 90_000,
    });

    expect(response.status()).toBe(201);

    const payload = (await response.json()) as {
      feedback: {
        classification: string;
        criticality: string;
        implementationPrompt: string;
      };
    };

    expect(payload.feedback.classification).toBe("fora_do_escopo_atual");
    expect(payload.feedback.criticality).toBe("baixa");
    expect(payload.feedback.implementationPrompt.length).toBeGreaterThan(12);
  });
});
