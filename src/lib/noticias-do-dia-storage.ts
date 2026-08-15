/**
 * Cache diário (Firestore) da tela Notícias do Dia. Collection e formato
 * próprios — não reaproveita sentinelSuggestionCache nem sentinel-storage.ts.
 */

import { COLLECTIONS, col } from "@/lib/firebase/collections";
import { hasFirebaseServiceAccount } from "@/lib/firebase/env";
import { getStorageOwnerUserId } from "@/lib/storage-context";
import type { NoticiasDoDiaResult } from "@/lib/noticias-do-dia";

export type NoticiasDoDiaCacheRecord = NoticiasDoDiaResult;

function resolveOwnerUserId() {
  return getStorageOwnerUserId()?.trim() || "";
}

function nowIso() {
  return new Date().toISOString();
}

/** "Do dia" em America/Sao_Paulo — YYYY-MM-DD, usado só pra decidir se o cache já é de hoje. */
export function currentSaoPauloDateStamp(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export const noticiasDoDiaStorage = {
  async readCache(profileId: string): Promise<NoticiasDoDiaCacheRecord | null> {
    if (!hasFirebaseServiceAccount()) {
      return null;
    }
    const snap = await col(COLLECTIONS.noticiasDoDiaCache).doc(profileId).get();
    if (!snap.exists) {
      return null;
    }
    const data = snap.data()!;
    const currentOwner = resolveOwnerUserId();
    if (currentOwner && data.ownerUserId && String(data.ownerUserId) !== currentOwner) {
      return null;
    }
    return {
      nacional: Array.isArray(data.nacional) ? data.nacional : [],
      estadual: Array.isArray(data.estadual) ? data.estadual : [],
      municipal: Array.isArray(data.municipal) ? data.municipal : [],
      meta: data.meta
        ? { municipalFailedPortals: [], ...data.meta }
        : {
            generatedAt: nowIso(),
            stateUf: null,
            nationalPortalCount: 0,
            statePortalCount: 0,
            municipalPortalCount: 0,
            municipalFailedPortals: [],
          },
    } as NoticiasDoDiaCacheRecord;
  },

  async writeCache(profileId: string, result: NoticiasDoDiaResult): Promise<void> {
    if (!hasFirebaseServiceAccount()) {
      return;
    }
    const ownerUserId = resolveOwnerUserId();
    await col(COLLECTIONS.noticiasDoDiaCache).doc(profileId).set({
      profileId,
      ownerUserId,
      nacional: JSON.parse(JSON.stringify(result.nacional)),
      estadual: JSON.parse(JSON.stringify(result.estadual)),
      municipal: JSON.parse(JSON.stringify(result.municipal)),
      meta: JSON.parse(JSON.stringify(result.meta)),
      dateStamp: currentSaoPauloDateStamp(),
      updatedAt: nowIso(),
    });
  },
};
