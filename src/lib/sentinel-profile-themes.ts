import {
  estadualThemeGroups,
  federalThemeGroups,
  themesInCatalog,
} from "@/lib/sphere-theme-catalog";
import type { PoliticianProfile } from "@/lib/types";

export type ProfileThemesBySphere = {
  federal: string[];
  estadual: string[];
  municipalCustom: string[];
  /** Temas de interesse usados no matching (federal + estadual + custom). */
  interest: string[];
};

export function splitProfileThemesBySphere(profile: PoliticianProfile): ProfileThemesBySphere {
  const federal = themesInCatalog(profile.sentinelThemes, federalThemeGroups);
  const estadual = themesInCatalog(profile.sentinelThemes, estadualThemeGroups);
  const municipalCustom = profile.customRadarThemes.map((theme) => theme.trim()).filter(Boolean);

  return {
    federal,
    estadual,
    municipalCustom,
    interest: [...new Set([...federal, ...estadual, ...municipalCustom])],
  };
}

export function hasFederalRadar(profile: PoliticianProfile): boolean {
  return splitProfileThemesBySphere(profile).federal.length > 0;
}

export function hasEstadualRadar(profile: PoliticianProfile): boolean {
  return splitProfileThemesBySphere(profile).estadual.length > 0;
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
