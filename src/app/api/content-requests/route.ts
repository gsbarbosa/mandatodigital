import { NextResponse } from "next/server";

import { apiRoute } from "@/lib/auth/api-route";
import { contentRequestInputSchema } from "@/lib/schemas";

export async function GET() {
  return apiRoute(async (repository) => {
    const dashboard = await repository.getDashboard();
    return NextResponse.json({ contentRequests: dashboard.contentRequests });
  });
}

export async function POST(request: Request) {
  return apiRoute(async (repository) => {
    const payload = contentRequestInputSchema.parse(await request.json());
    const contentRequest = await repository.createContentRequest(payload);

    return NextResponse.json({ contentRequest }, { status: 201 });
  });
}
