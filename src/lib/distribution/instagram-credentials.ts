import { decryptProviderSecret } from "@/lib/admin/provider-secrets";
import {
  getEnvInstagramAccessToken,
  getEnvInstagramUserId,
  getEnvInstagramUsername,
  hasEnvInstagramPublishToken,
} from "@/lib/distribution/instagram-env";
import type { SocialConnection } from "@/lib/distribution/types";

export type InstagramPublishAuth = {
  accessToken: string;
  igUserId: string;
  username: string | null;
  source: "connection" | "env";
};

export function resolveInstagramPublishAuth(
  connection: SocialConnection | null,
): InstagramPublishAuth | null {
  if (connection?.instagramTokenEncrypted && connection.instagramUserId) {
    try {
      const accessToken = decryptProviderSecret(connection.instagramTokenEncrypted).trim();
      if (accessToken) {
        return {
          accessToken,
          igUserId: connection.instagramUserId,
          username: connection.instagramUsername || null,
          source: "connection",
        };
      }
    } catch (error) {
      console.warn("[distribution] falha ao descriptografar token Instagram", error);
    }
  }

  if (hasEnvInstagramPublishToken()) {
    return {
      accessToken: getEnvInstagramAccessToken(),
      igUserId: getEnvInstagramUserId(),
      username: getEnvInstagramUsername() || "mandatodigital.app",
      source: "env",
    };
  }

  return null;
}

export function overlayInstagramConnection(
  connection: SocialConnection | null,
  profileId = "",
): SocialConnection | null {
  const auth = resolveInstagramPublishAuth(connection);
  if (!auth) {
    return connection;
  }
  const now = new Date().toISOString();
  const base: SocialConnection = connection ?? {
    id: profileId,
    profileId,
    ownerUserId: "",
    ayrshareProfileKey: "",
    ayrshareRefId: "",
    instagramUserId: "",
    instagramUsername: "",
    instagramTokenEncrypted: "",
    instagramTokenExpiresAt: null,
    platforms: {},
    electionDate: null,
    createdAt: now,
    updatedAt: now,
  };
  const username = (auth.username || base.instagramUsername || "").replace(/^@/, "");
  return {
    ...base,
    instagramUserId: auth.igUserId || base.instagramUserId,
    instagramUsername: username,
    platforms: {
      ...base.platforms,
      instagram: {
        connected: true,
        displayName: username ? `@${username}` : base.platforms.instagram?.displayName ?? null,
        connectedAt: base.platforms.instagram?.connectedAt ?? now,
      },
    },
  };
}
