import { promises as fs } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import {
  assertLocalFilesystemAllowed,
  canUseLocalFilesystem,
  supabaseSchemaOutdatedMessage,
} from "@/lib/server-runtime";
import type { AvatarTrainingStatus, ProfileAvatarTraining } from "@/lib/types";

const DATABASE_PATH = path.join(process.cwd(), "data", "mandato-digital.json");

type ProfileAvatarTrainingCreateInput = {
  profileId?: string | null;
  draftProfileId?: string | null;
  argilAvatarId?: string | null;
  argilVoiceId?: string | null;
  status: AvatarTrainingStatus;
  dryRun: boolean;
  datasetAssetId?: string | null;
  consentAssetId?: string | null;
  voiceAudioAssetId?: string | null;
  avatarName: string;
  errorMessage?: string;
};

type ProfileAvatarTrainingUpdateInput = Partial<
  Pick<
    ProfileAvatarTraining,
    | "argilAvatarId"
    | "argilVoiceId"
    | "status"
    | "errorMessage"
  >
>;

type LocalDatabase = {
  profileAvatarTrainings?: ProfileAvatarTraining[];
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

function mapRow(row: Record<string, unknown>): ProfileAvatarTraining {
  return {
    id: String(row.id),
    profileId: row.profile_id === null ? null : String(row.profile_id),
    draftProfileId:
      row.draft_profile_id === null ? null : String(row.draft_profile_id),
    argilAvatarId: row.argil_avatar_id === null ? null : String(row.argil_avatar_id),
    argilVoiceId: row.argil_voice_id === null ? null : String(row.argil_voice_id),
    status: String(row.status ?? "TRAINING") as AvatarTrainingStatus,
    dryRun: Boolean(row.dry_run ?? false),
    datasetAssetId:
      row.dataset_asset_id === null ? null : String(row.dataset_asset_id),
    consentAssetId:
      row.consent_asset_id === null ? null : String(row.consent_asset_id),
    voiceAudioAssetId:
      row.voice_audio_asset_id === null || row.voice_audio_asset_id === undefined
        ? row.consent_asset_id === null
          ? null
          : String(row.consent_asset_id)
        : String(row.voice_audio_asset_id),
    avatarName: String(row.avatar_name ?? ""),
    errorMessage: String(row.error_message ?? ""),
    createdAt: String(row.created_at ?? nowIso()),
    updatedAt: String(row.updated_at ?? nowIso()),
  };
}

export const avatarTrainingStorage = {
  async create(input: ProfileAvatarTrainingCreateInput) {
    const timestamp = nowIso();
    const record: ProfileAvatarTraining = {
      id: crypto.randomUUID(),
      profileId: input.profileId ?? null,
      draftProfileId: input.draftProfileId ?? null,
      argilAvatarId: input.argilAvatarId ?? null,
      argilVoiceId: input.argilVoiceId ?? null,
      status: input.status,
      dryRun: input.dryRun,
      datasetAssetId: input.datasetAssetId ?? null,
      consentAssetId: input.consentAssetId ?? null,
      voiceAudioAssetId: input.voiceAudioAssetId ?? input.consentAssetId ?? null,
      avatarName: input.avatarName,
      errorMessage: input.errorMessage ?? "",
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();
      const payload = {
        id: record.id,
        profile_id: record.profileId,
        draft_profile_id: record.draftProfileId,
        argil_avatar_id: record.argilAvatarId,
        argil_voice_id: record.argilVoiceId,
        status: record.status,
        dry_run: record.dryRun,
        dataset_asset_id: record.datasetAssetId,
        consent_asset_id: record.consentAssetId,
        voice_audio_asset_id: record.voiceAudioAssetId,
        avatar_name: record.avatarName,
        error_message: record.errorMessage,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
      };

      const { data, error } = await client
        .from("profile_avatar_trainings")
        .insert(payload)
        .select("*")
        .single();

      if (error) {
        if (isSchemaCompatibilityError(error)) {
          throwIfNoLocalSchemaFallback(error);

          const database = await readLocalDatabase();
          database.profileAvatarTrainings = [
            record,
            ...(database.profileAvatarTrainings ?? []),
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
    database.profileAvatarTrainings = [
      record,
      ...(database.profileAvatarTrainings ?? []),
    ];
    await writeLocalDatabase(database);
    return record;
  },

  async getById(id: string) {
    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from("profile_avatar_trainings")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        if (isSchemaCompatibilityError(error)) {
          throwIfNoLocalSchemaFallback(error);
          const database = await readLocalDatabase();
          return (
            database.profileAvatarTrainings?.find((item) => item.id === id) ?? null
          );
        }

        throw error;
      }

      return data ? mapRow(data) : null;
    }

    assertLocalFilesystemAllowed();
    const database = await readLocalDatabase();
    return database.profileAvatarTrainings?.find((item) => item.id === id) ?? null;
  },

  async getLatestByProfileId(profileId: string) {
    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from("profile_avatar_trainings")
        .select("*")
        .eq("profile_id", profileId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        if (isSchemaCompatibilityError(error)) {
          throwIfNoLocalSchemaFallback(error);
          const database = await readLocalDatabase();
          const matches =
            database.profileAvatarTrainings?.filter(
              (item) => item.profileId === profileId,
            ) ?? [];
          return (
            matches.sort(
              (left, right) =>
                new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
            )[0] ?? null
          );
        }

        throw error;
      }

      return data ? mapRow(data) : null;
    }

    assertLocalFilesystemAllowed();
    const database = await readLocalDatabase();
    const matches =
      database.profileAvatarTrainings?.filter((item) => item.profileId === profileId) ??
      [];
    return (
      matches.sort(
        (left, right) =>
          new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
      )[0] ?? null
    );
  },

  async getByArgilAvatarId(argilAvatarId: string) {
    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from("profile_avatar_trainings")
        .select("*")
        .eq("argil_avatar_id", argilAvatarId)
        .maybeSingle();

      if (error) {
        if (isSchemaCompatibilityError(error)) {
          throwIfNoLocalSchemaFallback(error);
          const database = await readLocalDatabase();
          return (
            database.profileAvatarTrainings?.find(
              (item) => item.argilAvatarId === argilAvatarId,
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
      database.profileAvatarTrainings?.find(
        (item) => item.argilAvatarId === argilAvatarId,
      ) ?? null
    );
  },

  async update(id: string, input: ProfileAvatarTrainingUpdateInput) {
    const timestamp = nowIso();

    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();
      const payload: Record<string, string | null> = {
        updated_at: timestamp,
      };

      if ("argilAvatarId" in input) payload.argil_avatar_id = input.argilAvatarId ?? null;
      if ("argilVoiceId" in input) payload.argil_voice_id = input.argilVoiceId ?? null;
      if (input.status) payload.status = input.status;
      if (input.errorMessage !== undefined) payload.error_message = input.errorMessage;

      const { data, error } = await client
        .from("profile_avatar_trainings")
        .update(payload)
        .eq("id", id)
        .select("*")
        .single();

      if (error) {
        if (isSchemaCompatibilityError(error)) {
          throwIfNoLocalSchemaFallback(error);
          const database = await readLocalDatabase();
          const index =
            database.profileAvatarTrainings?.findIndex((item) => item.id === id) ?? -1;

          if (index === -1) {
            throw new Error("Treinamento de avatar não encontrado.");
          }

          const current = database.profileAvatarTrainings![index];
          const updated = {
            ...current,
            ...input,
            updatedAt: timestamp,
          };
          database.profileAvatarTrainings![index] = updated;
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
      database.profileAvatarTrainings?.findIndex((item) => item.id === id) ?? -1;

    if (index === -1) {
      throw new Error("Treinamento de avatar não encontrado.");
    }

    const current = database.profileAvatarTrainings![index];
    const updated = {
      ...current,
      ...input,
      updatedAt: timestamp,
    };
    database.profileAvatarTrainings![index] = updated;
    await writeLocalDatabase(database);
    return updated;
  },
};

export function isAvatarTrainingTerminal(status: string) {
  return status === "IDLE" || status === "TRAINING_FAILED" || status === "REFUSED";
}
