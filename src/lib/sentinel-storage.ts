import { randomUUID } from "node:crypto";

import type { DocumentData, QuerySnapshot } from "firebase-admin/firestore";

import { isSentinelPersistCacheEnabled } from "@/lib/feature-flags";
import { getFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS, col } from "@/lib/firebase/collections";
import { getStorageOwnerUserId } from "@/lib/storage-context";
import type { MockSentinelSuggestion } from "@/lib/sentinel-mock-suggestions";
import type { SentinelSuggestionsMeta } from "@/lib/sentinel-types";

export type SentinelCacheRecord = {
  suggestions: MockSentinelSuggestion[];
  meta: SentinelSuggestionsMeta;
  expiresAt: string;
  refreshedAt: string;
};

export type SentinelThemeExpansionRecord = {
  sourceTheme: string;
  expandedTerms: string[];
  generatedAt: string;
};

function dedupeThemeExpansionsBySource(
  rows: SentinelThemeExpansionRecord[],
): SentinelThemeExpansionRecord[] {
  const byTheme = new Map<string, SentinelThemeExpansionRecord>();

  for (const row of rows) {
    const key = row.sourceTheme.trim().toLowerCase();
    if (!key) {
      continue;
    }

    const existing = byTheme.get(key);
    if (!existing || row.generatedAt > existing.generatedAt) {
      byTheme.set(key, row);
    }
  }

  return [...byTheme.values()].sort((left, right) =>
    left.sourceTheme.localeCompare(right.sourceTheme, "pt-BR"),
  );
}

function nowIso() {
  return new Date().toISOString();
}

function resolveOwnerUserId() {
  return getStorageOwnerUserId()?.trim() || "";
}

function mapCacheRow(data: DocumentData): SentinelCacheRecord {
  return {
    suggestions: Array.isArray(data.suggestions)
      ? (data.suggestions as MockSentinelSuggestion[])
      : [],
    meta: (data.meta ?? {}) as SentinelSuggestionsMeta,
    expiresAt: String(data.expiresAt ?? ""),
    refreshedAt: String(data.refreshedAt ?? nowIso()),
  };
}

function themeExpansionDocId(profileId: string, sourceTheme: string) {
  return `${profileId}|${sourceTheme.trim().toLowerCase()}`;
}

async function deleteDocs(snapshot: QuerySnapshot) {
  if (snapshot.empty) {
    return;
  }

  const db = getFirestore();
  const batch = db.batch();
  for (const doc of snapshot.docs) {
    batch.delete(doc.ref);
  }
  await batch.commit();
}

export const sentinelStorage = {
  async readCache(profileId: string): Promise<SentinelCacheRecord | null> {
    if (!isSentinelPersistCacheEnabled()) {
      return null;
    }

    const snap = await col(COLLECTIONS.sentinelSuggestionCache).doc(profileId).get();
    if (!snap.exists) {
      return null;
    }

    const data = snap.data()!;
    const currentOwner = resolveOwnerUserId();
    if (currentOwner && data.ownerUserId && String(data.ownerUserId) !== currentOwner) {
      return null;
    }

    return mapCacheRow(data);
  },

  async writeCache(
    profileId: string,
    input: {
      suggestions: MockSentinelSuggestion[];
      meta: SentinelSuggestionsMeta;
      expiresAt: string;
    },
  ) {
    if (!isSentinelPersistCacheEnabled()) {
      return;
    }

    const ownerUserId = resolveOwnerUserId();
    const refreshedAt = input.meta.refreshedAt || nowIso();

    await col(COLLECTIONS.sentinelSuggestionCache).doc(profileId).set({
      profileId,
      ownerUserId,
      suggestions: input.suggestions,
      meta: input.meta,
      expiresAt: input.expiresAt,
      refreshedAt,
      updatedAt: nowIso(),
    });
  },

  async clearCache(profileId: string) {
    if (!isSentinelPersistCacheEnabled()) {
      return;
    }

    await col(COLLECTIONS.sentinelSuggestionCache).doc(profileId).delete();
  },

  async appendSignalHistory(
    profileId: string,
    suggestions: MockSentinelSuggestion[],
    scannedAt: string,
  ) {
    if (!isSentinelPersistCacheEnabled() || suggestions.length === 0) {
      return;
    }

    const ownerUserId = resolveOwnerUserId();
    const db = getFirestore();
    const batch = db.batch();

    for (const suggestion of suggestions) {
      const id = randomUUID();
      const ref = col(COLLECTIONS.sentinelSignals).doc(id);
      batch.set(ref, {
        id,
        signalId: suggestion.id,
        profileId,
        ownerUserId,
        pipeline: suggestion.pipeline ?? "legacy",
        themeLabel: suggestion.themeLabel,
        relevanceScore: suggestion.relevanceScore,
        payload: suggestion,
        scannedAt,
      });
    }

    await batch.commit();
  },

  async readThemeExpansions(profileId: string): Promise<SentinelThemeExpansionRecord[]> {
    if (!isSentinelPersistCacheEnabled()) {
      return [];
    }

    const snap = await col(COLLECTIONS.sentinelThemeExpansions)
      .where("profileId", "==", profileId)
      .get();

    return dedupeThemeExpansionsBySource(
      snap.docs.map((doc) => {
        const data = doc.data();
        return {
          sourceTheme: String(data.sourceTheme ?? ""),
          expandedTerms: Array.isArray(data.expandedTerms)
            ? data.expandedTerms.map(String).filter(Boolean)
            : [],
          generatedAt: String(data.generatedAt ?? nowIso()),
        };
      }),
    );
  },

  async writeThemeExpansions(profileId: string, records: SentinelThemeExpansionRecord[]) {
    if (!isSentinelPersistCacheEnabled()) {
      return;
    }

    const ownerUserId = resolveOwnerUserId();
    const existing = await col(COLLECTIONS.sentinelThemeExpansions)
      .where("profileId", "==", profileId)
      .get();

    await deleteDocs(existing);

    if (records.length === 0) {
      return;
    }

    const db = getFirestore();
    const batch = db.batch();

    for (const record of records) {
      const id = themeExpansionDocId(profileId, record.sourceTheme);
      const ref = col(COLLECTIONS.sentinelThemeExpansions).doc(id);
      batch.set(ref, {
        id,
        profileId,
        ownerUserId,
        sourceTheme: record.sourceTheme,
        expandedTerms: record.expandedTerms,
        generatedAt: record.generatedAt || nowIso(),
      });
    }

    await batch.commit();
  },
};

export function isSentinelCacheExpired(record: SentinelCacheRecord, now = Date.now()) {
  const expiresAt = Date.parse(record.expiresAt);
  return !Number.isFinite(expiresAt) || expiresAt <= now;
}
