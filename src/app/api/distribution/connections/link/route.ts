import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { apiRoute } from "@/lib/auth/api-route";
import { getSessionUser } from "@/lib/auth/session";
import { socialConnectionStorage } from "@/lib/distribution/connection-storage";
import { assertDistributionReady } from "@/lib/distribution/guard";
import { buildInstagramAuthorizeUrl } from "@/lib/distribution/instagram-graph-client";
import {
  instagramRedirectUriFromRequest,
  isInstagramOAuthConfigured,
} from "@/lib/distribution/instagram-env";
import {
  createInstagramOAuthState,
  INSTAGRAM_OAUTH_COOKIE,
} from "@/lib/distribution/instagram-oauth-state";
import { toDatabaseOwnerUserId } from "@/lib/owner-user-id";

const linkSchema = z.object({
  channels: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
  return apiRoute(async (repository) => {
    const blocked = assertDistributionReady();
    if (blocked) {
      return blocked;
    }

    if (!isInstagramOAuthConfigured()) {
      return NextResponse.json(
        {
          message:
            "OAuth Instagram nao configurado. Defina INSTAGRAM_APP_ID e INSTAGRAM_APP_SECRET.",
        },
        { status: 503 },
      );
    }

    const dashboard = await repository.getDashboard();
    const profile = dashboard.profile;
    if (!profile) {
      return NextResponse.json({ message: "Salve o perfil antes." }, { status: 400 });
    }

    const session = await getSessionUser();
    const ownerUserId = toDatabaseOwnerUserId(session!.id);
    linkSchema.parse(await request.json().catch(() => ({})));

    const existing = await socialConnectionStorage.getByProfileId(profile.id);
    if (!existing) {
      await socialConnectionStorage.upsert({
        profileId: profile.id,
        ownerUserId,
      });
    }

    const state = createInstagramOAuthState(profile.id, ownerUserId);
    const redirectUri = instagramRedirectUriFromRequest(request);
    const cookieStore = await cookies();
    cookieStore.set(INSTAGRAM_OAUTH_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60,
    });

    return NextResponse.json({
      url: buildInstagramAuthorizeUrl(state, redirectUri),
      expiresIn: 600,
    });
  });
}
