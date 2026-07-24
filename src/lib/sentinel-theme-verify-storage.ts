import type { DocumentData } from "firebase-admin/firestore";

import { getFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS, col } from "@/lib/firebase/collections";
import { SENTINEL_THEME_VERIFY_MODEL_VERSION } from "@/lib/sentinel-theme-verify-constants";

export type ArticleThemeVerdictRecord = {
  articleFingerprint: string;
  articleTitle: string;
  articleUrl: string;
  articleSource: string;
  themeCanonical: string;
  themeLabel: string;
  approved: boolean;
  confidence: number;
  rationale: string;
  modelVersion: string;
  verifiedAt: string;
  expiresAt: string;
};

type VerdictLookupKey = {
  fingerprint: string;
  themeCanonical: string;
  themeLabel?: string;
};

/** getAll aceita no máx. ~100 refs por chamada na prática segura. */
const FIRESTORE_GETALL_LIMIT = 100;
const FIRESTORE_BATCH_LIMIT = 400;

function nowIso() {
  return new Date().toISOString();
}

function mapVerdictRow(data: DocumentData): ArticleThemeVerdictRecord {
  return {
    articleFingerprint: String(data.articleFingerprint ?? ""),
    articleTitle: String(data.articleTitle ?? ""),
    articleUrl: String(data.articleUrl ?? ""),
    articleSource: String(data.articleSource ?? ""),
    themeCanonical: String(data.themeCanonical ?? ""),
    themeLabel: String(data.themeLabel ?? ""),
    approved: Boolean(data.approved),
    confidence: Number(data.confidence ?? 0),
    rationale: String(data.rationale ?? ""),
    modelVersion: String(data.modelVersion ?? SENTINEL_THEME_VERIFY_MODEL_VERSION),
    verifiedAt: String(data.verifiedAt ?? nowIso()),
    expiresAt: String(data.expiresAt ?? ""),
  };
}

function verdictIdentity(record: {
  articleFingerprint: string;
  themeCanonical: string;
  modelVersion?: string;
}) {
  return `${record.articleFingerprint}|${record.themeCanonical}|${record.modelVersion ?? SENTINEL_THEME_VERIFY_MODEL_VERSION}`;
}

function chunkValues<T>(values: T[], size: number): T[][] {
  if (values.length === 0) {
    return [];
  }

  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

/**
 * Lê vereditos por ID de documento (fingerprint|theme|version).
 * Evita `in` × `in` no Firestore, que explode disjunctions (máx. 30).
 */
export async function readArticleThemeVerdicts(
  keys: VerdictLookupKey[],
): Promise<ArticleThemeVerdictRecord[]> {
  if (keys.length === 0) {
    return [];
  }

  const uniqueIds = [
    ...new Set(
      keys.map(
        (key) =>
          `${key.fingerprint}|${key.themeCanonical}|${SENTINEL_THEME_VERIFY_MODEL_VERSION}`,
      ),
    ),
  ];
  const now = Date.now();
  const db = getFirestore();
  const rows: ArticleThemeVerdictRecord[] = [];

  for (const idChunk of chunkValues(uniqueIds, FIRESTORE_GETALL_LIMIT)) {
    const refs = idChunk.map((id) => col(COLLECTIONS.sentinelArticleThemeVerdicts).doc(id));
    const snaps = await db.getAll(...refs);
    for (const snap of snaps) {
      if (!snap.exists) {
        continue;
      }
      const row = mapVerdictRow(snap.data() ?? {});
      const expiresAt = new Date(row.expiresAt).getTime();
      if (!Number.isNaN(expiresAt) && expiresAt > now) {
        rows.push(row);
      }
    }
  }

  return rows;
}

export async function writeArticleThemeVerdicts(records: ArticleThemeVerdictRecord[]) {
  if (records.length === 0) {
    return;
  }

  const db = getFirestore();
  for (const recordChunk of chunkValues(records, FIRESTORE_BATCH_LIMIT)) {
    const batch = db.batch();
    for (const record of recordChunk) {
      const ref = col(COLLECTIONS.sentinelArticleThemeVerdicts).doc(verdictIdentity(record));
      batch.set(ref, record);
    }
    await batch.commit();
  }
}
