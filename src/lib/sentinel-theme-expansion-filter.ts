import { normalizeSentinelText } from "@/lib/sentinel-text";

export type SentinelThemeExpansionView = {
  sourceTheme: string;
  expandedTerms: string[];
  generatedAt: string;
};

function normalizeTheme(theme: string) {
  return theme.trim();
}

export function filterExpansionsForAllowedThemes(
  expansions: SentinelThemeExpansionView[],
  allowedThemes: string[],
) {
  const allowed = new Set(
    allowedThemes.map(normalizeTheme).map((theme) => normalizeSentinelText(theme)),
  );

  if (allowed.size === 0) {
    return [];
  }

  return expansions.filter((row) =>
    allowed.has(normalizeSentinelText(row.sourceTheme)),
  );
}

export function filterExpansionsForThemeSelection(
  expansions: SentinelThemeExpansionView[],
  selection: {
    sentinelThemes: string[];
    oppositionThemes: string[];
    customRadarThemes: string[];
  },
) {
  return filterExpansionsForAllowedThemes(expansions, [
    ...selection.sentinelThemes,
    ...selection.oppositionThemes,
    ...selection.customRadarThemes.map((theme) => theme.trim()).filter(Boolean),
  ]);
}
