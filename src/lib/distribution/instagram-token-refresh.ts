import { decryptProviderSecret, encryptProviderSecret } from "@/lib/admin/provider-secrets";
import { socialConnectionStorage } from "@/lib/distribution/connection-storage";
import { refreshInstagramLongLivedToken } from "@/lib/distribution/instagram-graph-client";

/**
 * O token de longa duração do Instagram vive 60 dias. Sem renovação, publicar
 * simplesmente para de funcionar dois meses depois de conectar — e o erro só
 * aparece no disparo. Renovamos com folga; passado o vencimento a Meta recusa
 * o refresh e só resta reconectar por OAuth.
 */

export const REFRESH_WINDOW_DAYS = 15;

export type TokenRefreshResult = {
  scanned: number;
  refreshed: number;
  failed: number;
  details: Array<{
    profileId: string;
    outcome: "refreshed" | "failed";
    expiresAt?: string;
    reason?: string;
  }>;
};

export async function refreshExpiringInstagramTokens(input?: {
  now?: Date;
  windowDays?: number;
  limit?: number;
}): Promise<TokenRefreshResult> {
  const now = input?.now ?? new Date();
  const windowDays = input?.windowDays ?? REFRESH_WINDOW_DAYS;
  const cutoff = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000).toISOString();

  const connections = await socialConnectionStorage.listInstagramTokensExpiringBefore(
    cutoff,
    input?.limit ?? 50,
  );

  const result: TokenRefreshResult = {
    scanned: connections.length,
    refreshed: 0,
    failed: 0,
    details: [],
  };

  for (const connection of connections) {
    try {
      const current = decryptProviderSecret(connection.instagramTokenEncrypted).trim();
      if (!current) {
        throw new Error("Token gravado esta vazio.");
      }

      const renewed = await refreshInstagramLongLivedToken(current);
      const expiresAt = new Date(now.getTime() + renewed.expiresIn * 1000).toISOString();

      await socialConnectionStorage.setInstagramToken(connection.profileId, {
        instagramTokenEncrypted: encryptProviderSecret(renewed.accessToken),
        instagramTokenExpiresAt: expiresAt,
      });

      result.refreshed += 1;
      result.details.push({
        profileId: connection.profileId,
        outcome: "refreshed",
        expiresAt,
      });
    } catch (error) {
      // Uma conexão quebrada não pode derrubar a varredura das outras.
      const reason = error instanceof Error ? error.message : "Falha ao renovar token.";
      console.warn(
        `[distribution] refresh de token Instagram falhou profile=${connection.profileId}`,
        reason,
      );
      result.failed += 1;
      result.details.push({
        profileId: connection.profileId,
        outcome: "failed",
        reason,
      });
    }
  }

  return result;
}
