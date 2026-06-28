import { NextResponse } from "next/server";

import { factCheckTopSentinelSuggestions } from "@/lib/auditor-storage";
import { apiRoute } from "@/lib/auth/api-route";
import { getStorageOwnerUserId } from "@/lib/storage-context";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  getSentinelSuggestions,
  invalidateSentinelCache,
} from "@/lib/sentinel-suggestions";

const REFRESH_LIMIT = 30;
const REFRESH_WINDOW_MS = 24 * 60 * 60 * 1000;

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

    const ownerUserId = getStorageOwnerUserId()?.trim() || "anonymous";
    const rate = checkRateLimit({
      key: `sentinel-refresh:${ownerUserId}`,
      max: REFRESH_LIMIT,
      windowMs: REFRESH_WINDOW_MS,
    });

    if (!rate.allowed) {
      return NextResponse.json(
        {
          message: `Limite diario de atualizacoes do Sentinela atingido (${REFRESH_LIMIT}/dia).`,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((rate.retryAfterMs ?? 60_000) / 1000)),
          },
        },
      );
    }

    invalidateSentinelCache(dashboard.profile.id || "default");
    const result = await getSentinelSuggestions(dashboard.profile, { forceRefresh: true });

    if (dashboard.profile.id) {
      void factCheckTopSentinelSuggestions({
        profileId: dashboard.profile.id,
        suggestions: result.suggestions,
      });
    }

    return NextResponse.json(result);
  });
}
