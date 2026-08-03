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
import { appLog, appLogError, startTimer } from "@/lib/observability/log";
import {
  checkDistributedRateLimit,
  releaseDistributedRateLimit,
  SENTINEL_PLATFORM_REFRESH_MAX_PER_DAY,
  SENTINEL_PLATFORM_REFRESH_WINDOW_MS,
  sentinelPlatformRateLimitKey,
} from "@/lib/rate-limit-firestore";

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
    const routeElapsed = startTimer();
    let reason: RefreshReason = "manual";
    try {
      const body = await request.json();
      reason = parseReason(body);
    } catch {
      reason = "manual";
    }

    const dashboard = await repository.getDashboard();

    if (!dashboard.profile) {
      appLog(
        "sentinel",
        "refresh_rejected",
        { reason, cause: "missing_profile" },
        "warn",
      );
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

    appLog("sentinel", "refresh_started", {
      profileId,
      reason,
      premium,
    });

    const cached = profileId !== "default" ? await sentinelStorage.readCache(profileId) : null;
    const lastRefreshWasSourceFailure = isGuestSentinelRefreshSourceFailure(cached?.meta);

    if (reason === "daily") {
      if (!needsDailySentinelRefresh(cached?.meta?.refreshedAt ?? cached?.refreshedAt)) {
        const credits = premium ? null : await getGuestSentinelCredits(ownerUserId);
        appLog("sentinel", "refresh_skipped", {
          profileId,
          reason: "daily_already_fresh",
          cachedCount: cached?.suggestions?.length ?? 0,
          durationMs: routeElapsed(),
        });
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
      appLog(
        "sentinel",
        "refresh_rejected",
        { profileId, reason, cause: "credits_exhausted" },
        "warn",
      );
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

    const platformRateKey = sentinelPlatformRateLimitKey(ownerUserId);
    const platformLimit = await checkDistributedRateLimit({
      key: platformRateKey,
      max: SENTINEL_PLATFORM_REFRESH_MAX_PER_DAY,
      windowMs: SENTINEL_PLATFORM_REFRESH_WINDOW_MS,
      consume: true,
    });
    if (!platformLimit.allowed) {
      appLog(
        "sentinel",
        "refresh_rejected",
        {
          profileId,
          reason,
          cause: "platform_rate_limit",
          retryAfterMs: platformLimit.retryAfterMs ?? null,
        },
        "warn",
      );
      const retryCredits = premium ? null : await getGuestSentinelCredits(ownerUserId);
      return NextResponse.json(
        {
          message: `Limite diário de atualizações do Sentinela atingido (${SENTINEL_PLATFORM_REFRESH_MAX_PER_DAY}/dia). Tente novamente mais tarde.`,
          suggestions: cached?.suggestions ?? [],
          meta: cached?.meta ?? null,
          credits: retryCredits,
          rateLimited: true,
        },
        {
          status: 429,
          headers: platformLimit.retryAfterMs
            ? { "Retry-After": String(Math.ceil(platformLimit.retryAfterMs / 1000)) }
            : undefined,
        },
      );
    }

    invalidateSentinelMemoryCache(profileId);

    let result;
    try {
      result = await getSentinelSuggestions(dashboard.profile, {
        forceRefresh: true,
        qualityRankEnabled: premium,
      });
    } catch (error) {
      await releaseDistributedRateLimit({ key: platformRateKey });
      appLogError("sentinel", "refresh_failed", error, {
        profileId,
        reason,
        durationMs: routeElapsed(),
      });
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

    appLog("sentinel", "refresh_completed", {
      profileId,
      reason,
      suggestionCount: result.suggestions.length,
      sourceFailed,
      articlesScanned: result.meta?.articlesScanned ?? null,
      portalsMonitored: result.meta?.portalsMonitored ?? null,
      qualityKept: result.meta?.qualityRankStats?.kept ?? null,
      qualityDropped: result.meta?.qualityRankStats?.dropped ?? null,
      durationMs: routeElapsed(),
    });

    return NextResponse.json({
      ...result,
      reason,
      credits,
      sourceFailed,
    });
  });
}
