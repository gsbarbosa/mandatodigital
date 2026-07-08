import type { MockSentinelSuggestion } from "./sentinel-mock-suggestions";

/**
 * The backend has no notion of "sphere" — classification is a frontend heuristic
 * over the evidence already present in each suggestion (see SPEC
 * docs/spec-remodelagem-ui-navegacao.md, "Mapeamentos backend↔UI").
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

  const articleDomains = (suggestion.evidence.articles ?? []).map((article) =>
    normalizeDomain(article.url),
  );
  const interestDomains = interestSites.map(normalizeDomain).filter(Boolean);

  if (
    articleDomains.some((domain) =>
      interestDomains.some((candidate) => domainMatches(domain, candidate)),
    )
  ) {
    return "municipal";
  }

  if (
    articleDomains.some((domain) =>
      FEDERAL_PORTAL_DOMAINS.some((candidate) => domainMatches(domain, candidate)),
    )
  ) {
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
