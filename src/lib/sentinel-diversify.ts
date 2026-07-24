import type { MockSentinelSuggestion } from "@/lib/sentinel-mock-suggestions";

/**
 * Mantém ordem por relevanceScore, mas limita cards por themeLabel
 * e favorece mistura de pipelines (portal/manual/semantic).
 */
export function diversifySuggestionsByTheme(
  suggestions: MockSentinelSuggestion[],
  options: {
    maxTotal?: number;
    maxPerTheme?: number;
    maxPerPipeline?: number;
  } = {},
): MockSentinelSuggestion[] {
  const maxTotal = options.maxTotal ?? 20;
  const maxPerTheme = options.maxPerTheme ?? 4;
  const maxPerPipeline = options.maxPerPipeline ?? 10;
  const perTheme = new Map<string, number>();
  const perPipeline = new Map<string, number>();
  const selected: MockSentinelSuggestion[] = [];

  const sorted = [...suggestions].sort(
    (left, right) => right.relevanceScore - left.relevanceScore,
  );

  for (const suggestion of sorted) {
    if (selected.length >= maxTotal) {
      break;
    }
    const theme = suggestion.themeLabel.trim() || "(sem tema)";
    const pipeline = suggestion.pipeline?.trim() || "legacy";
    const themeCount = perTheme.get(theme) ?? 0;
    const pipelineCount = perPipeline.get(pipeline) ?? 0;
    if (themeCount >= maxPerTheme) {
      continue;
    }
    if (pipelineCount >= maxPerPipeline) {
      continue;
    }
    selected.push(suggestion);
    perTheme.set(theme, themeCount + 1);
    perPipeline.set(pipeline, pipelineCount + 1);
  }

  return selected;
}

/**
 * Intercala cards de temas distintos (round-robin) para o topo do feed
 * não ficar monotemático mesmo com scores altos no mesmo tema.
 */
export function interleaveSuggestionsByTheme(
  suggestions: MockSentinelSuggestion[],
): MockSentinelSuggestion[] {
  if (suggestions.length <= 2) {
    return suggestions;
  }

  const byTheme = new Map<string, MockSentinelSuggestion[]>();
  for (const suggestion of suggestions) {
    const theme = suggestion.themeLabel.trim() || "(sem tema)";
    const list = byTheme.get(theme) ?? [];
    list.push(suggestion);
    byTheme.set(theme, list);
  }

  if (byTheme.size <= 1) {
    return suggestions;
  }

  const queues = [...byTheme.values()].map((list) =>
    [...list].sort((left, right) => right.relevanceScore - left.relevanceScore),
  );
  const result: MockSentinelSuggestion[] = [];

  while (result.length < suggestions.length) {
    let progressed = false;
    for (const queue of queues) {
      const next = queue.shift();
      if (next) {
        result.push(next);
        progressed = true;
      }
    }
    if (!progressed) {
      break;
    }
  }

  return result;
}
