import { NextResponse } from "next/server";

import { apiRoute } from "@/lib/auth/api-route";
import { loadSentinelThemeExpansions } from "@/lib/sentinel-theme-expansion";

export async function GET() {
  return apiRoute(async (repository) => {
    const dashboard = await repository.getDashboard();

    if (!dashboard.profile?.id) {
      return NextResponse.json({ expansions: [] });
    }

    const expansions = await loadSentinelThemeExpansions(dashboard.profile.id);
    return NextResponse.json({ expansions });
  });
}
