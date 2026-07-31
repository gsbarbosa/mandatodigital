import type { MockSentinelSuggestion } from "@/lib/sentinel-mock-suggestions";
import { getUfName } from "@/lib/sentinel-portal-catalog";
import {
  evaluateSentinelFeedQuality,
  type SentinelFeedQualityReport,
} from "@/lib/sentinel-quality-assertions";
import { buildSentinelRssQueries } from "@/lib/sentinel-rss";
import { normalizeSentinelText } from "@/lib/sentinel-text";
import type { SentinelSuggestionsMeta } from "@/lib/sentinel-types";
import { classifySuggestionSphere } from "@/lib/sphere-classifier";
import type { PoliticianProfile } from "@/lib/types";

/**
 * Cenário de qualidade para município pequeno / interior.
 * Hipótese: o usuário vê reportagens atuais alinhadas aos temas e à região.
 */
export type MunicipalQualityScenario = {
  id: string;
  label: string;
  /** Nome IBGE (como em public/geo/municipios/<UF>.json). */
  city: string;
  state: string;
  /** Apelidos/topônimos que a imprensa usa no título. */
  cityAliases: string[];
  themesFederal: string[];
  themesEstadual: string[];
  customThemes: string[];
};

/** Jericoacoara (nome oficial: Jijoca de Jericoacoara) — litoral oeste do CE. */
export const SCENARIO_JERICOACOARA: MunicipalQualityScenario = {
  id: "jericoacoara-ce",
  label: "Jijoca de Jericoacoara — CE",
  city: "Jijoca de Jericoacoara",
  state: "CE",
  cityAliases: ["Jericoacoara", "Jeri", "Jijoca"],
  themesFederal: ["Empreendedorismo", "Inflação e Preços"],
  themesEstadual: [
    "Segurança Pública",
    "Saneamento Básico",
    "Saúde Pública (SUS)",
    "Educação Básica",
  ],
  customThemes: ["turismo", "praia"],
};

/** Arcos — Centro-Oeste de Minas (polo de cimento / interior). */
export const SCENARIO_ARCOS: MunicipalQualityScenario = {
  id: "arcos-mg",
  label: "Arcos — MG",
  city: "Arcos",
  state: "MG",
  cityAliases: ["Arcos"],
  themesFederal: ["Empreendedorismo", "Inflação e Preços"],
  themesEstadual: [
    "Segurança Pública",
    "Saneamento Básico",
    "Saúde Pública (SUS)",
    "Educação Básica",
  ],
  customThemes: ["cimento", "indústria"],
};

export const MUNICIPAL_QUALITY_SCENARIOS: Record<string, MunicipalQualityScenario> = {
  jericoacoara: SCENARIO_JERICOACOARA,
  "jericoacoara-ce": SCENARIO_JERICOACOARA,
  arcos: SCENARIO_ARCOS,
  "arcos-mg": SCENARIO_ARCOS,
};

export function resolveMunicipalScenario(
  idOrAlias: string | undefined,
): MunicipalQualityScenario {
  const key = (idOrAlias ?? "jericoacoara").trim().toLowerCase();
  return MUNICIPAL_QUALITY_SCENARIOS[key] ?? SCENARIO_JERICOACOARA;
}

