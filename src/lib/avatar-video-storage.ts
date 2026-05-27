import { promises as fs } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import {
  assertLocalFilesystemAllowed,
  canUseLocalFilesystem,
  supabaseSchemaOutdatedMessage,
} from "@/lib/server-runtime";
import type { AvatarVideoGeneration, AvatarVideoGenerationStatus } from "@/lib/types";

const DATABASE_PATH = path.join(process.cwd(), "data", "mandato-digital.json");

type AvatarVideoGenerationCreateInput = {
  profileId?: string | null;
  topic: string;
  transcript: string;
  name: string;
  dryRun: boolean;
  argilVideoId?: string | null;
  status: AvatarVideoGenerationStatus;
  previewUrl?: string;
  videoUrl?: string;
  videoUrlSubtitled?: string;
  errorMessage?: string;
};

type AvatarVideoGenerationUpdateInput = Partial<
  Pick<
    AvatarVideoGeneration,
    | "argilVideoId"
    | "status"
    | "previewUrl"
    | "videoUrl"
    | "videoUrlSubtitled"
    | "errorMessage"
  >
>;

type LocalDatabase = {
  avatarVideoGenerations?: AvatarVideoGeneration[];
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

function mapRow(row: Record<string, unknown>): AvatarVideoGeneration {
  return {
    id: String(row.id),
    profileId: row.profile_id === null ? null : String(row.profile_id),
    topic: String(row.topic ?? ""),
    transcript: String(row.transcript ?? ""),
    name: String(row.name ?? ""),
    argilVideoId: row.argil_video_id === null ? null : String(row.argil_video_id),
    status: String(row.status ?? "IDLE") as AvatarVideoGenerationStatus,
    dryRun: Boolean(row.dry_run ?? false),
    previewUrl: String(row.preview_url ?? ""),
    videoUrl: String(row.video_url ?? ""),
    videoUrlSubtitled: String(row.video_url_subtitled ?? ""),
    errorMessage: String(row.error_message ?? ""),
    createdAt: String(row.created_at ?? nowIso()),
    updatedAt: String(row.updated_at ?? nowIso()),
  };
}

export const avatarVideoStorage = {
  async create(input: AvatarVideoGenerationCreateInput) {
    const timestamp = nowIso();
    const record: AvatarVideoGeneration = {
      id: crypto.randomUUID(),
      profileId: input.profileId ?? null,
      topic: input.topic,
      transcript: input.transcript,
      name: input.name,
      argilVideoId: input.argilVideoId ?? null,
      status: input.status,
      dryRun: input.dryRun,
      previewUrl: input.previewUrl ?? "",
      videoUrl: input.videoUrl ?? "",
      videoUrlSubtitled: input.videoUrlSubtitled ?? "",
      errorMessage: input.errorMessage ?? "",
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();
      const payload = {
        id: record.id,
        profile_id: record.profileId,
        topic: record.topic,
        transcript: record.transcript,
        name: record.name,
        argil_video_id: record.argilVideoId,
        status: record.status,
        dry_run: record.dryRun,
        preview_url: record.previewUrl,
        video_url: record.videoUrl,
        video_url_subtitled: record.videoUrlSubtitled,
        error_message: record.errorMessage,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
      };

      const { data, error } = await client
        .from("avatar_video_generations")
        .insert(payload)
        .select("*")
        .single();

      if (error) {
        if (isSchemaCompatibilityError(error)) {
          throwIfNoLocalSchemaFallback(error);
          const database = await readLocalDatabase();
          database.avatarVideoGenerations = [
            record,
            ...(database.avatarVideoGenerations ?? []),
          ];
          await writeLocalDatabase(database);
          return record;
        }

        throw error;
      }

      return mapRow(data);
    }

    assertLocalFilesystemAllowed();
    const database = await readLocalDatabase();
    database.avatarVideoGenerations = [
      record,
      ...(database.avatarVideoGenerations ?? []),
    ];
    await writeLocalDatabase(database);
    return record;
  },

  async getById(id: string) {
    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from("avatar_video_generations")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        if (isSchemaCompatibilityError(error)) {
          throwIfNoLocalSchemaFallback(error);
          const database = await readLocalDatabase();
          return (
            database.avatarVideoGenerations?.find((item) => item.id === id) ?? null
          );
        }

        throw error;
      }

      return data ? mapRow(data) : null;
    }

    assertLocalFilesystemAllowed();
    const database = await readLocalDatabase();
    return database.avatarVideoGenerations?.find((item) => item.id === id) ?? null;
  },

  async getByArgilVideoId(argilVideoId: string) {
    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from("avatar_video_generations")
        .select("*")
        .eq("argil_video_id", argilVideoId)
        .maybeSingle();

      if (error) {
        if (isSchemaCompatibilityError(error)) {
          throwIfNoLocalSchemaFallback(error);
          const database = await readLocalDatabase();
          return (
            database.avatarVideoGenerations?.find(
              (item) => item.argilVideoId === argilVideoId,
            ) ?? null
          );
        }

        throw error;
      }

      return data ? mapRow(data) : null;
    }

    assertLocalFilesystemAllowed();
    const database = await readLocalDatabase();
    return (
      database.avatarVideoGenerations?.find(
        (item) => item.argilVideoId === argilVideoId,
      ) ?? null
    );
  },

  async update(id: string, input: AvatarVideoGenerationUpdateInput) {
    const timestamp = nowIso();

    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();
      const payload: Record<string, string | null | boolean> = {
        updated_at: timestamp,
      };

      if ("argilVideoId" in input) payload.argil_video_id = input.argilVideoId ?? null;
      if (input.status) payload.status = input.status;
      if (input.previewUrl !== undefined) payload.preview_url = input.previewUrl;
      if (input.videoUrl !== undefined) payload.video_url = input.videoUrl;
      if (input.videoUrlSubtitled !== undefined) {
        payload.video_url_subtitled = input.videoUrlSubtitled;
      }
      if (input.errorMessage !== undefined) payload.error_message = input.errorMessage;

      const { data, error } = await client
        .from("avatar_video_generations")
        .update(payload)
        .eq("id", id)
        .select("*")
        .single();

      if (error) {
        if (isSchemaCompatibilityError(error)) {
          throwIfNoLocalSchemaFallback(error);
          const database = await readLocalDatabase();
          const index =
            database.avatarVideoGenerations?.findIndex((item) => item.id === id) ?? -1;

          if (index === -1) {
            throw new Error("Geracao de video nao encontrada.");
          }

          const current = database.avatarVideoGenerations![index];
          const updated = {
            ...current,
            ...input,
            updatedAt: timestamp,
          };
          database.avatarVideoGenerations![index] = updated;
          await writeLocalDatabase(database);
          return updated;
        }

        throw error;
      }

      return mapRow(data);
    }

    assertLocalFilesystemAllowed();
    const database = await readLocalDatabase();
    const index =
      database.avatarVideoGenerations?.findIndex((item) => item.id === id) ?? -1;

    if (index === -1) {
      throw new Error("Geracao de video nao encontrada.");
    }

    const current = database.avatarVideoGenerations![index];
    const updated = {
      ...current,
      ...input,
      updatedAt: timestamp,
    };
    database.avatarVideoGenerations![index] = updated;
    await writeLocalDatabase(database);
    return updated;
  },
};
