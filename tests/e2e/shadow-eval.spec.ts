import { expect, test } from "@playwright/test";

import { saveAutotestProfile } from "./helpers";

test.describe("avaliacao do core da LLM", () => {
  test("gera nota e relatorio para a geracao principal publicada", async ({
    request,
  }) => {
    test.setTimeout(180_000);

    await saveAutotestProfile(request);

    const generationResponse = await request.post("/api/generate", {
      data: {
        topic: `[AUTOTEST] comparacao shadow ${Date.now()}`,
        objective: "comparar se o modelo sombra produz resposta editorial melhor",
        desiredCallToAction: "compartilhe e conte o impacto no seu bairro",
        format: "Post Instagram",
        intensity: "Firme",
        context: "teste automatizado de shadow eval para o core da LLM",
        keyFacts: [
          "moradores pedem resposta mais clara",
          "a equipe quer distinguir qualidade entre candidatos",
        ],
      },
      timeout: 90_000,
    });

    expect(generationResponse.status()).toBe(200);

    const generationPayload = (await generationResponse.json()) as {
      request: {
        id: string;
      };
    };

    const judgeResponse = await request.post("/api/evals/judge", {
      data: {
        contentRequestId: generationPayload.request.id,
      },
      timeout: 120_000,
    });

    expect(judgeResponse.status()).toBe(201);

    const judgePayload = (await judgeResponse.json()) as {
      report: {
        run: {
          id: string;
          status: string;
          winnerRecommendation: string;
        };
        candidates: Array<{
          role: string;
          totalScore: number;
          scores: Array<{ criterion: string; score: number }>;
        }>;
        winner: {
          id: string;
        } | null;
      };
    };

    expect(judgePayload.report.run.status).toBe("completed");
    expect(judgePayload.report.run.winnerRecommendation.length).toBeGreaterThan(12);
    expect(judgePayload.report.candidates).toHaveLength(1);
    expect(judgePayload.report.candidates.every((item) => item.totalScore >= 0)).toBe(
      true,
    );
    expect(
      judgePayload.report.candidates.every((item) =>
        item.scores.some((score) => score.criterion === "overall"),
      ),
    ).toBe(true);
    expect(judgePayload.report.winner).not.toBeNull();
    expect(judgePayload.report.candidates[0]?.role).toBe("primary");

    const reportResponse = await request.get(
      `/api/evals/runs/${judgePayload.report.run.id}`,
      {
        timeout: 90_000,
      },
    );

    expect(reportResponse.status()).toBe(200);

    const reportPayload = (await reportResponse.json()) as {
      report: {
        run: { id: string };
      };
    };

    expect(reportPayload.report.run.id).toBe(judgePayload.report.run.id);
  });
});
