import { after, NextResponse } from "next/server";

import { apiRoute } from "@/lib/auth/api-route";
import { generateContentVariants } from "@/lib/llm";
import { assertMandatorySetup } from "@/lib/product-setup-checklist";
import { contentRequestInputSchema } from "@/lib/schemas";
import {
  isJudgeEvaluationEnabled,
  runGeneratedContentEvaluation,
} from "@/lib/generation-eval";

export async function POST(request: Request) {
  return apiRoute(async (repository) => {
    const dashboard = await repository.getDashboard();

    if (!dashboard.profile) {
      return NextResponse.json(
        { message: "Crie e salve um perfil antes de gerar conteúdo." },
        { status: 400 },
      );
    }

    const setup = assertMandatorySetup(dashboard.profile);
    if (!setup.ok) {
      return NextResponse.json({ message: setup.message }, { status: 403 });
    }

    const profile = dashboard.profile;
    const payload = contentRequestInputSchema.parse(await request.json());
    const contentRequest = await repository.createContentRequest(payload);
    const generation = await generateContentVariants(profile, payload);
    const generatedContents = await repository.createGeneratedContents(
      contentRequest.id,
      generation.variants,
    );

    if (isJudgeEvaluationEnabled() && !generation.usedFallback) {
      after(async () => {
        try {
          await runGeneratedContentEvaluation({
            profile,
            request: payload,
            contentRequest,
            generation,
            generatedContents,
            mode: "judge",
          });
        } catch {
          // A avaliação do core não pode impactar a resposta principal do usuário.
        }
      });
    }

    return NextResponse.json({
      request: contentRequest,
      generatedContents,
    });
  });
}
