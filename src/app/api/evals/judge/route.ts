import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api";
import { runStoredContentEvaluation } from "@/lib/generation-eval";
import { evaluationJudgeRequestSchema } from "@/lib/schemas";
import { getRepository } from "@/lib/storage";

export async function POST(request: Request) {
  try {
    const payload = evaluationJudgeRequestSchema.parse(await request.json());
    const repository = getRepository();
    const dashboard = await repository.getDashboard();

    if (!dashboard.profile) {
      return NextResponse.json(
        { message: "Crie e salve um perfil antes de avaliar a geração." },
        { status: 400 },
      );
    }

    const contentRequest = await repository.getContentRequestById(
      payload.contentRequestId,
    );

    if (!contentRequest) {
      return NextResponse.json(
        { message: "Pedido editorial não encontrado para avaliação." },
        { status: 404 },
      );
    }

    const generatedContents = await repository.getGeneratedContentsByRequestId(
      contentRequest.id,
    );

    if (!generatedContents.length) {
      return NextResponse.json(
        { message: "Nenhum conteúdo gerado foi encontrado para esse briefing." },
        { status: 404 },
      );
    }

    const report = await runStoredContentEvaluation({
      profile: dashboard.profile,
      contentRequest,
      generatedContents,
      judge: {
        provider: payload.judgeProvider,
        model: payload.judgeModel,
        strict: true,
      },
    });

    return NextResponse.json({ report }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
