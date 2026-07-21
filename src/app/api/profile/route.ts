import { NextResponse } from "next/server";

import { apiRoute } from "@/lib/auth/api-route";
import { handleRouteError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth/session";
import { isPremiumAccountMode } from "@/lib/dev-account-mode.server";
import {
  getGuestSentinelCredits,
  tryConsumeGuestSentinelCredit,
} from "@/lib/guest-credits-storage";
import {
  guestSentinelCreditsExhaustedMessage,
  isGuestSentinelRefreshSourceFailure,
} from "@/lib/guest-limits";
import { mergeProfileInputForSave } from "@/lib/profile-save";
import { profileInputSchema } from "@/lib/schemas";
import {
  buildRadarThemesSignature,
  getSentinelSuggestions,
  invalidateSentinelCacheAsync,
} from "@/lib/sentinel-suggestions";
import { syncSentinelThemeExpansions } from "@/lib/sentinel-theme-expansion";
import { getStorageOwnerUserId } from "@/lib/storage-context";

export type SentinelRefreshPolicy = "onboarding" | "themes" | "skip";

function parseRefreshPolicy(value: unknown): SentinelRefreshPolicy {
  if (value === "onboarding" || value === "skip" || value === "themes") {
    return value;
  }
  return "themes";
}

export async function GET() {
  return apiRoute(async (repository) => {
    const dashboard = await repository.getDashboard();
    return NextResponse.json({ profile: dashboard.profile });
  });
}

export async function PUT(request: Request) {
  try {
    return apiRoute(async (repository) => {
      const body = (await request.json()) as Record<string, unknown> & {
        draftSave?: boolean;
        sentinelRefreshPolicy?: unknown;
      };
      const draftSave = body.draftSave === true;
      const refreshPolicy = parseRefreshPolicy(body.sentinelRefreshPolicy);
      delete body.draftSave;
      delete body.sentinelRefreshPolicy;

      const dashboard = await repository.getDashboard();
      const previousSignature = dashboard.profile
        ? buildRadarThemesSignature(dashboard.profile)
        : "";
      const merged = draftSave
        ? mergeProfileInputForSave(
            body as Parameters<typeof mergeProfileInputForSave>[0],
            dashboard.profile,
            { allowDraftDefaults: true },
          )
        : (body as Parameters<typeof mergeProfileInputForSave>[0]);

      const payload = profileInputSchema.parse(merged);
      const profile = await repository.saveProfile(payload);
      const radarChanged =
        Boolean(profile.id) && buildRadarThemesSignature(profile) !== previousSignature;

      const sessionUser = await getSessionUser();
      const premium = await isPremiumAccountMode(sessionUser?.email);
      const ownerUserId = getStorageOwnerUserId()?.trim() || "anonymous";

      let sentinelRefreshSkipped = false;
      let sentinelRefreshMessage: string | null = null;
      let credits = premium ? null : await getGuestSentinelCredits(ownerUserId);

      if (radarChanged && profile.id && refreshPolicy !== "skip") {
        const consumeOnSuccess = !premium && refreshPolicy === "themes";

        if (consumeOnSuccess && credits && credits.remaining <= 0) {
          sentinelRefreshSkipped = true;
          sentinelRefreshMessage = guestSentinelCreditsExhaustedMessage();
          // Invalida cache de assinatura antiga para o GET não servir pautas órfãs,
          // mas não dispara coleta nova.
          await invalidateSentinelCacheAsync(profile.id);
        } else {
          await invalidateSentinelCacheAsync(profile.id);
          void (async () => {
            await syncSentinelThemeExpansions(profile);
            await invalidateSentinelCacheAsync(profile.id);
            const result = await getSentinelSuggestions(profile, { forceRefresh: true });
            const sourceFailed = isGuestSentinelRefreshSourceFailure(result.meta);
            if (consumeOnSuccess && !sourceFailed) {
              await tryConsumeGuestSentinelCredit(ownerUserId);
            }
          })().catch(() => undefined);
        }
      }

      return NextResponse.json({
        profile,
        sentinelRefreshSkipped,
        sentinelRefreshMessage,
        credits,
      });
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
