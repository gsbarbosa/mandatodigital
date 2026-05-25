import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api";
import { contentRequestInputSchema } from "@/lib/schemas";
import { getRepository } from "@/lib/storage";

export async function GET() {
  try {
    const dashboard = await getRepository().getDashboard();
    return NextResponse.json({ contentRequests: dashboard.contentRequests });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = contentRequestInputSchema.parse(await request.json());
    const contentRequest = await getRepository().createContentRequest(payload);

    return NextResponse.json({ contentRequest }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
