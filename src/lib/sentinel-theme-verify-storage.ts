import { promises as fs } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import {
  assertLocalFilesystemAllowed,
  canUseLocalFilesystem,
  supabaseSchemaOutdatedMessage,
} from "@/lib/server-runtime";
import { SENTINEL_THEME_VERIFY_MODEL_VERSION } from "@/lib/sentinel-theme-verify-constants";

const DATABASE_PATH = path.join(process.cwd(), "data", "mandato-digital.json");

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

type LocalDatabase = {
  sentinelArticleThemeVerdicts?: ArticleThemeVerdictRecord[];
  [key: string]: unknown;
};

type VerdictLookupKey = {
  fingerprint: string;
  themeCanonical: string;
  themeLabel?: string;
};

function nowIso() {
  return new Date().toISOString();
}

function isSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorios.");
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function isSchemaCompatibilityError(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return false;
  }

  const code = String(error.code);
  return code === "PGRST205" || code === "PGRST204" || code === "42703" || code === "42P01";
}

function throwIfNoLocalSchemaFallback(error: unknown) {
  if (!canUseLocalFilesystem()) {
    throw new Error(supabaseSchemaOutdatedMessage(error));
  }
}

async function readLocalDatabase(): Promise<LocalDatabase> {
  try {
    const raw = await fs.readFile(DATABASE_PATH, "utf8");
    return raw.trim() ? (JSON.parse(raw) as LocalDatabase) : {};
  } catch {
    return {};
  }
}

async function writeLocalDatabase(database: LocalDatabase) {
  assertLocalFilesystemAllowed();
  await fs.mkdir(path.dirname(DATABASE_PATH), { recursive: true });
  await fs.writeFile(DATABASE_PATH, JSON.stringify(database, null, 2));
}

function mapVerdictRow(row: Record<string, unknown>): ArticleThemeVerdictRecord {
  return {
    articleFingerprint: String(row.article_fingerprint ?? ""),
    articleTitle: String(row.article_title ?? ""),
    articleUrl: String(row.article_url ?? ""),
    articleSource: String(row.article_source ?? ""),
    themeCanonical: String(row.theme_canonical ?? ""),
    themeLabel: String(row.theme_label ?? ""),
    approved: Boolean(row.approved),
    confidence: Number(row.confidence ?? 0),
    rationale: String(row.rationale ?? ""),
    modelVersion: String(row.model_version ?? SENTINEL_THEME_VERIFY_MODEL_VERSION),
    verifiedAt: String(row.verified_at ?? nowIso()),
    expiresAt: String(row.expires_at ?? ""),
  };
}

function verdictIdentity(record: ArticleThemeVerdictRecord) {
  return `${record.articleFingerprint}|${record.themeCanonical}|${record.modelVersion}`;
}

function canPersistThemeVerdicts() {
  return isSupabaseConfigured() || canUseLocalFilesystem();
}

export async function readArticleThemeVerdicts(
  keys: VerdictLookupKey[],
): Promise<ArticleThemeVerdictRecord[]> {
  if (!canPersistThemeVerdicts() || keys.length === 0) {
    return [];
  }

  const uniqueFingerprints = [...new Set(keys.map((key) => key.fingerprint))];
  const themeCanonicals = [...new Set(keys.map((key) => key.themeCanonical))];

  if (isSupabaseConfigured()) {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("sentinel_article_theme_verdicts")
      .select(
        "article_fingerprint, article_title, article_url, article_source, theme_canonical, theme_label, approved, confidence, rationale, model_version, verified_at, expires_at",
      )
      .eq("model_version", SENTINEL_THEME_VERIFY_MODEL_VERSION)
      .in("article_fingerprint", uniqueFingerprints)
      .in("theme_canonical", themeCanonicals)
      .gt("expires_at", nowIso());

    if (error) {
      if (isSchemaCompatibilityError(error)) {
        throwIfNoLocalSchemaFallback(error);
        const database = await readLocalDatabase();
        const stored = database.sentinelArticleThemeVerdicts ?? [];
        const wanted = new Set(
          keys.map((key) => `${key.fingerprint}|${key.themeCanonical}|${SENTINEL_THEME_VERIFY_MODEL_VERSION}`),
        );
        return stored.filter((row) => wanted.has(verdictIdentity(row)));
      }

      throw error;
    }

    return (data ?? []).map((row) => mapVerdictRow(row as Record<string, unknown>));
  }

  assertLocalFilesystemAllowed();
  const database = await readLocalDatabase();
  const stored = database.sentinelArticleThemeVerdicts ?? [];
  const wanted = new Set(
    keys.map((key) => `${key.fingerprint}|${key.themeCanonical}|${SENTINEL_THEME_VERIFY_MODEL_VERSION}`),
  );

  return stored.filter((row) => {
    if (!wanted.has(verdictIdentity(row))) {
      return false;
    }

    const expiresAt = new Date(row.expiresAt).getTime();
    return !Number.isNaN(expiresAt) && expiresAt > Date.now();
  });
}

export async function writeArticleThemeVerdicts(records: ArticleThemeVerdictRecord[]) {
  if (!canPersistThemeVerdicts() || records.length === 0) {
    return;
  }

  if (isSupabaseConfigured()) {
    const client = getSupabaseClient();
    const rows = records.map((record) => ({
      article_fingerprint: record.articleFingerprint,
      article_title: record.articleTitle,
      article_url: record.articleUrl,
      article_source: record.articleSource,
      theme_canonical: record.themeCanonical,
      theme_label: record.themeLabel,
      approved: record.approved,
      confidence: record.confidence,
      rationale: record.rationale,
      model_version: record.modelVersion,
      verified_at: record.verifiedAt,
      expires_at: record.expiresAt,
    }));

    const { error } = await client
      .from("sentinel_article_theme_verdicts")
      .upsert(rows, {
        onConflict: "article_fingerprint,theme_canonical,model_version",
      });

    if (error) {
      if (isSchemaCompatibilityError(error)) {
        throwIfNoLocalSchemaFallback(error);
        const database = await readLocalDatabase();
        const byId = new Map(
          (database.sentinelArticleThemeVerdicts ?? []).map((row) => [verdictIdentity(row), row]),
        );

        for (const record of records) {
          byId.set(verdictIdentity(record), record);
        }

        database.sentinelArticleThemeVerdicts = [...byId.values()].slice(-5000);
        await writeLocalDatabase(database);
        return;
      }

      throw error;
    }

    return;
  }

  assertLocalFilesystemAllowed();
  const database = await readLocalDatabase();
  const byId = new Map(
    (database.sentinelArticleThemeVerdicts ?? []).map((row) => [verdictIdentity(row), row]),
  );

  for (const record of records) {
    byId.set(verdictIdentity(record), record);
  }

  database.sentinelArticleThemeVerdicts = [...byId.values()].slice(-5000);
  await writeLocalDatabase(database);
}
