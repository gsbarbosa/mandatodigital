import { NextResponse } from "next/server";

import { recordAuditEventFireAndForget } from "@/lib/audit/record";
import { apiRoute } from "@/lib/auth/api-route";
import { getSessionUser } from "@/lib/auth/session";
import { isPremiumAccountMode } from "@/lib/dev-account-mode.server";
import { getGuestSentinelCredits } from "@/lib/guest-credits-storage";
import { getSentinelSuggestions } from "@/lib/sentinel-suggestions";
import { getStorageOwnerUserId } from "@/lib/storage-context";

export async function GET(request: Request) {
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

    const result = await getSentinelSuggestions(dashboard.profile);
    const sessionUser = await getSessionUser();
    const premium = await isPremiumAccountMode(sessionUser?.email);
    const credits = premium
      ? null
      : await getGuestSentinelCredits(getStorageOwnerUserId()?.trim() || "anonymous");

    recordAuditEventFireAndForget({
      request,
      action: "monitoring_view",
      profileId: dashboard.profile.id ?? null,
      payload: { suggestionCount: result.suggestions.length },
    });

    return NextResponse.json({
      ...result,
      credits,
    });
  });
}
