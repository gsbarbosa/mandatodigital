import { promises as fs } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { isSentinelPersistCacheEnabled } from "@/lib/feature-flags";
import { getStorageOwnerUserId } from "@/lib/storage-context";
import {
  assertLocalFilesystemAllowed,
  canUseLocalFilesystem,
  supabaseSchemaOutdatedMessage,
} from "@/lib/server-runtime";
import type { MockSentinelSuggestion } from "@/lib/sentinel-mock-suggestions";
import type { SentinelSuggestionsMeta } from "@/lib/sentinel-types";

const DATABASE_PATH = path.join(process.cwd(), "data", "mandato-digital.json");

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

type LocalDatabase = {
  sentinelSuggestionCache?: Record<string, SentinelCacheRecord>;
  sentinelSignalHistory?: SentinelSignalHistoryRow[];
  sentinelThemeExpansions?: Record<string, SentinelThemeExpansionRecord[]>;
  [key: string]: unknown;
};

type SentinelSignalHistoryRow = {
  id: string;
  signalId: string;
  profileId: string;
  ownerUserId: string;
  pipeline: string;
  themeLabel: string;
  relevanceScore: number;
  payload: MockSentinelSuggestion;
  scannedAt: string;
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

function resolveOwnerUserId() {
  return getStorageOwnerUserId()?.trim() || "";
}

function mapCacheRow(row: Record<string, unknown>): SentinelCacheRecord {
  return {
    suggestions: Array.isArray(row.suggestions)
      ? (row.suggestions as MockSentinelSuggestion[])
      : [],
    meta: (row.meta ?? {}) as SentinelSuggestionsMeta,
    expiresAt: String(row.expires_at ?? ""),
    refreshedAt: String(row.refreshed_at ?? nowIso()),
  };
}

export const sentinelStorage = {
  async readCache(profileId: string): Promise<SentinelCacheRecord | null> {
    if (!isSentinelPersistCacheEnabled()) {
      return null;
    }

    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from("sentinel_suggestion_cache")
        .select("*")
        .eq("profile_id", profileId)
        .maybeSingle();

      if (error) {
        if (isSchemaCompatibilityError(error)) {
          throwIfNoLocalSchemaFallback(error);
          const database = await readLocalDatabase();
          return database.sentinelSuggestionCache?.[profileId] ?? null;
        }

        throw error;
      }

      if (!data) {
        return null;
      }

      return mapCacheRow(data);
    }

    assertLocalFilesystemAllowed();
    const database = await readLocalDatabase();
    return database.sentinelSuggestionCache?.[profileId] ?? null;
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
    const record: SentinelCacheRecord = {
      suggestions: input.suggestions,
      meta: input.meta,
      expiresAt: input.expiresAt,
      refreshedAt,
    };

    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();
      const { error } = await client.from("sentinel_suggestion_cache").upsert(
        {
          profile_id: profileId,
          owner_user_id: ownerUserId,
          suggestions: input.suggestions,
          meta: input.meta,
          expires_at: input.expiresAt,
          refreshed_at: refreshedAt,
          updated_at: nowIso(),
        },
        { onConflict: "profile_id" },
      );

      if (error) {
        if (isSchemaCompatibilityError(error)) {
          throwIfNoLocalSchemaFallback(error);
          const database = await readLocalDatabase();
          database.sentinelSuggestionCache = {
            ...(database.sentinelSuggestionCache ?? {}),
            [profileId]: record,
          };
          await writeLocalDatabase(database);
          return;
        }

        throw error;
      }

      return;
    }

    assertLocalFilesystemAllowed();
    const database = await readLocalDatabase();
    database.sentinelSuggestionCache = {
      ...(database.sentinelSuggestionCache ?? {}),
      [profileId]: record,
    };
    await writeLocalDatabase(database);
  },

  async clearCache(profileId: string) {
    if (!isSentinelPersistCacheEnabled()) {
      return;
    }

    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();
      const { error } = await client
        .from("sentinel_suggestion_cache")
        .delete()
        .eq("profile_id", profileId);

      if (error) {
        if (isSchemaCompatibilityError(error)) {
          throwIfNoLocalSchemaFallback(error);
          const database = await readLocalDatabase();
          if (database.sentinelSuggestionCache?.[profileId]) {
            delete database.sentinelSuggestionCache[profileId];
            await writeLocalDatabase(database);
          }
          return;
        }

        throw error;
      }

      return;
    }

    assertLocalFilesystemAllowed();
    const database = await readLocalDatabase();
    if (database.sentinelSuggestionCache?.[profileId]) {
      delete database.sentinelSuggestionCache[profileId];
      await writeLocalDatabase(database);
    }
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
    const rows = suggestions.map((suggestion) => ({
      signal_id: suggestion.id,
      profile_id: profileId,
      owner_user_id: ownerUserId,
      pipeline: suggestion.pipeline ?? "legacy",
      theme_label: suggestion.themeLabel,
      relevance_score: suggestion.relevanceScore,
      payload: suggestion,
      scanned_at: scannedAt,
    }));

    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();
      const { error } = await client.from("sentinel_signals").insert(rows);

      if (error) {
        if (isSchemaCompatibilityError(error)) {
          throwIfNoLocalSchemaFallback(error);
          const database = await readLocalDatabase();
          const history = database.sentinelSignalHistory ?? [];
          database.sentinelSignalHistory = [
            ...rows.map((row) => ({
              id: crypto.randomUUID(),
              signalId: row.signal_id,
              profileId,
              ownerUserId,
              pipeline: row.pipeline,
              themeLabel: row.theme_label,
              relevanceScore: row.relevance_score,
              payload: row.payload,
              scannedAt,
            })),
            ...history,
          ].slice(0, 500);
          await writeLocalDatabase(database);
          return;
        }

        throw error;
      }

      return;
    }

    assertLocalFilesystemAllowed();
    const database = await readLocalDatabase();
    const history = database.sentinelSignalHistory ?? [];
    database.sentinelSignalHistory = [
      ...rows.map((row) => ({
        id: crypto.randomUUID(),
        signalId: row.signal_id,
        profileId,
        ownerUserId,
        pipeline: row.pipeline,
        themeLabel: row.theme_label,
        relevanceScore: row.relevance_score,
        payload: row.payload,
        scannedAt,
      })),
      ...history,
    ].slice(0, 500);
    await writeLocalDatabase(database);
  },

  async readThemeExpansions(profileId: string): Promise<SentinelThemeExpansionRecord[]> {
    if (!isSentinelPersistCacheEnabled()) {
      return [];
    }

    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from("sentinel_theme_expansions")
        .select("source_theme, expanded_terms, generated_at")
        .eq("profile_id", profileId)
        .order("generated_at", { ascending: false });

      if (error) {
        if (isSchemaCompatibilityError(error)) {
          throwIfNoLocalSchemaFallback(error);
          const database = await readLocalDatabase();
          return database.sentinelThemeExpansions?.[profileId] ?? [];
        }

        throw error;
      }

      return (data ?? []).map((row) => ({
        sourceTheme: String(row.source_theme ?? ""),
        expandedTerms: Array.isArray(row.expanded_terms)
          ? row.expanded_terms.map(String).filter(Boolean)
          : [],
        generatedAt: String(row.generated_at ?? nowIso()),
      }));
    }

    assertLocalFilesystemAllowed();
    const database = await readLocalDatabase();
    return database.sentinelThemeExpansions?.[profileId] ?? [];
  },

  async writeThemeExpansions(profileId: string, records: SentinelThemeExpansionRecord[]) {
    if (!isSentinelPersistCacheEnabled()) {
      return;
    }

    const ownerUserId = resolveOwnerUserId();

    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();

      const { error: deleteError } = await client
        .from("sentinel_theme_expansions")
        .delete()
        .eq("profile_id", profileId);

      if (deleteError) {
        if (isSchemaCompatibilityError(deleteError)) {
          throwIfNoLocalSchemaFallback(deleteError);
          const database = await readLocalDatabase();
          database.sentinelThemeExpansions = {
            ...(database.sentinelThemeExpansions ?? {}),
            [profileId]: records,
          };
          await writeLocalDatabase(database);
          return;
        }

        throw deleteError;
      }

      if (records.length === 0) {
        return;
      }

      const rows = records.map((record) => ({
        profile_id: profileId,
        owner_user_id: ownerUserId,
        source_theme: record.sourceTheme,
        expanded_terms: record.expandedTerms,
        generated_at: record.generatedAt || nowIso(),
      }));

      const { error } = await client.from("sentinel_theme_expansions").insert(rows);

      if (error) {
        if (isSchemaCompatibilityError(error)) {
          throwIfNoLocalSchemaFallback(error);
          const database = await readLocalDatabase();
          database.sentinelThemeExpansions = {
            ...(database.sentinelThemeExpansions ?? {}),
            [profileId]: records,
          };
          await writeLocalDatabase(database);
          return;
        }

        throw error;
      }

      return;
    }

    assertLocalFilesystemAllowed();
    const database = await readLocalDatabase();
    database.sentinelThemeExpansions = {
      ...(database.sentinelThemeExpansions ?? {}),
      [profileId]: records,
    };
    await writeLocalDatabase(database);
  },
};

export function isSentinelCacheExpired(record: SentinelCacheRecord, now = Date.now()) {
  const expiresAt = Date.parse(record.expiresAt);
  return !Number.isFinite(expiresAt) || expiresAt <= now;
}
