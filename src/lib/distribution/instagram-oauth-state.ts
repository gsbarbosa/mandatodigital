import { createHmac, timingSafeEqual } from "node:crypto";

import { getAdminSessionSecret } from "@/lib/admin/credentials";

export const INSTAGRAM_OAUTH_COOKIE = "md_ig_oauth";
const TTL_SECONDS = 10 * 60;

function sign(payload: string) {
  return createHmac("sha256", getAdminSessionSecret()).update(payload).digest("hex");
}

export function createInstagramOAuthState(profileId: string, ownerUserId: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const body = `${profileId}:${ownerUserId}:${expiresAt}`;
  return `${body}:${sign(body)}`;
}

export function parseInstagramOAuthState(state: string): {
  profileId: string;
  ownerUserId: string;
} | null {
  try {
    const [profileId, ownerUserId, expiresAtRaw, signature] = state.split(":");
    if (!profileId || !ownerUserId || !expiresAtRaw || !signature) {
      return null;
    }
    const expiresAt = Number(expiresAtRaw);
    if (!Number.isFinite(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) {
      return null;
    }
    const body = `${profileId}:${ownerUserId}:${expiresAtRaw}`;
    const expected = sign(body);
    const actualBuf = Buffer.from(signature, "hex");
    const expectedBuf = Buffer.from(expected, "hex");
    if (actualBuf.length !== expectedBuf.length || !timingSafeEqual(actualBuf, expectedBuf)) {
      return null;
    }
    return { profileId, ownerUserId };
  } catch {
    return null;
  }
}
