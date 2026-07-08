import type {
  MockSentinelSuggestion,
  SentinelNewsArticle,
} from "./sentinel-mock-suggestions";

/**
 * The backend has no notion of "sphere" — classification is a frontend heuristic
 * over the evidence already present in each suggestion (see SPEC
 * docs/spec-remodelagem-ui-navegacao.md, "Mapeamentos backend↔UI").
 *
 * Article URLs frequently point at the Google News aggregator, so the real
 * outlet must be inferred from `sourceName` (RSS <source>) or from the
 * " - Outlet" suffix Google News appends to titles.
 */
export type MonitorSphere = "federal" | "estadual" | "municipal" | "adversarios";

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
  interestSites: string[],
): MonitorSphere {
  const actors = suggestion.evidence.actors ?? [];
  if (actors.some((actor) => actor.sourceList === "opposition")) {
    return "adversarios";
  }
  if (actors.some((actor) => actor.sourceList === "interest")) {
    return "municipal";
  }

  const articles = suggestion.evidence.articles ?? [];
  const interestDomains = interestSites.map(normalizeDomain).filter(Boolean);
  const hintsList = articles.map(articleSourceHints);

  if (hintsList.some((hints) => matchesInterestSites(hints, interestDomains))) {
    return "municipal";
  }
  if (hintsList.some(matchesFederal)) {
    return "federal";
  }
  return "estadual";
}

/** Weighted engagement from the monitoring footer: likes + 2x comments + 3x shares. */
export function weightedEngagement(likes: number, comments: number, shares: number): number {
  return likes + 2 * comments + 3 * shares;
}

export function groupSuggestionsBySphere(
  suggestions: MockSentinelSuggestion[],
  interestSites: string[],
): Record<MonitorSphere, MockSentinelSuggestion[]> {
  const groups: Record<MonitorSphere, MockSentinelSuggestion[]> = {
    federal: [],
    estadual: [],
    municipal: [],
    adversarios: [],
  };
  for (const suggestion of suggestions) {
    groups[classifySuggestionSphere(suggestion, interestSites)].push(suggestion);
  }
  return groups;
}
