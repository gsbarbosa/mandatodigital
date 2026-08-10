import type { MockSentinelSuggestion } from "@/lib/sentinel-mock-suggestions";
import { articlesAreLikelySameStory, batchCommonWords } from "@/lib/sentinel-rss";
import {
  articleOutletLabel,
  classifySuggestionSphere,
  ESTADUAL_MAX_AGE_DAYS,
  isOlderThanSphereWindow,
  NATIONAL_MAX_AGE_DAYS,
  type MonitorSphere,
} from "@/lib/sphere-classifier";
import type { PoliticianProfile } from "@/lib/types";

/** Teto padrão por tema no topo do feed — com 5 temas/esfera, 4+ virava monotema. */
export const SENTINEL_DEFAULT_MAX_PER_THEME = 3;

/** Com radar amplo, aperta o teto para forçar cobertura entre esferas. */
export function resolveMaxPerTheme(radarThemeCount: number) {
  if (radarThemeCount >= 8) {
    return 2;
  }
  if (radarThemeCount >= 5) {
    return SENTINEL_DEFAULT_MAX_PER_THEME;
  }
  return 4;
}

function suggestionPrimaryTitle(suggestion: MockSentinelSuggestion) {
  return suggestion.evidence.articles?.[0]?.title?.trim() || suggestion.topic;
}

function suggestionStoryInput(suggestion: MockSentinelSuggestion) {
  const article = suggestion.evidence.articles?.[0];
  return {
    title: suggestionPrimaryTitle(suggestion),
    themeLabel: suggestion.themeLabel,
    publishedAt: article?.publishedAt ?? null,
    outlet: article ? articleOutletLabel(article) : null,
  };
}

/**
 * Mantém só o card de maior score quando os títulos descrevem a mesma pauta
 * (parafraseada / multi-outlet já não clusterizado). Por padrão só compara
 * dentro do mesmo themeLabel; `ignoreTheme` compara todos entre si — para
 * pegar a mesma notícia que casou com dois temas diferentes do radar.
 */
export function collapseNearDuplicateSuggestions(
  suggestions: MockSentinelSuggestion[],
  options: { ignoreTheme?: boolean } = {},
): MockSentinelSuggestion[] {
  const ignoreTheme = options.ignoreTheme ?? false;
  const sorted = [...suggestions].sort(
    (left, right) => right.relevanceScore - left.relevanceScore,
  );
  const kept: MockSentinelSuggestion[] = [];

  const groupKeyOf = (suggestion: MockSentinelSuggestion) =>
    ignoreTheme ? "*" : suggestion.themeLabel.trim() || "(sem tema)";

  const titlesByGroup = new Map<string, string[]>();
  for (const suggestion of sorted) {
    const group = groupKeyOf(suggestion);
    const list = titlesByGroup.get(group) ?? [];
    list.push(suggestionPrimaryTitle(suggestion));
    titlesByGroup.set(group, list);
  }
  const commonWordsByGroup = new Map<string, Set<string>>();
  for (const [group, titles] of titlesByGroup.entries()) {
    commonWordsByGroup.set(group, batchCommonWords(titles));
  }

  for (const candidate of sorted) {
    const candidateGroup = groupKeyOf(candidate);
    const commonWords = commonWordsByGroup.get(candidateGroup);
    const isDup = kept.some((existing) => {
      if (!ignoreTheme && groupKeyOf(existing) !== candidateGroup) {
        return false;
      }
      return articlesAreLikelySameStory(
        suggestionStoryInput(existing),
        suggestionStoryInput(candidate),
        commonWords,
      );
    });
    if (!isDup) {
      kept.push(candidate);
    }
  }

  return kept;
}

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
  const maxPerTheme = options.maxPerTheme ?? SENTINEL_DEFAULT_MAX_PER_THEME;
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

/** Pipeline padrão pós-score: near-dup → diversify → interleave. */
export function finalizeSuggestionFeed(
  suggestions: MockSentinelSuggestion[],
  options: {
    maxTotal?: number;
    maxPerTheme?: number;
    maxPerPipeline?: number;
  } = {},
): MockSentinelSuggestion[] {
  return interleaveSuggestionsByTheme(
    diversifySuggestionsByTheme(collapseNearDuplicateSuggestions(suggestions), {
      maxTotal: options.maxTotal ?? 20,
      maxPerTheme: options.maxPerTheme ?? SENTINEL_DEFAULT_MAX_PER_THEME,
      maxPerPipeline: options.maxPerPipeline ?? 10,
    }),
  );
}

const SPHERES_TO_GUARANTEE: readonly MonitorSphere[] = ["federal", "estadual", "municipal"];

