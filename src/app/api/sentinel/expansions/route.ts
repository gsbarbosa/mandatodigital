import { NextResponse } from "next/server";

import { apiRoute } from "@/lib/auth/api-route";
import { groupExpansionsBySphere, loadSentinelThemeExpansionsForProfile } from "@/lib/sentinel-theme-expansion";

export async function GET() {
  return apiRoute(async (repository) => {
    const dashboard = await repository.getDashboard();

    if (!dashboard.profile?.id) {
      return NextResponse.json({
        expansions: [],
        bySphere: { federal: [], estadual: [], opposition: [] },
      });
    }

    const expansions = await loadSentinelThemeExpansionsForProfile(dashboard.profile);
    const bySphere = groupExpansionsBySphere(expansions, dashboard.profile);

    return NextResponse.json({ expansions, bySphere });
  });
}
