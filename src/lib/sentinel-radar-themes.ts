import { oppositionThemeGroups, sentinelThemeGroups } from "@/lib/constants";
import { normalizeSentinelText } from "@/lib/sentinel-text";

function dedupeByNormalized(themes: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const theme of themes) {
    const trimmed = theme.trim();
    if (!trimmed) {
      continue;
    }

    const key = normalizeSentinelText(trimmed);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(trimmed);
  }

  return result;
}

export function getMandateCatalogThemes(): readonly string[] {
  return sentinelThemeGroups.flatMap((group) => group.options);
}

export function getOppositionCatalogThemes(): readonly string[] {
  return oppositionThemeGroups.flatMap((group) => group.options);
}

function catalogNormalizedSet(catalog: readonly string[]): Set<string> {
  return new Set(catalog.map((theme) => normalizeSentinelText(theme)));
}

export function isRadarThemeSelected(values: string[], catalogOption: string): boolean {
  const target = normalizeSentinelText(catalogOption);
  return values.some((value) => normalizeSentinelText(value) === target);
}

/**
 * Mantém só rótulos exatos do catálogo ou temas personalizados (fora do catálogo).
 * Variantes sem acento geradas no passado (ex.: "Contratos Publicos") são descartadas
 * para não ficarem fantasmas no perfil nem na expansão LLM.
 */
export function sanitizeMandateThemesOnLoad(values: string[]): string[] {
  const catalog = getMandateCatalogThemes();
  const catalogNorm = catalogNormalizedSet(catalog);
  const exactMatches = values.filter((value) =>
    catalog.includes(value as (typeof catalog)[number]),
  );
  const customs = values.filter((value) => {
    const trimmed = value.trim();
    return trimmed && !catalogNorm.has(normalizeSentinelText(trimmed));
  });

  return dedupeByNormalized([...exactMatches, ...customs]);
}

export function sanitizeOppositionThemesOnLoad(values: string[]): string[] {
  const catalog = getOppositionCatalogThemes();
  const catalogNorm = catalogNormalizedSet(catalog);
  const exactMatches = values.filter((value) =>
    catalog.includes(value as (typeof catalog)[number]),
  );
  const customs = values.filter((value) => {
    const trimmed = value.trim();
    return trimmed && !catalogNorm.has(normalizeSentinelText(trimmed));
  });

  return dedupeByNormalized([...exactMatches, ...customs]);
}

export function updateRadarThemeToggle(values: string[], catalogOption: string): string[] {
  const target = normalizeSentinelText(catalogOption);
  const isOn = values.some((value) => normalizeSentinelText(value) === target);

  if (isOn) {
    return values.filter((value) => normalizeSentinelText(value) !== target);
  }

  return dedupeByNormalized([
    ...values.filter((value) => normalizeSentinelText(value) !== target),
    catalogOption,
  ]);
}