/** Nacional/estadual somem de novo na tela se a matéria promovida for mais velha
 * que o prazo do filtro de idade (ver groupSuggestionsBySphere) — municipal não
 * tem esse filtro. */
const SPHERE_AGE_WINDOW_DAYS: Partial<Record<MonitorSphere, number>> = {
  federal: NATIONAL_MAX_AGE_DAYS,
  estadual: ESTADUAL_MAX_AGE_DAYS,
};

export type SphereRescueCandidateGroup = {
  sphere: MonitorSphere;
  /** Quantas pautas faltam pra esfera bater o mínimo. */
  needed: number;
  /** Candidatos fora de `selected`, já ordenados (sobrevivente da janela de idade primeiro
   * em federal/estadual, depois por relevanceScore). Pode ser vazio. */
  candidates: MockSentinelSuggestion[];
};

/**
 * Monta, pra cada esfera geográfica abaixo do mínimo, a lista ordenada de candidatos
 * disponíveis pra preencher a lacuna — sem decidir quem promover. Extraído de
 * `ensureMinimumSphereRepresentation` pra permitir que `rescueZeroedSpheres`
 * (@/lib/sentinel-sphere-rescue) troque a escolha cega por score por uma decisão de IA,
 * reaproveitando a mesma regra de shortlist.
 *
 * O teto por tema (maxPerTheme) é compartilhado entre as 3 esferas geográficas —
 * numa conta com radar bem local, a cobertura municipal/estadual costuma pontuar
 * mais alto pro mesmo tema (mais fontes cobrindo o mesmo fato, bônus de cidade
 * monitorada) e pode varrer a cota inteira, deixando Nacional sem nenhuma pauta
 * mesmo havendo candidato disponível — preferindo, entre os candidatos disponíveis,
 * um que sobreviva ao filtro de idade da esfera (senão a promoção "ganha" no
 * servidor e some de novo na tela).
 */
export function buildSphereRescueCandidateGroups(input: {
  selected: MockSentinelSuggestion[];
  allCandidates: MockSentinelSuggestion[];
  profile: PoliticianProfile;
  minPerSphere?: number;
}): SphereRescueCandidateGroup[] {
  const minPerSphere = input.minPerSphere ?? 1;

  const sphereOf = (suggestion: MockSentinelSuggestion): MonitorSphere =>
    classifySuggestionSphere(
      suggestion,
      input.profile.interestSites,
      input.profile.state,
      input.profile.customRadarThemes,
      {
        federal: input.profile.sentinelThemesFederal,
        estadual: input.profile.sentinelThemesEstadual,
      },
      input.profile.municipalCities,
    );

  const resultIds = new Set(input.selected.map((suggestion) => suggestion.id));
  const countBySphere = new Map<MonitorSphere, number>();
  for (const suggestion of input.selected) {
    const sphere = sphereOf(suggestion);
    countBySphere.set(sphere, (countBySphere.get(sphere) ?? 0) + 1);
  }

  const groups: SphereRescueCandidateGroup[] = [];

  for (const sphere of SPHERES_TO_GUARANTEE) {
    const current = countBySphere.get(sphere) ?? 0;
    if (current >= minPerSphere) {
      continue;
    }
    const candidatesForSphere = input.allCandidates
      .filter((candidate) => !resultIds.has(candidate.id) && sphereOf(candidate) === sphere)
      .sort((left, right) => right.relevanceScore - left.relevanceScore);

    const maxAgeDays = SPHERE_AGE_WINDOW_DAYS[sphere];
    const ordered = maxAgeDays
      ? [...candidatesForSphere].sort((left, right) => {
          const leftSurvives = !isOlderThanSphereWindow(left, maxAgeDays);
          const rightSurvives = !isOlderThanSphereWindow(right, maxAgeDays);
          if (leftSurvives !== rightSurvives) {
            return leftSurvives ? -1 : 1;
          }
          return 0; // sort é estável — mantém a ordem por score dentro de cada grupo.
        })
      : candidatesForSphere;

    groups.push({ sphere, needed: minPerSphere - current, candidates: ordered });
  }

  return groups;
}

/**
 * Escolha cega por score — fallback usado quando a IA de resgate de esfera
 * (@/lib/sentinel-sphere-rescue) está desligada ou falha tecnicamente.
 */
export function ensureMinimumSphereRepresentation(input: {
  selected: MockSentinelSuggestion[];
  allCandidates: MockSentinelSuggestion[];
  profile: PoliticianProfile;
  minPerSphere?: number;
}): MockSentinelSuggestion[] {
  const groups = buildSphereRescueCandidateGroups(input);
  const result = [...input.selected];
  for (const group of groups) {
    result.push(...group.candidates.slice(0, group.needed));
  }
  return result;
}
