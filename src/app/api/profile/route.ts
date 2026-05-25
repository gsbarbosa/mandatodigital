import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api";
import { profileInputSchema } from "@/lib/schemas";
import { getRepository } from "@/lib/storage";

export async function GET() {
  try {
    const dashboard = await getRepository().getDashboard();
    return NextResponse.json({ profile: dashboard.profile });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const payload = profileInputSchema.parse(await request.json());
    const profile = await getRepository().saveProfile(payload);

    return NextResponse.json({ profile });
  } catch (error) {
    return handleRouteError(error);
  }
}
