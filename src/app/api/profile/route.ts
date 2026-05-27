import { NextResponse } from "next/server";

import { apiRoute } from "@/lib/auth/api-route";
import { profileInputSchema } from "@/lib/schemas";

export async function GET() {
  return apiRoute(async (repository) => {
    const dashboard = await repository.getDashboard();
    return NextResponse.json({ profile: dashboard.profile });
  });
}

export async function PUT(request: Request) {
  return apiRoute(async (repository) => {
    const payload = profileInputSchema.parse(await request.json());
    const profile = await repository.saveProfile(payload);

    return NextResponse.json({ profile });
  });
}
