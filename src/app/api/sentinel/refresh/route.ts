import { NextResponse } from "next/server";

import { apiRoute } from "@/lib/auth/api-route";
import {
  getSentinelSuggestions,
  invalidateSentinelCache,
} from "@/lib/sentinel-suggestions";

export async function POST() {
  return apiRoute(async (repository) => {
    const dashboard = await repository.getDashboard();

    if (!dashboard.profile) {
      return NextResponse.json(
        {
          message: "Crie e salve um perfil antes de atualizar o radar do Sentinela.",
          suggestions: [],
        },
        { status: 400 },
      );
    }

    invalidateSentinelCache(dashboard.profile.id || "default");
    const result = await getSentinelSuggestions(dashboard.profile, { forceRefresh: true });

    return NextResponse.json(result);
  });
}
