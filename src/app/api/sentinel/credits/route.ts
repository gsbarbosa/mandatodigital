import { NextResponse } from "next/server";

import { apiRoute } from "@/lib/auth/api-route";
import { getSessionUser } from "@/lib/auth/session";
import { isPremiumAccountMode } from "@/lib/dev-account-mode.server";
import { getGuestSentinelCredits } from "@/lib/guest-credits-storage";
import { getStorageOwnerUserId } from "@/lib/storage-context";

/**
 * Créditos do convidado, sem depender de perfil salvo — usado pelo gate de
 * free trial na sidebar (lock quando `remaining === 0`).
 */
export async function GET() {
  return apiRoute(async () => {
    const sessionUser = await getSessionUser();
    const premium = await isPremiumAccountMode(sessionUser?.email);
    const credits = premium
      ? null
      : await getGuestSentinelCredits(getStorageOwnerUserId()?.trim() || "anonymous");

    return NextResponse.json({ credits });
  });
}
