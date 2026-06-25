import { promises as fs } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import {
  assertLocalFilesystemAllowed,
  canUseLocalFilesystem,
  supabaseSchemaOutdatedMessage,
} from "@/lib/server-runtime";
import type { CreativeProject, CreativeProjectStatus } from "@/lib/types";

const DATABASE_PATH = path.join(process.cwd(), "data", "mandato-digital.json");

export type CreativeProjectCreateInput = {
  profileId?: string | null;
  topic: string;
  personaArchetypes: string[];
  voiceTones: string[];
  scriptDraft: string;
  scriptApproved: boolean;
  freePrompt: string;
  useFreePrompt: boolean;
  avatarTrack: "realistic" | "caricature" | "photo_real";
  caricatureAssetId: string;
  heygenVideoId?: string | null;
  videoUrl?: string;
  captionUrl?: string;
  status: CreativeProjectStatus;
  errorMessage?: string;
};

type LocalDatabase = {
  creativeProjects?: CreativeProject[];
  [key: string]: unknown;
};

function nowIso() {
  return new Date().toISOString();
}

function isMissingTableError(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "PGRST205",
  );
}

function isMissingSchemaFieldError(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error.code === "PGRST204" || error.code === "42703" || error.code === "42P01"),
  );
}

function isSchemaCompatibilityError(error: unknown) {
  return isMissingTableError(error) || isMissingSchemaFieldError(error);
}

function isSupabaseConfigured() {
  return Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
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

function throwIfNoLocalSchemaFallback(error: unknown) {
  if (!canUseLocalFilesystem()) {
    throw new Error(supabaseSchemaOutdatedMessage(error));
  }
}

function mapRow(row: Record<string, unknown>): CreativeProject {
  return {
    id: String(row.id),
    profileId: row.profile_id === null ? null : String(row.profile_id),
    topic: String(row.topic ?? ""),
    personaArchetypes: Array.isArray(row.persona_archetypes)
      ? row.persona_archetypes.map(String)
      : [],
    voiceTones: Array.isArray(row.voice_tones)
      ? row.voice_tones.map(String)
      : [],
    scriptDraft: String(row.script_draft ?? ""),
    scriptApproved: Boolean(row.script_approved ?? false),
    freePrompt: String(row.free_prompt ?? ""),
    useFreePrompt: Boolean(row.use_free_prompt ?? false),
    avatarTrack:
      row.avatar_track === "caricature" ? "caricature" : "realistic",
    caricatureAssetId: String(row.caricature_asset_id ?? ""),
    heygenVideoId:
      row.heygen_video_id === null || row.heygen_video_id === undefined
        ? null
        : String(row.heygen_video_id),
    videoUrl: String(row.video_url ?? ""),
    captionUrl: String(row.caption_url ?? ""),
    status: String(row.status ?? "draft") as CreativeProjectStatus,
    errorMessage: String(row.error_message ?? ""),
    createdAt: String(row.created_at ?? nowIso()),
    updatedAt: String(row.updated_at ?? nowIso()),
  };
}

function toPayload(record: CreativeProject) {
  return {
    id: record.id,
    profile_id: record.profileId,
    topic: record.topic,
    persona_archetypes: record.personaArchetypes,
    voice_tones: record.voiceTones,
    script_draft: record.scriptDraft,
    script_approved: record.scriptApproved,
    free_prompt: record.freePrompt,
    use_free_prompt: record.useFreePrompt,
    avatar_track: record.avatarTrack,
    caricature_asset_id: record.caricatureAssetId,
    heygen_video_id: record.heygenVideoId,
    video_url: record.videoUrl,
    caption_url: record.captionUrl,
    status: record.status,
    error_message: record.errorMessage,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

export const creativeProjectStorage = {
  async create(input: CreativeProjectCreateInput) {
    const timestamp = nowIso();
    const record: CreativeProject = {
      id: crypto.randomUUID(),
      profileId: input.profileId ?? null,
      topic: input.topic,
      personaArchetypes: input.personaArchetypes,
      voiceTones: input.voiceTones,
      scriptDraft: input.scriptDraft,
      scriptApproved: input.scriptApproved,
      freePrompt: input.freePrompt,
      useFreePrompt: input.useFreePrompt,
      avatarTrack: input.avatarTrack,
      caricatureAssetId: input.caricatureAssetId,
      heygenVideoId: input.heygenVideoId ?? null,
      videoUrl: input.videoUrl ?? "",
      captionUrl: input.captionUrl ?? "",
      status: input.status,
      errorMessage: input.errorMessage ?? "",
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from("creative_projects")
        .insert(toPayload(record))
        .select("*")
        .single();

      if (error) {
        if (isSchemaCompatibilityError(error)) {
          throwIfNoLocalSchemaFallback(error);
          const database = await readLocalDatabase();
          database.creativeProjects = [record, ...(database.creativeProjects ?? [])];
          await writeLocalDatabase(database);
          return record;
        }

        throw error;
      }

      return mapRow(data);
    }

    assertLocalFilesystemAllowed();
    const database = await readLocalDatabase();
    database.creativeProjects = [record, ...(database.creativeProjects ?? [])];
    await writeLocalDatabase(database);
    return record;
  },

  async listByProfileId(profileId: string, limit = 50) {
    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from("creative_projects")
        .select("*")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        if (isSchemaCompatibilityError(error)) {
          throwIfNoLocalSchemaFallback(error);
          const database = await readLocalDatabase();
          return (database.creativeProjects ?? [])
            .filter((item) => item.profileId === profileId)
            .sort(
              (left, right) =>
                new Date(right.createdAt).getTime() -
                new Date(left.createdAt).getTime(),
            )
            .slice(0, limit);
        }

        throw error;
      }

      return (data ?? []).map((row) => mapRow(row));
    }

    assertLocalFilesystemAllowed();
    const database = await readLocalDatabase();
    return (database.creativeProjects ?? [])
      .filter((item) => item.profileId === profileId)
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      )
      .slice(0, limit);
  },
};
