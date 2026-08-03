import {
  canonicalizeSentinelThemes,
  estadualThemeGroups,
  federalThemeGroups,
  type SphereThemeGroup,
} from "@/lib/sphere-theme-catalog";
import type { PoliticianProfile } from "@/lib/types";

export type ProfileThemesBySphere = {
  federal: string[];
  estadual: string[];
  municipalCustom: string[];
  /** Temas de interesse usados no matching (federal + estadual + custom). */
  interest: string[];
};

export type SentinelThemeSpheres = {
  federal: string[];
  estadual: string[];
};

function catalogSet(groups: readonly SphereThemeGroup[]): Set<string> {
  return new Set(groups.flatMap((group) => [...group.options]));
}

const FEDERAL_CATALOG = catalogSet(federalThemeGroups);
const ESTADUAL_CATALOG = catalogSet(estadualThemeGroups);

/** Temas presentes nos dois catálogos (ex.: Contratos Públicos). */
export function listOverlappingSentinelThemes(): string[] {
  return [...FEDERAL_CATALOG].filter((theme) => ESTADUAL_CATALOG.has(theme)).sort();
}

/**
 * Migra perfis antigos com lista única `sentinelThemes`.
 * Temas que existem no catálogo estadual vão para estadual; o restante federal.
 */
export function migrateFlatSentinelThemes(themes: string[]): SentinelThemeSpheres {
  const federal: string[] = [];
  const estadual: string[] = [];

  for (const theme of canonicalizeSentinelThemes(themes)) {
    const inEstadual = ESTADUAL_CATALOG.has(theme);
    const inFederal = FEDERAL_CATALOG.has(theme);

    if (inEstadual) {
      estadual.push(theme);
    } else if (inFederal) {
      federal.push(theme);
    }
  }

  return { federal, estadual };
}

export function unionSentinelThemes(spheres: SentinelThemeSpheres): string[] {
  return [...new Set([...spheres.federal, ...spheres.estadual])];
}

/** Lista canônica de temas de interesse (união das colunas + legado). */
export function resolveInterestThemes(
  profile: Pick<
    PoliticianProfile,
    "sentinelThemes" | "sentinelThemesFederal" | "sentinelThemesEstadual"
  >,
): string[] {
  return unionSentinelThemes(resolveSentinelThemeSpheres(profile));
}

/**
 * Espelha a lista unificada nas colunas legacy para compatibilidade de storage/API.
 * A classificação nacional vs estadual no feed passa a vir do conteúdo/UF/portal.
 */
export function mirrorInterestThemesToSpheres(themes: string[]): SentinelThemeSpheres {
  const interest = canonicalizeSentinelThemes(themes);
  return { federal: interest, estadual: interest };
}

export function resolveSentinelThemeSpheres(
  profile: Pick<
    PoliticianProfile,
    "sentinelThemes" | "sentinelThemesFederal" | "sentinelThemesEstadual"
  >,
): SentinelThemeSpheres {
  const federal = canonicalizeSentinelThemes(profile.sentinelThemesFederal ?? []);
  const estadual = canonicalizeSentinelThemes(profile.sentinelThemesEstadual ?? []);
  const legacyThemes = canonicalizeSentinelThemes(profile.sentinelThemes ?? []);
  const hasExplicitColumns =
    profile.sentinelThemesFederal !== undefined || profile.sentinelThemesEstadual !== undefined;

  if (hasExplicitColumns) {
    if (federal.length === 0 && estadual.length === 0 && legacyThemes.length > 0) {
      // Perfis novos/unificados: sentinelThemes preenchido, colunas vazias.
      return mirrorInterestThemesToSpheres(legacyThemes);
    }

    return { federal, estadual };
  }

  return mirrorInterestThemesToSpheres(legacyThemes);
}

export function splitProfileThemesBySphere(profile: PoliticianProfile): ProfileThemesBySphere {
  const interest = resolveInterestThemes(profile);
  const municipalCustom = profile.customRadarThemes.map((theme) => theme.trim()).filter(Boolean);

  return {
    // Espelha a lista unificada — RSS/portais usam hasFederal/hasEstadual + UF.
    federal: interest,
    estadual: interest,
    municipalCustom,
    interest: [...new Set([...interest, ...municipalCustom])],
  };
}

export function hasFederalRadar(profile: PoliticianProfile): boolean {
  return resolveInterestThemes(profile).length > 0;
}

export function hasEstadualRadar(profile: PoliticianProfile): boolean {
  return resolveInterestThemes(profile).length > 0 && profile.state.trim().length === 2;
}

export function hasMunicipalRadar(profile: PoliticianProfile): boolean {
  const { municipalCustom } = splitProfileThemesBySphere(profile);
  return (
    municipalCustom.length > 0 ||
    profile.municipalCities.some((city) => city.trim()) ||
    profile.interestSites.some((site) => site.trim())
  );
}

export function hasInterestRadar(profile: PoliticianProfile): boolean {
  return profile.interestProfiles.some((row) => row.handle.trim());
}

export function hasAdversaryRadar(profile: PoliticianProfile): boolean {
  return profile.oppositionProfiles.some((row) => row.handle.trim());
}

/**
 * Verdadeiro se houver qualquer configuração de monitoramento (radar) capaz de gerar pautas.
 * Aceita tanto `PoliticianProfile` (servidor) quanto `ProfileFormState` (cliente) — só usa os
 * campos comuns aos dois, sem depender do restante do perfil (nome, bio, avatar etc.).
 */
export function hasAnyMonitoringRadarConfigured(
  profile: Pick<
    PoliticianProfile,
    | "sentinelThemes"
    | "sentinelThemesFederal"
    | "sentinelThemesEstadual"
    | "customRadarThemes"
    | "municipalCities"
    | "interestSites"
    | "interestProfiles"
    | "oppositionProfiles"
  >,
): boolean {
  return (
    resolveInterestThemes(profile).length > 0 ||
    profile.customRadarThemes.some((theme) => theme.trim()) ||
    profile.municipalCities.some((city) => city.trim()) ||
    profile.interestSites.some((site) => site.trim()) ||
    profile.interestProfiles.some((row) => row.handle.trim()) ||
    profile.oppositionProfiles.some((row) => row.handle.trim())
  );
}
