import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api";
import { feedbackInputSchema } from "@/lib/schemas";
import { getRepository } from "@/lib/storage";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const payload = feedbackInputSchema.parse(await request.json());
    const { id } = await context.params;
    const feedback = await getRepository().addFeedback(id, payload);

    return NextResponse.json({ feedback }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
