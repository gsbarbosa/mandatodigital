import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api";
import { generateContentVariants } from "@/lib/llm";
import { contentRequestInputSchema } from "@/lib/schemas";
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

    const payload = contentRequestInputSchema.parse(await request.json());
    const contentRequest = await repository.createContentRequest(payload);
    const variants = await generateContentVariants(dashboard.profile, payload);
    const generatedContents = await repository.createGeneratedContents(
      contentRequest.id,
      variants,
    );

    return NextResponse.json({
      request: contentRequest,
      generatedContents,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
