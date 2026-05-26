import { after, NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api";
import { generateContentVariants } from "@/lib/llm";
import { contentRequestInputSchema } from "@/lib/schemas";
import {
  isJudgeEvaluationEnabled,
  runGeneratedContentEvaluation,
} from "@/lib/generation-eval";
import { getRepository } from "@/lib/storage";

export async function POST(request: Request) {
  try {
    const repository = getRepository();
    const dashboard = await repository.getDashboard();

    if (!dashboard.profile) {
      return NextResponse.json(
        { message: "Crie e salve um perfil antes de gerar conteudo." },
        { status: 400 },
      );
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
          // A avaliacao do core nao pode impactar a resposta principal do usuario.
        }
      });
    }

    return NextResponse.json({
      request: contentRequest,
      generatedContents,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
