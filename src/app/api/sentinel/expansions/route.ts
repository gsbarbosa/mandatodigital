import { NextResponse } from "next/server";

import { apiRoute } from "@/lib/auth/api-route";
import { loadSentinelThemeExpansionsForProfile } from "@/lib/sentinel-theme-expansion";

export async function GET() {
  return apiRoute(async (repository) => {
    const dashboard = await repository.getDashboard();

    if (!dashboard.profile?.id) {
      return NextResponse.json({ expansions: [] });
    }

    const expansions = await loadSentinelThemeExpansionsForProfile(dashboard.profile);
    return NextResponse.json({ expansions });
  });
}