export function buildMunicipalTestProfile(
  scenario: MunicipalQualityScenario,
  overrides: Partial<PoliticianProfile> = {},
): PoliticianProfile {
  const federal = scenario.themesFederal;
  const estadual = scenario.themesEstadual;
  return {
    id: overrides.id ?? `quality-municipal-${scenario.id}`,
    fullName: overrides.fullName ?? `Teste qualidade ${scenario.label}`,
    role: overrides.role ?? "Prefeito",
    city: overrides.city ?? scenario.city,
    state: overrides.state ?? scenario.state,
    audience: overrides.audience ?? "",
    spectrum: overrides.spectrum ?? "",
    archetype: overrides.archetype ?? "",
    voiceTones: overrides.voiceTones ?? [],
    keyIssues: overrides.keyIssues ?? [],
    slogans: overrides.slogans ?? [],
    redLines: overrides.redLines ?? [],
    referenceExamples: overrides.referenceExamples ?? [],
    bio: overrides.bio ?? "",
    personaArchetypes: overrides.personaArchetypes ?? [],
    sentinelThemes: overrides.sentinelThemes ?? [...federal, ...estadual],
    sentinelThemesFederal: overrides.sentinelThemesFederal ?? [...federal],
    sentinelThemesEstadual: overrides.sentinelThemesEstadual ?? [...estadual],
    oppositionThemes: overrides.oppositionThemes ?? [],
    customRadarThemes: overrides.customRadarThemes ?? [...scenario.customThemes],
    municipalCities: overrides.municipalCities ?? [scenario.city],
    interestProfiles: overrides.interestProfiles ?? [],
    interestSites: overrides.interestSites ?? [],
    oppositionProfiles: overrides.oppositionProfiles ?? [],
    oppositionSites: overrides.oppositionSites ?? [],
    glossaryTerms: overrides.glossaryTerms ?? [],
    trainingReferenceLinks: overrides.trainingReferenceLinks ?? [],
    youtubeVideoUrl: overrides.youtubeVideoUrl ?? "",
    avatarType: overrides.avatarType ?? "",
    avatarVideoTopic: overrides.avatarVideoTopic ?? "",
    notificationEmail: overrides.notificationEmail ?? "",
    avatarEmotions: overrides.avatarEmotions ?? [],
    voicePace: overrides.voicePace ?? "",
    editingStyles: overrides.editingStyles ?? [],
    factCheckingSources: overrides.factCheckingSources ?? [],
    hardDataSources: overrides.hardDataSources ?? [],
    distributionChannels: overrides.distributionChannels ?? [],
    distributionWindows: overrides.distributionWindows ?? [],
    autoPublish: overrides.autoPublish ?? false,
    updatedAt: overrides.updatedAt ?? new Date().toISOString(),
  };
}

function isOpposition(suggestion: MockSentinelSuggestion) {
  return (suggestion.evidence.actors ?? []).some((actor) => actor.sourceList === "opposition");
}

function primaryTitle(suggestion: MockSentinelSuggestion) {
  return suggestion.evidence.articles?.[0]?.title?.trim() || suggestion.topic;
}

/** Só título/fonte das matérias — topic/briefing podem herdar o município do radar. */
function articleGeoHaystack(suggestion: MockSentinelSuggestion) {
  const articles = suggestion.evidence.articles ?? [];
  return normalizeSentinelText(
    articles
      .flatMap((article) => [article.title, article.sourceName ?? ""])
      .filter(Boolean)
      .join(" "),
  );
}

