import type {
  MockSentinelSuggestion,
  SentinelNewsArticle,
} from "./sentinel-mock-suggestions";
import {
  getStatePortalHosts,
  getUfName,
  isNationalPortalHost,
  isStatePortalHost,
  normalizeUf,
} from "./sentinel-portal-catalog";
import {
  canonicalizeSentinelTheme,
  estadualThemeGroups,
  federalThemeGroups,
} from "./sphere-theme-catalog";
import { normalizeSentinelText } from "./sentinel-text";

/**
 * The backend has no notion of "sphere" — classification is a frontend heuristic
 * over the evidence already present in each suggestion (see SPEC
 * docs/spec-remodelagem-ui-navegacao.md, "Mapeamentos backend↔UI").
 *
 * Article URLs frequently point at the Google News aggregator, so the real
 * outlet must be inferred from `sourceName` (RSS <source>) or from the
 * " - Outlet" suffix Google News appends to titles.
 *
 * Prioridade: atores → municipal (cidades/portais) → radar exclusivo → catálogo
 * exclusivo → nome do estado do perfil no título (mesmo vindo de veículo nacional) →
 * portais nacional/estadual → fallback nacional (temas do radar unificado costumam
 * existir nos dois catálogos; default antigo "estadual" esvaziava Nacional).
 */
export type MonitorSphere =
  | "federal"
  | "estadual"
  | "municipal"
  | "interesse"
  | "adversarios";

/**
 * Nacional/estadual não apresentam matéria além do prazo abaixo — o argumento de
 * recência do produto não se sustenta com pauta velha (ver conversa sobre notícia
 * de 2024 aparecendo em Nacional). Estadual tem prazo mais largo que Nacional:
 * cobertura regional é naturalmente mais rala (poucos portais por UF), e o corte de
 * 90 dias esvaziava a esfera mesmo com matéria já corretamente classificada — Nacional
 * raramente esbarra nesse teto (cobertura ampla), então mantém o prazo original.
 * Municipal fica de fora dos dois: cobertura local já é escassa por si só (ver
 * sentinel-municipal-fallback.ts), e o fallback geo-only existe justamente para não
 * deixar a seção vazia.
 */
export const NATIONAL_MAX_AGE_DAYS = 90;
export const ESTADUAL_MAX_AGE_DAYS = 240;

/** Mais recente entre os artigos do cluster — uma matéria nova no meio de um cluster antigo já conta como atual. */
function suggestionMostRecentPublishedAtMs(suggestion: MockSentinelSuggestion): number | null {
  const articles = suggestion.evidence.articles ?? [];
  let latestMs: number | null = null;

  for (const article of articles) {
    if (!article.publishedAt) {
      continue;
    }
    const ms = new Date(article.publishedAt).getTime();
    if (Number.isNaN(ms)) {
      continue;
    }
    if (latestMs === null || ms > latestMs) {
      latestMs = ms;
    }
  }

  return latestMs;
}

/** Sem nenhuma data conhecida no cluster, não bloqueia — RSS de portal sem pubDate confiável não deve ser descartado às cegas. */
export function isOlderThanSphereWindow(
  suggestion: MockSentinelSuggestion,
  maxAgeDays: number,
  nowMs: number = Date.now(),
): boolean {
  const publishedMs = suggestionMostRecentPublishedAtMs(suggestion);
  if (publishedMs === null) {
    return false;
  }
  const ageDays = (nowMs - publishedMs) / (24 * 60 * 60 * 1000);
  return ageDays > maxAgeDays;
}

export type ProfileRadarThemes = {
  federal?: string[];
  estadual?: string[];
};

function themeKey(theme: string) {
  return normalizeSentinelText(theme);
}

function toThemeSet(themes: string[] | undefined) {
  return new Set((themes ?? []).map(themeKey).filter(Boolean));
}

/** National outlets listed in the monitoring footer (mock LandingPage.html). */
const FEDERAL_PORTAL_DOMAINS = [
  "cnn.com.br",
  "cnnbrasil.com.br",
  "bandnews.com.br",
  "band.uol.com.br",
  "jovempan.com.br",
  "g1.globo.com",
  "globo.com",
  "estadao.com.br",
];

/** Loose keys (see looseKey) matched exactly against the outlet name. */
const FEDERAL_OUTLET_EXACT = ["cnn", "g1", "globo", "band"];

/** Loose keys matched by inclusion against the outlet name. */
const FEDERAL_OUTLET_PARTIAL = ["cnnbrasil", "bandnews", "jovempan", "estadao", "oglobo"];

