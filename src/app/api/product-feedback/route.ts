import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api";
import { apiRoute } from "@/lib/auth/api-route";
import { analyzeProductFeedback } from "@/lib/product-feedback-analyzer";
import { productFeedbackInputSchema } from "@/lib/schemas";

export async function GET() {
  return apiRoute(async (repository) => {
    const dashboard = await repository.getDashboard();
    return NextResponse.json({ productFeedbacks: dashboard.productFeedbacks });
  });
}

export async function POST(request: Request) {
  try {
    return apiRoute(async (repository) => {
      const payload = productFeedbackInputSchema.parse(await request.json());
      const analysis = await analyzeProductFeedback(payload);
      const feedback = await repository.createProductFeedback(payload, analysis);

      return NextResponse.json({ feedback }, { status: 201 });
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
