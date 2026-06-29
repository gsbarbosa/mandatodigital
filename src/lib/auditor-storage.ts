import { promises as fs } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import type { FactCheckResult } from "@/lib/auditor/types";
import { isAuditorFactCheckEnabled } from "@/lib/feature-flags";
import { getStorageOwnerUserId } from "@/lib/storage-context";
import {
  assertLocalFilesystemAllowed,
  canUseLocalFilesystem,
  supabaseSchemaOutdatedMessage,
} from "@/lib/server-runtime";
import type { MockSentinelSuggestion } from "@/lib/sentinel-mock-suggestions";

const DATABASE_PATH = path.join(process.cwd(), "data", "mandato-digital.json");

type LocalDatabase = {
  sentinelFactChecks?: Record<string, Record<string, FactCheckRecord>>;
  auditLog?: AuditLogRow[];
  [key: string]: unknown;
};

type FactCheckRecord = {
  signalId: string;
  profileId: string;
  ownerUserId: string;
  status: "pending" | "done" | "error";
  verdict: string;
  confidence: number;
  result: FactCheckResult;
  checkedAt: string;
};

type AuditLogRow = {
  id: string;
  ownerUserId: string;
  profileId: string | null;
  projectId: string | null;
  eventType: string;
  payload: Record<string, unknown>;
  consentTextVersion: string;
  createdAt: string;
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
    auth: { autoRefreshToken: false, persistSession: false },
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

export const auditorStorage = {
  async saveFactCheck(profileId: string, signalId: string, result: FactCheckResult) {
    if (!isAuditorFactCheckEnabled()) {
      return;
    }

    const ownerUserId = resolveOwnerUserId();
    const record: FactCheckRecord = {
      signalId,
      profileId,
      ownerUserId,
      status: "done",
      verdict: result.verdict,
      confidence: result.confidence,
      result,
      checkedAt: result.checkedAt || nowIso(),
    };

    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();
      const { error } = await client.from("sentinel_fact_checks").upsert(
        {
          signal_id: signalId,
          profile_id: profileId,
          owner_user_id: ownerUserId,
          status: record.status,
          verdict: record.verdict,
          confidence: record.confidence,
          result,
          checked_at: record.checkedAt,
        },
        { onConflict: "profile_id,signal_id" },
      );

      if (error) {
        if (isSchemaCompatibilityError(error)) {
          throwIfNoLocalSchemaFallback(error);
          const database = await readLocalDatabase();
          database.sentinelFactChecks = {
            ...(database.sentinelFactChecks ?? {}),
            [profileId]: {
              ...(database.sentinelFactChecks?.[profileId] ?? {}),
              [signalId]: record,
            },
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
    database.sentinelFactChecks = {
      ...(database.sentinelFactChecks ?? {}),
      [profileId]: {
        ...(database.sentinelFactChecks?.[profileId] ?? {}),
        [signalId]: record,
      },
    };
    await writeLocalDatabase(database);
  },

  async appendAuditLog(input: {
    profileId?: string | null;
    projectId?: string | null;
    eventType: string;
    payload?: Record<string, unknown>;
    consentTextVersion?: string;
  }) {
    const ownerUserId = resolveOwnerUserId();
    const row: AuditLogRow = {
      id: crypto.randomUUID(),
      ownerUserId,
      profileId: input.profileId ?? null,
      projectId: input.projectId ?? null,
      eventType: input.eventType,
      payload: input.payload ?? {},
      consentTextVersion: input.consentTextVersion ?? "v1",
      createdAt: nowIso(),
    };

    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();
      const { error } = await client.from("audit_log").insert({
        owner_user_id: ownerUserId,
        profile_id: input.profileId ?? null,
        project_id: input.projectId ?? null,
        event_type: input.eventType,
        payload: input.payload ?? {},
        consent_text_version: input.consentTextVersion ?? "v1",
        created_at: row.createdAt,
      });

      if (error) {
        if (isSchemaCompatibilityError(error)) {
          throwIfNoLocalSchemaFallback(error);
          const database = await readLocalDatabase();
          database.auditLog = [row, ...(database.auditLog ?? [])].slice(0, 500);
          await writeLocalDatabase(database);
          return;
        }

        throw error;
      }

      return;
    }

    assertLocalFilesystemAllowed();
    const database = await readLocalDatabase();
    database.auditLog = [row, ...(database.auditLog ?? [])].slice(0, 500);
    await writeLocalDatabase(database);
  },
};

export async function factCheckTopSentinelSuggestions(input: {
  profileId: string;
  suggestions: MockSentinelSuggestion[];
  topicFor?: (suggestion: MockSentinelSuggestion) => string;
}) {
  if (!isAuditorFactCheckEnabled()) {
    return;
  }

  const { runFactCheck } = await import("@/lib/auditor/fact-check");

  for (const suggestion of input.suggestions.slice(0, 10)) {
    try {
      const result = await runFactCheck({
        script: suggestion.topic,
        topic: suggestion.topic,
        articles: suggestion.evidence.articles ?? [],
      });

      await auditorStorage.saveFactCheck(input.profileId, suggestion.id, result);
    } catch {
      // Não bloqueia refresh por falha individual.
    }
  }
}
