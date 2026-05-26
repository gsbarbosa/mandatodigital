import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api";
import { generateContentVariants } from "@/lib/llm";
import { evaluationShadowRequestSchema } from "@/lib/schemas";
import { runShadowEvaluation } from "@/lib/shadow-eval";
import { getRepository } from "@/lib/storage";

export async function POST(request: Request) {
  try {
    const payload = evaluationShadowRequestSchema.parse(await request.json());
    const repository = getRepository();
    const dashboard = await repository.getDashboard();

    if (!dashboard.profile) {
      return NextResponse.json(
        { message: "Crie e salve um perfil antes de rodar a avaliacao shadow." },
        { status: 400 },
      );
    }

    const contentRequest = await repository.getContentRequestById(
      payload.contentRequestId,
    );

    if (!contentRequest) {
      return NextResponse.json(
        { message: "Pedido editorial nao encontrado para avaliacao." },
        { status: 404 },
      );
    }

    const [primaryResult, primaryGeneratedContents] = await Promise.all([
      generateContentVariants(dashboard.profile, contentRequest, {
        execution: {
          strict: true,
        },
        allowFallback: false,
      }),
      repository.getGeneratedContentsByRequestId(contentRequest.id),
    ]);

    const report = await runShadowEvaluation({
      profile: dashboard.profile,
      request: contentRequest,
      contentRequest,
      primaryResult,
      primaryGeneratedContents,
      shadow: {
        provider: payload.shadowProvider,
        model: payload.shadowModel,
        strict: true,
      },
      judge: {
        provider: payload.judgeProvider,
        model: payload.judgeModel,
        strict: true,
      },
      mode: "manual",
    });

    return NextResponse.json({ report }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
