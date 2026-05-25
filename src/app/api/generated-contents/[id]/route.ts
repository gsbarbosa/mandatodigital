import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api";
import { generatedContentUpdateSchema } from "@/lib/schemas";
import { getRepository } from "@/lib/storage";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const payload = generatedContentUpdateSchema.parse(await request.json());
    const { id } = await context.params;
    const generatedContent = await getRepository().updateGeneratedContent(
      id,
      payload,
    );

    return NextResponse.json({ generatedContent });
  } catch (error) {
    return handleRouteError(error);
  }
}
