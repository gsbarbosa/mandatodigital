import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api";
import { analyzeProductFeedback } from "@/lib/product-feedback-analyzer";
import { productFeedbackInputSchema } from "@/lib/schemas";
import { getRepository } from "@/lib/storage";

export async function GET() {
  try {
    const dashboard = await getRepository().getDashboard();
    return NextResponse.json({ productFeedbacks: dashboard.productFeedbacks });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = productFeedbackInputSchema.parse(await request.json());
    const analysis = await analyzeProductFeedback(payload);
    const feedback = await getRepository().createProductFeedback(
      payload,
      analysis,
    );

    return NextResponse.json({ feedback }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
