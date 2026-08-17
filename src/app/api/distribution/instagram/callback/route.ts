import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { encryptProviderSecret } from "@/lib/admin/provider-secrets";
import { getSessionUser } from "@/lib/auth/session";
import { socialConnectionStorage } from "@/lib/distribution/connection-storage";
import { instagramRedirectUriFromRequest } from "@/lib/distribution/instagram-env";
import {
  exchangeInstagramCode,
  exchangeInstagramLongLivedToken,
  fetchInstagramMe,
} from "@/lib/distribution/instagram-graph-client";
import {
  INSTAGRAM_OAUTH_COOKIE,
  parseInstagramOAuthState,
} from "@/lib/distribution/instagram-oauth-state";
import { runWithStorageOwner } from "@/lib/storage-context";
import { toDatabaseOwnerUserId } from "@/lib/owner-user-id";

function callbackRedirect(request: Request, query: Record<string, string>) {
  const callbackUri = instagramRedirectUriFromRequest(request);
  const origin = callbackUri.replace(/\/api\/distribution\/instagram\/callback$/, "");
  const target = new URL("/distribuidor", `${origin}/`);
  for (const [key, value] of Object.entries(query)) {
    target.searchParams.set(key, value);
  }
  return NextResponse.redirect(target);
}

function stripOAuthCode(raw: string) {
  return raw.replace(/#.*$/, "").trim();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");
  const code = stripOAuthCode(url.searchParams.get("code") ?? "");
  const state = url.searchParams.get("state") ?? "";

  const cookieStore = await cookies();
  const cookieState = cookieStore.get(INSTAGRAM_OAUTH_COOKIE)?.value ?? "";
  cookieStore.set(INSTAGRAM_OAUTH_COOKIE, "", {
    maxAge: 0,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  if (error) {
    return callbackRedirect(request, {
      ig_error: errorDescription || error || "OAuth Instagram recusado.",
    });
  }

  const parsed = parseInstagramOAuthState(state);
  if (!parsed) {
    return callbackRedirect(request, { ig_error: "Estado OAuth Instagram invalido ou expirado." });
  }
  if (cookieState && cookieState !== state) {
    return callbackRedirect(request, { ig_error: "Estado OAuth Instagram nao confere." });
  }
  if (!code) {
    return callbackRedirect(request, { ig_error: "Codigo OAuth Instagram ausente." });
  }

  try {
    const session = await getSessionUser();
    if (session) {
      const sessionOwner = toDatabaseOwnerUserId(session.id);
      if (sessionOwner !== parsed.ownerUserId) {
        return callbackRedirect(request, { ig_error: "Sessao nao corresponde ao OAuth iniciado." });
      }
    }

    const shortLived = await exchangeInstagramCode(
      code,
      instagramRedirectUriFromRequest(request),
    );
    const longLived = await exchangeInstagramLongLivedToken(shortLived.accessToken);
    const me = await fetchInstagramMe(longLived.accessToken);
    const igUserId = me.user_id || shortLived.userId;
    if (!igUserId) {
      return callbackRedirect(request, { ig_error: "Instagram nao retornou o user id." });
    }

    const expiresAt = new Date(Date.now() + longLived.expiresIn * 1000).toISOString();
    const now = new Date().toISOString();

    await runWithStorageOwner(parsed.ownerUserId, () =>
      socialConnectionStorage.upsert({
        profileId: parsed.profileId,
        ownerUserId: parsed.ownerUserId,
        instagramUserId: igUserId,
        instagramUsername: me.username,
        instagramTokenEncrypted: encryptProviderSecret(longLived.accessToken),
        instagramTokenExpiresAt: expiresAt,
        platforms: {
          instagram: {
            connected: true,
            displayName: `@${me.username.replace(/^@/, "")}`,
            connectedAt: now,
          },
        },
      }),
    );

    return callbackRedirect(request, { connected: "1" });
  } catch (caught) {
    const message =
      caught instanceof Error ? caught.message : "Falha ao concluir o OAuth Instagram.";
    return callbackRedirect(request, { ig_error: message.slice(0, 300) });
  }
}
