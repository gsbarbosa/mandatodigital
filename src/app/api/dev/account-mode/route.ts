import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { apiRoute } from "@/lib/auth/api-route";
import { getSessionUser } from "@/lib/auth/session";
import { ACCOUNT_TIER_LABELS } from "@/lib/account-tier";
import { resolveSessionAccountTier } from "@/lib/account-tier.server";
import {
  DEV_ACCOUNT_MODE_COOKIE,
  accountTierFromDevMode,
  isDevAccountModeEmail,
  isForcePremiumAccountEmail,
  parseDevAccountMode,
  type DevAccountMode,
} from "@/lib/dev-account-mode";
import { resolveDevAccountMode } from "@/lib/dev-account-mode.server";

function modeCookieOptions(maxAge: number) {
  return {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function GET() {
  return apiRoute(async () => {
    const user = await getSessionUser();
    if (!user || !isDevAccountModeEmail(user.email)) {
      return NextResponse.json({ allowed: false, mode: "guest" as DevAccountMode });
    }

    const mode = await resolveDevAccountMode(user.email);
    const resolved = await resolveSessionAccountTier(user.email);
    return NextResponse.json({
      allowed: true,
      mode,
      tier: resolved.tier,
      entitlements: resolved.entitlements,
      email: user.email,
      forcedPremium: isForcePremiumAccountEmail(user.email),
    });
  });
}

export async function PUT(request: Request) {
  return apiRoute(async () => {
    const user = await getSessionUser();
    if (!user || !isDevAccountModeEmail(user.email)) {
      return NextResponse.json(
        { message: "Esta conta não pode alternar o modo." },
        { status: 403 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as { mode?: string };
    const mode = parseDevAccountMode(body.mode);
    const cookieStore = await cookies();
    cookieStore.set(DEV_ACCOUNT_MODE_COOKIE, mode, modeCookieOptions(60 * 60 * 24 * 365));

    const tier = accountTierFromDevMode(mode);
    return NextResponse.json({
      allowed: true,
      mode,
      tier,
      email: user.email,
      forcedPremium: false,
      message: `Modo ${ACCOUNT_TIER_LABELS[tier]} ativo.`,
    });
  });
}
