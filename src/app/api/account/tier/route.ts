import { NextResponse } from "next/server";

import { apiRoute } from "@/lib/auth/api-route";
import { resolveSessionAccountTier } from "@/lib/account-tier.server";
import { getSessionUser } from "@/lib/auth/session";

export async function GET() {
  return apiRoute(async () => {
    const session = await getSessionUser();
    if (!session?.id) {
      return NextResponse.json({ message: "Nao autenticado." }, { status: 401 });
    }
    const resolved = await resolveSessionAccountTier(session.email);
    return NextResponse.json({
      tier: resolved.tier,
      entitlements: resolved.entitlements,
      source: resolved.source,
      billingStatus: resolved.billingStatus,
      planId: resolved.planId,
    });
  });
}
