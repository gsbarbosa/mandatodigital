import { archetypeOptions } from "@/lib/constants";
import type { ProfileInput } from "@/lib/schemas";
import type { PoliticianProfile } from "@/lib/types";

const DEFAULT_BIO =
  "Mandato focado em entregas concretas, linguagem clara e defesa consistente das pautas prioritarias.";

const PROFILE_CORE_DEFAULTS = {
  fullName: "Perfil em configuracao",
  role: "Mandato",
  city: "Cidade",
  state: "SP",
  audience: "Eleitorado local",
  spectrum: "",
  archetype: archetypeOptions[0] ?? "O Conciliador (Uniao/Pontes)",
  keyIssues: ["Comunicacao politica"],
  bio: DEFAULT_BIO,
} as const;

function pickString(
  value: string,
  existing: string | undefined,
  fallback: string,
  useFallback: boolean,
) {
  const trimmed = value.trim();
  if (trimmed) {
    return trimmed;
  }

  const existingTrimmed = existing?.trim();
  if (existingTrimmed) {
    return existingTrimmed;
  }

  return useFallback ? fallback : "";
}

function pickStringList(
  values: string[],
  existing: string[] | undefined,
  fallback: string[],
  useFallback: boolean,
) {
  if (values.length > 0) {
    return values;
  }

  if (existing?.length) {
    return existing;
  }

  return useFallback ? fallback : [];
}

export function mergeProfileInputForSave(
  input: ProfileInput,
  existing?: PoliticianProfile | null,
  options?: { allowDraftDefaults?: boolean },
): ProfileInput {
  const useDefaults = options?.allowDraftDefaults ?? false;

  return {
    ...input,
    fullName: pickString(
      input.fullName,
      existing?.fullName,
      PROFILE_CORE_DEFAULTS.fullName,
      useDefaults,
    ),
    role: pickString(input.role, existing?.role, PROFILE_CORE_DEFAULTS.role, useDefaults),
    city: pickString(input.city, existing?.city, PROFILE_CORE_DEFAULTS.city, useDefaults),
    state: pickString(input.state, existing?.state, PROFILE_CORE_DEFAULTS.state, useDefaults)
      .toUpperCase()
      .slice(0, 2),
    audience: pickString(
      input.audience,
      existing?.audience,
      PROFILE_CORE_DEFAULTS.audience,
      useDefaults,
    ),
    spectrum: pickString(
      input.spectrum,
      existing?.spectrum,
      PROFILE_CORE_DEFAULTS.spectrum,
      useDefaults,
    ),
    archetype: pickString(
      input.archetype,
      existing?.archetype,
      PROFILE_CORE_DEFAULTS.archetype,
      useDefaults,
    ),
    keyIssues: pickStringList(
      input.keyIssues,
      existing?.keyIssues,
      [...PROFILE_CORE_DEFAULTS.keyIssues],
      useDefaults,
    ),
    bio: pickString(input.bio, existing?.bio, PROFILE_CORE_DEFAULTS.bio, useDefaults),
    argilAvatarId: input.argilAvatarId?.trim() || existing?.argilAvatarId || "",
    argilVoiceId: input.argilVoiceId?.trim() || existing?.argilVoiceId || "",
    avatarTrainingStatus: (input.avatarTrainingStatus ||
      existing?.avatarTrainingStatus ||
      "") as ProfileInput["avatarTrainingStatus"],
  };
}
