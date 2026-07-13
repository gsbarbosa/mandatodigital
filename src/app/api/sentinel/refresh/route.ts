import { NextResponse } from "next/server";

import { factCheckTopSentinelSuggestions } from "@/lib/auditor-storage";
import { apiRoute } from "@/lib/auth/api-route";
import { getSessionUser } from "@/lib/auth/session";
import { isPremiumAccountMode } from "@/lib/dev-account-mode.server";
import {
  GUEST_SENTINEL_REFRESH_PER_DAY,
  guestSentinelRefreshCooldownRemainingMs,
  isGuestSentinelRefreshSourceFailure,
} from "@/lib/guest-limits";
import { checkRateLimit } from "@/lib/rate-limit";
import { getStorageOwnerUserId } from "@/lib/storage-context";
import { sentinelStorage } from "@/lib/sentinel-storage";
import {
  getSentinelSuggestions,
  invalidateSentinelMemoryCache,
} from "@/lib/sentinel-suggestions";

export const maxDuration = 300;

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

    const profileId = dashboard.profile.id || "default";
    const ownerUserId = getStorageOwnerUserId()?.trim() || "anonymous";
    const sessionUser = await getSessionUser();
    const premium = await isPremiumAccountMode(sessionUser?.email);
    const rateKey = `sentinel-refresh:${ownerUserId}`;

    const cached =
      !premium && profileId !== "default" ? await sentinelStorage.readCache(profileId) : null;
    const lastRefreshWasSourceFailure = isGuestSentinelRefreshSourceFailure(cached?.meta);

    // Limite persistente (cache): 1 atualização / 24h na versão para convidados.
    // Falha de fonte (RSS zerado) não consome a cota — libera retry imediato.
    if (!premium && profileId !== "default" && !lastRefreshWasSourceFailure) {
      const cooldownMs = guestSentinelRefreshCooldownRemainingMs(
        cached?.meta?.refreshedAt,
        Date.now(),
        REFRESH_WINDOW_MS,
        cached?.meta,
      );
      if (cooldownMs > 0) {
        return NextResponse.json(
          {
            message:
              "Na versão para convidados, as pautas podem ser atualizadas apenas 1 vez por dia. Tente novamente amanhã.",
            retryAfterMs: cooldownMs,
          },
          {
            status: 429,
            headers: {
              "Retry-After": String(Math.ceil(cooldownMs / 1000)),
            },
          },
        );
      }
    }

    // Peek da cota em memória — só consome depois de refresh bem-sucedido.
    if (!premium && !lastRefreshWasSourceFailure) {
      const rate = checkRateLimit({
        key: rateKey,
        max: GUEST_SENTINEL_REFRESH_PER_DAY,
        windowMs: REFRESH_WINDOW_MS,
        consume: false,
      });

      if (!rate.allowed) {
        return NextResponse.json(
          {
            message:
              "Na versão para convidados, as pautas podem ser atualizadas apenas 1 vez por dia. Tente novamente amanhã.",
          },
          {
            status: 429,
            headers: {
              "Retry-After": String(Math.ceil((rate.retryAfterMs ?? 60_000) / 1000)),
            },
          },
        );
      }
    }

    // Não apaga cache persistido antes da coleta — se falhar, o convidado mantém o último resultado.
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
    if (!premium && !sourceFailed) {
      checkRateLimit({
        key: rateKey,
        max: GUEST_SENTINEL_REFRESH_PER_DAY,
        windowMs: REFRESH_WINDOW_MS,
        consume: true,
      });
    }

    if (dashboard.profile.id) {
      void factCheckTopSentinelSuggestions({
        profileId: dashboard.profile.id,
        suggestions: result.suggestions,
      });
    }

    return NextResponse.json(result);
  });
}
