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

const FIRESTORE_IN_QUERY_LIMIT = 10;

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

function verdictIdentity(record: ArticleThemeVerdictRecord) {
  return `${record.articleFingerprint}|${record.themeCanonical}|${record.modelVersion}`;
}

function chunkValues<T>(values: T[], size = FIRESTORE_IN_QUERY_LIMIT): T[][] {
  if (values.length === 0) {
    return [];
  }

  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function queryVerdictCandidates(
  fingerprints: string[],
  themeCanonicals: string[],
): Promise<ArticleThemeVerdictRecord[]> {
  const rows: ArticleThemeVerdictRecord[] = [];
  const fingerprintChunks = chunkValues(fingerprints);
  const themeChunks = chunkValues(themeCanonicals);

  for (const fingerprintChunk of fingerprintChunks) {
    for (const themeChunk of themeChunks) {
      const snap = await col(COLLECTIONS.sentinelArticleThemeVerdicts)
        .where("modelVersion", "==", SENTINEL_THEME_VERIFY_MODEL_VERSION)
        .where("articleFingerprint", "in", fingerprintChunk)
        .where("themeCanonical", "in", themeChunk)
        .get();

      for (const doc of snap.docs) {
        rows.push(mapVerdictRow(doc.data()));
      }
    }
  }

  return rows;
}

export async function readArticleThemeVerdicts(
  keys: VerdictLookupKey[],
): Promise<ArticleThemeVerdictRecord[]> {
  if (keys.length === 0) {
    return [];
  }

  const uniqueFingerprints = [...new Set(keys.map((key) => key.fingerprint))];
  const themeCanonicals = [...new Set(keys.map((key) => key.themeCanonical))];
  const wanted = new Set(
    keys.map(
      (key) => `${key.fingerprint}|${key.themeCanonical}|${SENTINEL_THEME_VERIFY_MODEL_VERSION}`,
    ),
  );
  const now = Date.now();

  const candidates = await queryVerdictCandidates(uniqueFingerprints, themeCanonicals);

  return candidates.filter((row) => {
    if (!wanted.has(verdictIdentity(row))) {
      return false;
    }

    const expiresAt = new Date(row.expiresAt).getTime();
    return !Number.isNaN(expiresAt) && expiresAt > now;
  });
}

export async function writeArticleThemeVerdicts(records: ArticleThemeVerdictRecord[]) {
  if (records.length === 0) {
    return;
  }

  const batch = getFirestore().batch();

  for (const record of records) {
    const ref = col(COLLECTIONS.sentinelArticleThemeVerdicts).doc(verdictIdentity(record));
    batch.set(ref, record);
  }

  await batch.commit();
}
