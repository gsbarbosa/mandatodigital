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

const PROFILE_FIELD_MIN = {
  fullName: 3,
  role: 2,
  city: 2,
  state: 2,
  audience: 3,
  archetype: 3,
  bio: 20,
} as const;

function hasMinLength(value: string, min: number) {
  return value.trim().length >= min;
}

function pickString(
  value: string,
  existing: string | undefined,
  fallback: string,
  useFallback: boolean,
  minLength = 1,
) {
  const trimmed = value.trim();
  if (trimmed && hasMinLength(trimmed, minLength)) {
    return trimmed;
  }

  const existingTrimmed = existing?.trim();
  if (existingTrimmed && hasMinLength(existingTrimmed, minLength)) {
    return existingTrimmed;
  }

  return useFallback ? fallback : trimmed;
}

function pickStringList(
  values: string[],
  existing: string[] | undefined,
  fallback: string[],
  useFallback: boolean,
) {
  const normalizedValues = values.map((value) => value.trim()).filter(Boolean);
  if (normalizedValues.length > 0) {
    return normalizedValues;
  }

  const normalizedExisting = existing?.map((value) => value.trim()).filter(Boolean) ?? [];
  if (normalizedExisting.length > 0) {
    return normalizedExisting;
  }

  return useFallback ? fallback : [];
}

function finalizeDraftProfileInput(input: ProfileInput): ProfileInput {
  const state = input.state.trim().toUpperCase().slice(0, 2);

  return {
    ...input,
    fullName: hasMinLength(input.fullName, PROFILE_FIELD_MIN.fullName)
      ? input.fullName.trim()
      : PROFILE_CORE_DEFAULTS.fullName,
    role: hasMinLength(input.role, PROFILE_FIELD_MIN.role)
      ? input.role.trim()
      : PROFILE_CORE_DEFAULTS.role,
    city: hasMinLength(input.city, PROFILE_FIELD_MIN.city)
      ? input.city.trim()
      : PROFILE_CORE_DEFAULTS.city,
    state: hasMinLength(state, PROFILE_FIELD_MIN.state) ? state : PROFILE_CORE_DEFAULTS.state,
    audience: hasMinLength(input.audience, PROFILE_FIELD_MIN.audience)
      ? input.audience.trim()
      : PROFILE_CORE_DEFAULTS.audience,
    archetype: hasMinLength(input.archetype, PROFILE_FIELD_MIN.archetype)
      ? input.archetype.trim()
      : PROFILE_CORE_DEFAULTS.archetype,
    keyIssues:
      input.keyIssues.map((value) => value.trim()).filter(Boolean).length > 0
        ? input.keyIssues.map((value) => value.trim()).filter(Boolean)
        : [...PROFILE_CORE_DEFAULTS.keyIssues],
    bio: hasMinLength(input.bio, PROFILE_FIELD_MIN.bio)
      ? input.bio.trim()
      : PROFILE_CORE_DEFAULTS.bio,
  };
}

export function mergeProfileInputForSave(
  input: ProfileInput,
  existing?: PoliticianProfile | null,
  options?: { allowDraftDefaults?: boolean },
): ProfileInput {
  const useDefaults = options?.allowDraftDefaults ?? false;

  const merged: ProfileInput = {
    ...input,
    fullName: pickString(
      input.fullName,
      existing?.fullName,
      PROFILE_CORE_DEFAULTS.fullName,
      useDefaults,
      PROFILE_FIELD_MIN.fullName,
    ),
    role: pickString(
      input.role,
      existing?.role,
      PROFILE_CORE_DEFAULTS.role,
      useDefaults,
      PROFILE_FIELD_MIN.role,
    ),
    city: pickString(
      input.city,
      existing?.city,
      PROFILE_CORE_DEFAULTS.city,
      useDefaults,
      PROFILE_FIELD_MIN.city,
    ),
    state: pickString(
      input.state,
      existing?.state,
      PROFILE_CORE_DEFAULTS.state,
      useDefaults,
      PROFILE_FIELD_MIN.state,
    )
      .toUpperCase()
      .slice(0, 2),
    audience: pickString(
      input.audience,
      existing?.audience,
      PROFILE_CORE_DEFAULTS.audience,
      useDefaults,
      PROFILE_FIELD_MIN.audience,
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
      PROFILE_FIELD_MIN.archetype,
    ),
    keyIssues: pickStringList(
      input.keyIssues,
      existing?.keyIssues,
      [...PROFILE_CORE_DEFAULTS.keyIssues],
      useDefaults,
    ),
    bio: pickString(
      input.bio,
      existing?.bio,
      PROFILE_CORE_DEFAULTS.bio,
      useDefaults,
      PROFILE_FIELD_MIN.bio,
    ),
  };

  return useDefaults ? finalizeDraftProfileInput(merged) : merged;
}