const AGGREGATOR_DOMAINS = ["news.google.com"];

const FEDERAL_THEME_CATALOG = new Set(
  federalThemeGroups.flatMap((group) => [...group.options]),
);
const ESTADUAL_THEME_CATALOG = new Set(
  estadualThemeGroups.flatMap((group) => [...group.options]),
);

/** Esfera pelo catálogo do tema (quando o tema existe só em federal ou só em estadual). */
export function classifyThemesCatalogSphere(themes: string[]): MonitorSphere | null {
  const unique = [
    ...new Set(themes.map((theme) => canonicalizeSentinelTheme(theme)).filter(Boolean)),
  ];
  if (!unique.length) {
    return null;
  }

  const inFederal = unique.some((theme) => FEDERAL_THEME_CATALOG.has(theme));
  const inEstadual = unique.some((theme) => ESTADUAL_THEME_CATALOG.has(theme));

  if (inFederal && !inEstadual) {
    return "federal";
  }
  if (inEstadual && !inFederal) {
    return "estadual";
  }

  return null;
}

/**
 * Esfera conforme o radar salvo do perfil — resolve temas que existem nos dois
 * catálogos (ex.: Cameras Corporais) quando o usuário marcou só em Estadual ou só em Nacional.
 */
export function classifyThemesProfileSphere(
  themeLabel: string,
  matchedThemes: string[],
  profileRadar: ProfileRadarThemes = {},
): MonitorSphere | null {
  const federalKeys = toThemeSet(profileRadar.federal);
  const estadualKeys = toThemeSet(profileRadar.estadual);

  if (federalKeys.size === 0 && estadualKeys.size === 0) {
    return null;
  }

  const label = themeKey(themeLabel);
  if (label) {
    const inFederal = federalKeys.has(label);
    const inEstadual = estadualKeys.has(label);
    if (inEstadual && !inFederal) {
      return "estadual";
    }
    if (inFederal && !inEstadual) {
      return "federal";
    }
  }

  const matched = [...new Set([themeLabel, ...matchedThemes].map(themeKey).filter(Boolean))];
  const matchedFederal = matched.filter((theme) => federalKeys.has(theme));
  const matchedEstadual = matched.filter((theme) => estadualKeys.has(theme));

  if (matchedEstadual.length > 0 && matchedFederal.length === 0) {
    return "estadual";
  }
  if (matchedFederal.length > 0 && matchedEstadual.length === 0) {
    return "federal";
  }

  return null;
}

function suggestionThemes(suggestion: MockSentinelSuggestion): string[] {
  return [
    suggestion.themeLabel,
    ...suggestion.matchedThemes,
  ]
    .map((theme) => theme.trim())
    .filter(Boolean);
}

export function normalizeDomain(input: string): string {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) {
    return "";
  }
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const { hostname } = new URL(withProtocol);
    return hostname.replace(/^www\./, "");
  } catch {
    return trimmed.replace(/^www\./, "").split("/")[0] ?? "";
  }
}

function domainMatches(domain: string, candidate: string): boolean {
  if (!domain || !candidate) {
    return false;
  }
  return domain === candidate || domain.endsWith(`.${candidate}`) || candidate.endsWith(`.${domain}`);
}

/** Lowercase, accent-stripped, alphanumeric-only key for fuzzy outlet matching. */
function looseKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function isAggregatorDomain(domain: string): boolean {
  return AGGREGATOR_DOMAINS.some((candidate) => domainMatches(domain, candidate));
}

