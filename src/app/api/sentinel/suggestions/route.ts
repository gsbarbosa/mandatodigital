import { NextResponse } from "next/server";

import { apiRoute } from "@/lib/auth/api-route";
import { getSentinelSuggestions } from "@/lib/sentinel-suggestions";

export async function GET() {
  return apiRoute(async (repository) => {
    const dashboard = await repository.getDashboard();

    if (!dashboard.profile) {
      return NextResponse.json(
        {
          message: "Crie e salve um perfil antes de consultar o radar do Sentinela.",
          suggestions: [],
        },
        { status: 400 },
      );
    }

    const result = await getSentinelSuggestions(dashboard.profile, { cacheOnly: true });
    return NextResponse.json(result);
  });
}
