import type { MockSentinelSuggestion } from "@/lib/sentinel-mock-suggestions";

/**
 * Mantém ordem por relevanceScore, mas limita cards por themeLabel
 * para evitar feed monotemático (ex.: 16/20 Desemprego).
 * Não “completa” o total com o mesmo tema além do teto — preferir menos cards melhores.
 */
export function diversifySuggestionsByTheme(
  suggestions: MockSentinelSuggestion[],
  options: { maxTotal?: number; maxPerTheme?: number } = {},
): MockSentinelSuggestion[] {
  const maxTotal = options.maxTotal ?? 20;
  const maxPerTheme = options.maxPerTheme ?? 4;
  const perTheme = new Map<string, number>();
  const selected: MockSentinelSuggestion[] = [];

  const sorted = [...suggestions].sort(
    (left, right) => right.relevanceScore - left.relevanceScore,
  );

  for (const suggestion of sorted) {
    if (selected.length >= maxTotal) {
      break;
    }
    const theme = suggestion.themeLabel.trim() || "(sem tema)";
    const count = perTheme.get(theme) ?? 0;
    if (count >= maxPerTheme) {
      continue;
    }
    selected.push(suggestion);
    perTheme.set(theme, count + 1);
  }

  return selected;
}
