import { normalizeSentinelText } from "@/lib/sentinel-text";

/**
 * Detecta classificados de emprego/estágio que poluem o tema "Desemprego".
 * Padrões rodam sobre texto já normalizado (sem acento, só a-z0-9).
 */
const JOB_LISTING_PATTERNS = [
  /\babre\s+(?:\d+\s+)?vagas?\b/,
  /\bvagas?\s+de\s+estagio\b/,
  /\bprograma\s+de\s+estagio\b/,
  /\binscricoes?\s+(?:abertas\s+)?para\s+(?:o\s+)?(?:programa\s+de\s+)?estagio\b/,
  /\bsaiba\s+como\s+se\s+candidatar\b/,
  /\bcomo\s+se\s+candidatar\b/,
  /\bconfira\s+as\s+vagas\b/,
  /\btem\s+emprego\b/,
  /\boferta\s+\d+\s+vagas?\b/,
  /\bbolsa\s+de\s+r\b/,
  /\bvagas?\s+(?:em|para)\s+(?:diversas|diferentes)\s+cidades\b/,
  /\bestagio\s+com\s+(?:bolsa|salario)\b/,
];

/** Matérias “educativas” sobre fake news sem fato político concreto. */
const WEAK_FAKE_NEWS_PATTERNS = [
  /\bcomo\s+(?:identificar|evitar|checar)\b.*\bfake\s*news\b/,
  /\bdia\s+da\s+mentira\b/,
  /\bcapacita\b.*\bfake\s*news\b/,
  /\bdissertacao\b.*\bfake\s*news\b/,
  /\bpalestra\s+sobre\s+combate\b/,
  /\balerta\s+de\s+fake\s+news\b/,
];

export function isLikelyJobListingTitle(title: string): boolean {
  const normalized = normalizeSentinelText(title);
  if (!normalized) {
    return false;
  }
  return JOB_LISTING_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function isWeakFakeNewsTitle(title: string): boolean {
  const normalized = normalizeSentinelText(title);
  if (!normalized) {
    return false;
  }
  return WEAK_FAKE_NEWS_PATTERNS.some((pattern) => pattern.test(normalized));
}

/** Penalidade de relevanceScore (0–99) para classificados / fake news fraca. */
export function softQualityPenaltyForTitle(title: string): number {
  if (isLikelyJobListingTitle(title)) {
    return 35;
  }
  if (isWeakFakeNewsTitle(title)) {
    return 25;
  }
  return 0;
}