function parseArticleDate(raw: string | undefined, nowMs: number): Date | null {
  if (!raw?.trim()) {
    return null;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  // Datas futuras absurdamente longe = lixo; pequena folga de clock skew.
  if (parsed.getTime() > nowMs + 24 * 60 * 60 * 1000) {
    return null;
  }
  return parsed;
}

function newestArticleDate(suggestion: MockSentinelSuggestion, nowMs: number): Date | null {
  let newest: Date | null = null;
  for (const article of suggestion.evidence.articles ?? []) {
    const date = parseArticleDate(article.publishedAt, nowMs);
    if (!date) {
      continue;
    }
    if (!newest || date.getTime() > newest.getTime()) {
      newest = date;
    }
  }
  return newest;
}

export function geoTokensForScenario(scenario: MunicipalQualityScenario) {
  const stateName = getUfName(scenario.state);
  const cityTokens = [scenario.city, ...scenario.cityAliases]
    .map((token) => normalizeSentinelText(token))
    .filter((token) => token.length >= 3);
  const stateTokens = [stateName, scenario.state]
    .map((token) => normalizeSentinelText(token))
    .filter(Boolean);
  return { cityTokens: [...new Set(cityTokens)], stateTokens: [...new Set(stateTokens)] };
}

export function matchesCityGeo(
  haystack: string,
  scenario: MunicipalQualityScenario,
): boolean {
  const { cityTokens } = geoTokensForScenario(scenario);
  return cityTokens.some((token) => {
    // Apelidos curtos (ex.: "jeri") exigem limite de palavra — evita falso positivo.
    if (token.length <= 4) {
      return new RegExp(`(?:^|\\s)${token}(?:\\s|$)`).test(haystack);
    }
    return haystack.includes(token);
  });
}

export function matchesStateGeo(
  haystack: string,
  scenario: MunicipalQualityScenario,
): boolean {
  const { stateTokens } = geoTokensForScenario(scenario);
  return stateTokens.some((token) => {
    if (token.length === 2) {
      return new RegExp(`\\b${token}\\b`).test(haystack);
    }
    return haystack.includes(token);
  });
}

function radarThemeKeys(scenario: MunicipalQualityScenario) {
  return new Set(
    [...scenario.themesFederal, ...scenario.themesEstadual, ...scenario.customThemes]
      .map((theme) => normalizeSentinelText(theme))
      .filter(Boolean),
  );
}

export function matchesRadarTheme(
  suggestion: MockSentinelSuggestion,
  scenario: MunicipalQualityScenario,
): boolean {
  const keys = radarThemeKeys(scenario);
  const labels = [suggestion.themeLabel, ...suggestion.matchedThemes]
    .map((theme) => normalizeSentinelText(theme))
    .filter(Boolean);
  return labels.some((label) => keys.has(label));
}

/**
 * Shape das queries RSS: município+UF e tema×município devem existir.
 * Roda sem rede — regressão de montagem do radar municipal.
 */
export function evaluateMunicipalQueryShape(
  queries: string[],
  scenario: MunicipalQualityScenario,
): { ok: boolean; failures: string[]; expectedGeo: string; sample: string[] } {
  const failures: string[] = [];
  const scopeGeo = normalizeSentinelText(`${scenario.city} ${getUfName(scenario.state)}`);
  const normalizedQueries = queries.map((query) => normalizeSentinelText(query));

  if (!normalizedQueries.some((query) => query === scopeGeo || query.includes(scopeGeo))) {
    failures.push(
      `Query geográfica municipal ausente: esperado conter "${scenario.city} ${getUfName(scenario.state)}".`,
    );
  }

  const themeSamples = [...scenario.themesEstadual, ...scenario.customThemes].slice(0, 3);
  for (const theme of themeSamples) {
    const needle = normalizeSentinelText(`${theme} ${scenario.city}`);
    const hit = normalizedQueries.some((query) => query.includes(needle));
    if (!hit) {
      failures.push(`Query tema×município ausente para "${theme}".`);
    }
  }

  return {
    ok: failures.length === 0,
    failures,
    expectedGeo: `${scenario.city} ${getUfName(scenario.state)}`,
    sample: queries.slice(0, 12),
  };
}

export type MunicipalCardAnnotation = {
  theme: string;
  title: string;
  publishedAt: string | null;
  ageDays: number | null;
  matchesCity: boolean;
  matchesState: boolean;
  matchesTheme: boolean;
  sphere: string;
  fresh: boolean | null;
};

export type MunicipalFeedQualityReport = {
  ok: boolean;
  failures: string[];
  warnings: string[];
  scenario: Pick<MunicipalQualityScenario, "id" | "label" | "city" | "state">;
  baseFeed: SentinelFeedQualityReport;
  queryShape: ReturnType<typeof evaluateMunicipalQueryShape>;
  stats: {
    newsTotal: number;
    withDate: number;
    freshCount: number;
    staleCount: number;
    undatedCount: number;
    cityHits: number;
    stateHits: number;
    regionalHits: number;
    municipalSphere: number;
    themeAligned: number;
    themeAlignmentRatio: number;
    freshRatioAmongDated: number;
    maxAgeDays: number;
  };
  cards: MunicipalCardAnnotation[];
};

export type MunicipalFeedQualityOptions = {
  nowMs?: number;
  /** Idade máxima (dias) para considerar matéria "atual". Default 14. */
  maxAgeDays?: number;
  /** Entre cards com data, fração máxima stale. Default 0.5. */
  maxStaleRatio?: number;
  /** Mínimo de cards news (município pequeno = volume baixo). Default 2. */
  minCards?: number;
  /** Mínimo de hits cidade OU estado no título/topic. Default 1. */
  minRegionalHits?: number;
  /** Mínimo de hits com nome/apelido da cidade. Default 1 (cobertura municipal). */
  minCityHits?: number;
  /** Fração mínima de cards com tema do radar. Default 0.5. */
  minThemeAlignmentRatio?: number;
  /** Se false, só avisa (não falha) ausência de hit municipal puro. Default true. */
  requireCityHit?: boolean;
  /** Avalia shape das queries (sem rede). Default true. */
  checkQueries?: boolean;
};

/**
 * Gate de qualidade municipal: reportagens atuais × temas × região.
 * Complementa `evaluateSentinelFeedQuality` (lixo/monotema) com geo + freshness.
 */
export function evaluateMunicipalFeedQuality(
  input: {
    suggestions: MockSentinelSuggestion[];
    meta?: SentinelSuggestionsMeta | null;
    profile: PoliticianProfile;
    scenario: MunicipalQualityScenario;
    queries?: string[];
  },
  options: MunicipalFeedQualityOptions = {},
): MunicipalFeedQualityReport {
  const nowMs = options.nowMs ?? Date.now();
  const maxAgeDays = options.maxAgeDays ?? 14;
  const maxStaleRatio = options.maxStaleRatio ?? 0.5;
  const minCards = options.minCards ?? 2;
  const minRegionalHits = options.minRegionalHits ?? 1;
  const minCityHits = options.minCityHits ?? 1;
  const minThemeAlignmentRatio = options.minThemeAlignmentRatio ?? 0.5;
  const requireCityHit = options.requireCityHit !== false;
  const checkQueries = options.checkQueries !== false;

  const scenario = input.scenario;
  const queries = input.queries ?? buildSentinelRssQueries(input.profile);
  const queryShape = evaluateMunicipalQueryShape(queries, scenario);

  const baseFeed = evaluateSentinelFeedQuality(
    { suggestions: input.suggestions, meta: input.meta },
    {
      minCards,
      maxThemeShare: 0.7,
      expectQualityRank: false,
      expectThemeVerify: false,
    },
  );

  const failures: string[] = [...(checkQueries ? queryShape.failures : [])];
  const warnings: string[] = [];
  const news = input.suggestions.filter((item) => !isOpposition(item));

  let withDate = 0;
  let freshCount = 0;
  let staleCount = 0;
  let cityHits = 0;
  let stateHits = 0;
  let regionalHits = 0;
  let municipalSphere = 0;
  let themeAligned = 0;

  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const cards: MunicipalCardAnnotation[] = [];

  for (const suggestion of news) {
    const haystack = articleGeoHaystack(suggestion);
    const city = matchesCityGeo(haystack, scenario);
    const state = matchesStateGeo(haystack, scenario);
    const themeOk = matchesRadarTheme(suggestion, scenario);
    const published = newestArticleDate(suggestion, nowMs);
    let ageDays: number | null = null;
    let fresh: boolean | null = null;

    if (published) {
      withDate += 1;
      ageDays = (nowMs - published.getTime()) / (24 * 60 * 60 * 1000);
      fresh = ageDays <= maxAgeDays;
      if (fresh) {
        freshCount += 1;
      } else {
        staleCount += 1;
      }
    }

    if (city) {
      cityHits += 1;
    }
    if (state) {
      stateHits += 1;
    }
    if (city || state) {
      regionalHits += 1;
    }
    if (themeOk) {
      themeAligned += 1;
    }

    const sphere = classifySuggestionSphere(
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
    if (sphere === "municipal") {
      municipalSphere += 1;
    }

    cards.push({
      theme: suggestion.themeLabel,
      title: primaryTitle(suggestion).slice(0, 140),
      publishedAt: published?.toISOString() ?? null,
      ageDays: ageDays == null ? null : Number(ageDays.toFixed(1)),
      matchesCity: city,
      matchesState: state,
      matchesTheme: themeOk,
      sphere,
      fresh,
    });
  }

  const undatedCount = news.length - withDate;
  const themeAlignmentRatio = news.length ? themeAligned / news.length : 0;
  const freshRatioAmongDated = withDate ? freshCount / withDate : 0;

  for (const failure of baseFeed.failures) {
    // Volume baixo em município pequeno é esperado — já coberto por minCards local.
    if (failure.startsWith("Poucos cards")) {
      continue;
    }
    failures.push(failure);
  }

  if (news.length < minCards) {
    failures.push(
      `Poucos cards de notícia para município pequeno: ${news.length} (mín. ${minCards}).`,
    );
  }

  if (input.meta && (input.meta.articlesScanned ?? 0) < 1 && news.length === 0) {
    failures.push("Coleta vazia: articlesScanned=0 e nenhum card (RSS/portais sem retorno).");
  }

  if (withDate >= 2) {
    const staleRatio = staleCount / withDate;
    if (staleRatio > maxStaleRatio) {
      failures.push(
        `Matérias velhas demais: ${(staleRatio * 100).toFixed(0)}% com data > ${maxAgeDays}d (máx. ${(maxStaleRatio * 100).toFixed(0)}%).`,
      );
    }
  } else if (news.length >= minCards && withDate === 0) {
    warnings.push(
      "Nenhum card com publishedAt — freshness não pôde ser medida (agregador sem data).",
    );
  }

  if (regionalHits < minRegionalHits) {
    failures.push(
      `Pouca relevância regional (${scenario.state}/${scenario.city}): ${regionalHits} hits cidade/UF (mín. ${minRegionalHits}).`,
    );
  }

  if (cityHits < minCityHits) {
    const message = `Cobertura municipal fraca: ${cityHits} card(s) mencionam ${scenario.city}/apelidos (mín. ${minCityHits}).`;
    if (requireCityHit) {
      failures.push(message);
    } else {
      warnings.push(message);
    }
  }

  if (news.length >= minCards && themeAlignmentRatio < minThemeAlignmentRatio) {
    failures.push(
      `Temas desalinhados do radar: ${(themeAlignmentRatio * 100).toFixed(0)}% alinhados (mín. ${(minThemeAlignmentRatio * 100).toFixed(0)}%).`,
    );
  }

  if (municipalSphere === 0 && cityHits === 0 && news.length >= minCards) {
    warnings.push(
      "Nenhum card classificado como esfera municipal — feed pode estar só estadual/nacional.",
    );
  }

  return {
    ok: failures.length === 0,
    failures,
    warnings,
    scenario: {
      id: scenario.id,
      label: scenario.label,
      city: scenario.city,
      state: scenario.state,
    },
    baseFeed,
    queryShape,
    stats: {
      newsTotal: news.length,
      withDate,
      freshCount,
      staleCount,
      undatedCount,
      cityHits,
      stateHits,
      regionalHits,
      municipalSphere,
      themeAligned,
      themeAlignmentRatio: Number(themeAlignmentRatio.toFixed(3)),
      freshRatioAmongDated: Number(freshRatioAmongDated.toFixed(3)),
      maxAgeDays,
    },
    cards,
  };
}
