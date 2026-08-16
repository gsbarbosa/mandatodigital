import { NextResponse } from "next/server";

import { apiRoute } from "@/lib/auth/api-route";
import { getSessionUser } from "@/lib/auth/session";
import { isPremiumAccountMode } from "@/lib/dev-account-mode.server";
import { getGuestSentinelCredits } from "@/lib/guest-credits-storage";
import { getGuestUsage } from "@/lib/guest-usage-storage";
import { getStorageOwnerUserId } from "@/lib/storage-context";

/**
 * Créditos do convidado e cota de vídeos do free trial — usado pelo gate
 * na sidebar e no Criativo (lock quando remaining/vídeos esgotam).
 */
export async function GET() {
  return apiRoute(async () => {
    const sessionUser = await getSessionUser();
    const premium = await isPremiumAccountMode(sessionUser?.email);
    const ownerUserId = getStorageOwnerUserId()?.trim() || "anonymous";
    const credits = premium ? null : await getGuestSentinelCredits(ownerUserId);
    const videoUsage = premium ? null : await getGuestUsage(ownerUserId);

    return NextResponse.json({ credits, videoUsage });
  });
}