/** Outlet appended by Google News after the last " - " / " – " of the title. */
function outletFromTitle(title: string): string | null {
  const match = /[-–—]\s*([^-–—]{3,60})\s*$/.exec(title);
  if (!match) {
    return null;
  }
  const outlet = match[1].trim();
  return outlet.length >= 3 ? outlet : null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Título para exibição, sem o sufixo "- Fonte" que o Google News anexa: o card já mostra a
 * fonte separadamente (rodapé "Fonte:"), então repetir no título é redundante.
 * `knownOutlet` (ex.: `articleOutletLabel(article)`) permite remover sufixos curtos como
 * "G1" que a heurística genérica (mínimo 3 caracteres) sozinha não capturaria.
 */
export function displayTitleWithoutOutlet(title: string, knownOutlet?: string | null): string {
  const trimmedOutlet = knownOutlet?.trim();
  if (trimmedOutlet) {
    const knownOutletSuffix = new RegExp(`\\s*[-–—]\\s*${escapeRegExp(trimmedOutlet)}\\s*$`, "i");
    if (knownOutletSuffix.test(title)) {
      return title.replace(knownOutletSuffix, "").trim() || title;
    }
  }
  if (!outletFromTitle(title)) {
    return title;
  }
  return title.replace(/\s*[-–—]\s*[^-–—]{3,60}\s*$/, "").trim() || title;
}

type ArticleSourceHints = {
  /** Real outlet domain when the URL is not an aggregator link. */
  domain: string | null;
  /** Loose keys derived from sourceName and the title suffix. */
  keys: string[];
};

function articleSourceHints(article: SentinelNewsArticle): ArticleSourceHints {
  const rawDomain = normalizeDomain(article.url);
  const domain = rawDomain && !isAggregatorDomain(rawDomain) ? rawDomain : null;

  const keys: string[] = [];
  const sourceName = article.sourceName?.trim();
  if (sourceName && !isAggregatorDomain(normalizeDomain(sourceName))) {
    keys.push(looseKey(sourceName));
  }
  const titleOutlet = outletFromTitle(article.title);
  if (titleOutlet) {
    keys.push(looseKey(titleOutlet));
  }
  return { domain, keys: keys.filter((key) => key.length >= 2) };
}

function matchesFederal(hints: ArticleSourceHints): boolean {
  if (hints.domain && FEDERAL_PORTAL_DOMAINS.some((candidate) => domainMatches(hints.domain!, candidate))) {
    return true;
  }
  return hints.keys.some(
    (key) =>
      FEDERAL_OUTLET_EXACT.includes(key) ||
      FEDERAL_OUTLET_PARTIAL.some((partial) => key.includes(partial)),
  );
}

function matchesInterestSites(hints: ArticleSourceHints, interestDomains: string[]): boolean {
  for (const domain of interestDomains) {
    if (hints.domain && domainMatches(hints.domain, domain)) {
      return true;
    }
    const label = looseKey(domain.split(".")[0] ?? "");
    if (label.length >= 5 && hints.keys.some((key) => key.includes(label) || label.includes(key))) {
      return true;
    }
    const domainKey = looseKey(domain);
    if (hints.keys.some((key) => key.length >= 8 && domainKey.includes(key))) {
      return true;
    }
  }
  return false;
}

/** `phrase` (ex.: "Minas Gerais") aparece em `normalizedHaystack` como sequência de tokens
 * inteiros — evita falso positivo por substring (ex.: "Pará" dentro de "Paraná"/"Paraíba"). */
function matchesWholePhrase(normalizedHaystack: string, phrase: string): boolean {
  const phraseTokens = normalizeSentinelText(phrase).split(" ").filter(Boolean);
  if (phraseTokens.length === 0) {
    return false;
  }
  const tokens = normalizedHaystack.split(" ").filter(Boolean);
  for (let i = 0; i <= tokens.length - phraseTokens.length; i += 1) {
    if (phraseTokens.every((token, offset) => tokens[i + offset] === token)) {
      return true;
    }
  }
  return false;
}

/**
 * Sinal forte de que a matéria é sobre o estado do perfil, mesmo vinda de veículo nacional
 * (ex.: usuário em MG, título da Jovem Pan que cita "Minas Gerais"). DF fica de fora:
 * por ser a sede do governo federal, quase toda notícia federal cita "Distrito Federal"
 * sem ser, de fato, pauta local do DF.
 */
function matchesProfileStateName(normalizedHaystack: string, profileState: string): boolean {
  const uf = normalizeUf(profileState);
  if (!uf || uf === "DF") {
    return false;
  }
  const stateName = getUfName(uf);
  return Boolean(stateName) && matchesWholePhrase(normalizedHaystack, stateName);
}

/** Display label for the article source (never the aggregator host). */
export function articleOutletLabel(article: SentinelNewsArticle): string {
  const sourceName = article.sourceName?.trim();
  if (sourceName && !isAggregatorDomain(normalizeDomain(sourceName))) {
    return sourceName;
  }
  const titleOutlet = outletFromTitle(article.title);
  if (titleOutlet) {
    return titleOutlet;
  }
  return normalizeDomain(article.url);
}

export function classifySuggestionSphere(
  suggestion: MockSentinelSuggestion,
  interestSites: string[] = [],
  profileState = "",
  customRadarThemes: string[] = [],
  profileRadar: ProfileRadarThemes = {},
  municipalCities: string[] = [],
): MonitorSphere {
  const actors = suggestion.evidence.actors ?? [];
  if (actors.some((actor) => actor.sourceList === "opposition")) {
    return "adversarios";
  }
  if (actors.some((actor) => actor.sourceList === "interest")) {
    return "interesse";
  }

  const customThemes = new Set(
    customRadarThemes.map((theme) => theme.trim()).filter(Boolean),
  );
  if (suggestionThemes(suggestion).some((theme) => customThemes.has(theme))) {
    return "municipal";
  }

  // Ampliação municipal quando o radar não achou os temas na cidade.
  if (
    suggestion.pipeline === "geo-fallback" ||
    suggestion.themeLabel.trim() === "Radar local"
  ) {
    return "municipal";
  }

  const articles = suggestion.evidence.articles ?? [];
  const interestDomains = interestSites.map(normalizeDomain).filter(Boolean);
  const hintsList = articles.map(articleSourceHints);
  const stateHosts = getStatePortalHosts(profileState);
  const haystack = normalizeSentinelText(
    [suggestion.topic, suggestion.themeLabel, ...articles.map((article) => article.title)]
      .filter(Boolean)
      .join(" "),
  );

  if (hintsList.some((hints) => matchesInterestSites(hints, interestDomains))) {
    return "municipal";
  }

  const cities = municipalCities.map((city) => city.trim()).filter(Boolean);
  if (
    cities.some((city) => {
      const key = normalizeSentinelText(city);
      return key.length >= 3 && haystack.includes(key);
    })
  ) {
    return "municipal";
  }

  const profileSphere = classifyThemesProfileSphere(
    suggestion.themeLabel,
    suggestion.matchedThemes,
    profileRadar,
  );
  if (profileSphere) {
    return profileSphere;
  }

  const themeSphere = classifyThemesCatalogSphere(suggestionThemes(suggestion));
  if (themeSphere) {
    return themeSphere;
  }

  // Matéria de veículo nacional cujo título cita o estado do perfil (ex.: MG selecionado,
  // Jovem Pan noticiando algo especificamente de Minas Gerais) — some do Nacional e passa
  // a existir só no Estadual, para não duplicar a mesma pauta nos dois níveis. Só chega
  // aqui quando o tema não é exclusivamente federal pelo catálogo (checagem acima).
  if (matchesProfileStateName(haystack, profileState)) {
    return "estadual";
  }

  if (
    suggestion.pipeline === "portal" &&
    hintsList.some((hints) => hints.domain && isNationalPortalHost(hints.domain))
  ) {
    return "federal";
  }

  if (hintsList.some(matchesFederal)) {
    return "federal";
  }

  if (
    hintsList.some(
      (hints) =>
        hints.domain &&
        (isStatePortalHost(hints.domain, profileState) ||
          stateHosts.some((host) => domainMatches(hints.domain!, host))),
    )
  ) {
    return "estadual";
  }

  // Temas do radar unificado existem nos dois catálogos → sem sinal de portal/UF,
  // trata como agenda nacional (evita despejar tudo em Estadual).
  return "federal";
}

/** Weighted engagement from the monitoring footer: likes + 2x comments. */
export function weightedEngagement(likes: number, comments: number): number {
  return likes + 2 * comments;
}

export function groupSuggestionsBySphere(
  suggestions: MockSentinelSuggestion[],
  interestSites: string[] = [],
  profileState = "",
  customRadarThemes: string[] = [],
  profileRadar: ProfileRadarThemes = {},
  municipalCities: string[] = [],
): Record<MonitorSphere, MockSentinelSuggestion[]> {
  const groups: Record<MonitorSphere, MockSentinelSuggestion[]> = {
    federal: [],
    estadual: [],
    municipal: [],
    interesse: [],
    adversarios: [],
  };
  for (const suggestion of suggestions) {
    const sphere = classifySuggestionSphere(
      suggestion,
      interestSites,
      profileState,
      customRadarThemes,
      profileRadar,
      municipalCities,
    );

    if (sphere === "federal" && isOlderThanSphereWindow(suggestion, NATIONAL_MAX_AGE_DAYS)) {
      continue;
    }
    if (sphere === "estadual" && isOlderThanSphereWindow(suggestion, ESTADUAL_MAX_AGE_DAYS)) {
      continue;
    }

    groups[sphere].push(suggestion);
  }
  return groups;
}
