import {
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

/** Temas presentes nos dois catálogos (ex.: Contratos Publicos). */
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

  for (const theme of themes) {
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

export function resolveSentinelThemeSpheres(
  profile: Pick<
    PoliticianProfile,
    "sentinelThemes" | "sentinelThemesFederal" | "sentinelThemesEstadual"
  >,
): SentinelThemeSpheres {
  const federal = profile.sentinelThemesFederal ?? [];
  const estadual = profile.sentinelThemesEstadual ?? [];
  const legacyThemes = profile.sentinelThemes ?? [];
  const hasExplicitColumns =
    profile.sentinelThemesFederal !== undefined || profile.sentinelThemesEstadual !== undefined;

  if (hasExplicitColumns) {
    if (federal.length === 0 && estadual.length === 0 && legacyThemes.length > 0) {
      return migrateFlatSentinelThemes(legacyThemes);
    }

    return { federal, estadual };
  }

  return migrateFlatSentinelThemes(legacyThemes);
}

export function splitProfileThemesBySphere(profile: PoliticianProfile): ProfileThemesBySphere {
  const { federal, estadual } = resolveSentinelThemeSpheres(profile);
  const municipalCustom = profile.customRadarThemes.map((theme) => theme.trim()).filter(Boolean);

  return {
    federal,
    estadual,
    municipalCustom,
    interest: [...new Set([...federal, ...estadual, ...municipalCustom])],
  };
}

export function hasFederalRadar(profile: PoliticianProfile): boolean {
  return resolveSentinelThemeSpheres(profile).federal.length > 0;
}

export function hasEstadualRadar(profile: PoliticianProfile): boolean {
  return resolveSentinelThemeSpheres(profile).estadual.length > 0;
}

export function hasMunicipalRadar(profile: PoliticianProfile): boolean {
  const { municipalCustom } = splitProfileThemesBySphere(profile);
  return (
    municipalCustom.length > 0 ||
    profile.interestSites.some((site) => site.trim()) ||
    profile.interestProfiles.some((row) => row.handle.trim())
  );
}

export function hasAdversaryRadar(profile: PoliticianProfile): boolean {
  return profile.oppositionProfiles.some((row) => row.handle.trim());
}
