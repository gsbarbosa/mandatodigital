import { NextResponse } from "next/server";

import { factCheckTopSentinelSuggestions } from "@/lib/auditor-storage";
import { apiRoute } from "@/lib/auth/api-route";
import { getSessionUser } from "@/lib/auth/session";
import { isPremiumAccountMode } from "@/lib/dev-account-mode.server";
import {
  getGuestSentinelCredits,
  tryConsumeGuestSentinelCredit,
} from "@/lib/guest-credits-storage";
import {
  guestSentinelCreditsExhaustedMessage,
  isGuestSentinelRefreshSourceFailure,
  needsDailySentinelRefresh,
} from "@/lib/guest-limits";
import { getStorageOwnerUserId } from "@/lib/storage-context";
import { sentinelStorage } from "@/lib/sentinel-storage";
import {
  getSentinelSuggestions,
  invalidateSentinelMemoryCache,
} from "@/lib/sentinel-suggestions";

export const maxDuration = 300;

type RefreshReason = "daily" | "manual";

function parseReason(body: unknown): RefreshReason {
  if (body && typeof body === "object" && "reason" in body) {
    const reason = (body as { reason?: unknown }).reason;
    if (reason === "daily") {
      return "daily";
    }
  }
  return "manual";
}

export async function POST(request: Request) {
  return apiRoute(async (repository) => {
    let reason: RefreshReason = "manual";
    try {
      const body = await request.json();
      reason = parseReason(body);
    } catch {
      reason = "manual";
    }

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

    const profileId = dashboard.profile.id || "default";
    const ownerUserId = getStorageOwnerUserId()?.trim() || "anonymous";
    const sessionUser = await getSessionUser();
    const premium = await isPremiumAccountMode(sessionUser?.email);

    const cached = profileId !== "default" ? await sentinelStorage.readCache(profileId) : null;
    const lastRefreshWasSourceFailure = isGuestSentinelRefreshSourceFailure(cached?.meta);

    if (reason === "daily") {
      if (!needsDailySentinelRefresh(cached?.meta?.refreshedAt ?? cached?.refreshedAt)) {
        const credits = premium ? null : await getGuestSentinelCredits(ownerUserId);
        return NextResponse.json({
          suggestions: cached?.suggestions ?? [],
          meta: cached?.meta ?? null,
          skipped: true,
          reason: "daily",
          credits,
        });
      }
    }

    let credits = premium ? null : await getGuestSentinelCredits(ownerUserId);

    // Peek: bloqueia manual sem crédito (retry após falha de fonte é livre).
    if (
      !premium &&
      reason === "manual" &&
      !lastRefreshWasSourceFailure &&
      credits &&
      credits.remaining <= 0
    ) {
      return NextResponse.json(
        {
          message: guestSentinelCreditsExhaustedMessage(),
          suggestions: cached?.suggestions ?? [],
          meta: cached?.meta ?? null,
          credits,
        },
        { status: 429 },
      );
    }

    invalidateSentinelMemoryCache(profileId);

    let result;
    try {
      result = await getSentinelSuggestions(dashboard.profile, { forceRefresh: true });
    } catch (error) {
      console.error(
        "[sentinel-refresh] falha",
        profileId,
        error instanceof Error ? error.message : error,
      );
      throw error;
    }

    const sourceFailed = isGuestSentinelRefreshSourceFailure(result.meta);

    if (!premium && reason === "manual" && !sourceFailed && !lastRefreshWasSourceFailure) {
      const consumed = await tryConsumeGuestSentinelCredit(ownerUserId);
      credits = consumed.credits;
      if (!consumed.ok) {
        // Corrida rara: outro request esgotou no meio — ainda devolvemos o resultado.
        return NextResponse.json({
          ...result,
          reason,
          credits,
          sourceFailed,
          message: guestSentinelCreditsExhaustedMessage(),
        });
      }
    } else if (!premium) {
      credits = await getGuestSentinelCredits(ownerUserId);
    }

    if (dashboard.profile.id) {
      void factCheckTopSentinelSuggestions({
        profileId: dashboard.profile.id,
        suggestions: result.suggestions,
      });
    }

    return NextResponse.json({
      ...result,
      reason,
      credits,
      sourceFailed,
    });
  });
}
