/**
 * Resolve nomes livres (como o Gustavo fala) contra a base outbound.
 * Ambíguo ou ausente não chuta — devolve candidatos para o operador escolher.
 */

import type { MarketingContact } from "@/lib/outbound/types";

export function normalizePersonName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Aceita vírgula, ponto-e-vírgula, quebra de linha e " e " entre nomes. */
export function parseNameList(raw: string): string[] {
  return raw
    .split(/\n|;|,|\s+e\s+|\s+E\s+/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

export type NameMatch =
  | { query: string; status: "ok"; contact: MarketingContact }
  | { query: string; status: "ambiguous"; candidates: MarketingContact[] }
  | { query: string; status: "missing"; candidates: MarketingContact[] };

function tokens(normalized: string): string[] {
  return normalized.split(" ").filter(Boolean);
}

function phoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Query que parece telefone (DDD+número, com ou sem 55). */
function nationalPhone(value: string): string | null {
  let digits = phoneDigits(value);
  if (digits.startsWith("55") && digits.length >= 12) {
    digits = digits.slice(2);
  }
  if (digits.length === 10 || digits.length === 11) {
    return digits;
  }
  return null;
}

function matchByPhone(contacts: MarketingContact[], query: string): NameMatch | null {
  const wanted = nationalPhone(query);
  if (!wanted) return null;

  const hits = contacts.filter((contact) => nationalPhone(contact.phoneE164) === wanted);
  if (hits.length === 0) {
    return { query, status: "missing", candidates: [] };
  }
  if (hits.length > 1) {
    return { query, status: "ambiguous", candidates: hits.slice(0, 8) };
  }
  return { query, status: "ok", contact: hits[0]! };
}

function scoreCandidate(query: string, contact: MarketingContact): number {
  const name = normalizePersonName(contact.name);
  const q = normalizePersonName(query);
  if (!q || !name) return 0;
  if (name === q) return 100;

  const queryTokens = tokens(q);
  const nameTokens = tokens(name);
  if (queryTokens.length === 0) return 0;

  const ufSuffix = queryTokens[queryTokens.length - 1];
  const hasUf = ufSuffix?.length === 2 && contact.uf === ufSuffix;
  const nameQuery = hasUf ? queryTokens.slice(0, -1).join(" ") : q;
  const nameQueryTokens = tokens(nameQuery);
  if (hasUf && nameQueryTokens.length === 0) return 0;

  const comparable = hasUf ? nameQuery : q;
  if (name === comparable) return hasUf ? 98 : 100;
  if (name.startsWith(`${comparable} `) || name.startsWith(comparable)) return 80;
  if (comparable.startsWith(name)) return 60;

  const allPresent = nameQueryTokens.every((token) => nameTokens.includes(token));
  if (allPresent && nameQueryTokens.length >= 2) return 70;
  if (allPresent && nameQueryTokens.length === 1 && nameTokens[0] === nameQueryTokens[0]) {
    return 40;
  }
  return 0;
}

const MIN_SCORE = 40;

export function matchContactsByName(
  contacts: MarketingContact[],
  queries: string[],
): NameMatch[] {
  return queries.map((query) => {
    const byPhone = matchByPhone(contacts, query);
    if (byPhone) {
      return byPhone;
    }

    const ranked = contacts
      .map((contact) => ({ contact, score: scoreCandidate(query, contact) }))
      .filter((row) => row.score >= MIN_SCORE)
      .sort((a, b) => b.score - a.score);

    const best = ranked[0];
    if (!best) {
      return { query, status: "missing" as const, candidates: [] };
    }

    const top = ranked.filter((row) => row.score === best.score);
    if (top.length > 1) {
      return {
        query,
        status: "ambiguous" as const,
        candidates: top.map((row) => row.contact),
      };
    }

    // Primeiro nome sozinho com vários homônimos abaixo do mesmo score já saiu
    // acima; se o melhor é fraco (só primeiro nome) e há outros, pede desambiguação.
    if (best.score <= 40) {
      const sameFirst = ranked.filter((row) => row.score >= 40);
      if (sameFirst.length > 1) {
        return {
          query,
          status: "ambiguous" as const,
          candidates: sameFirst.slice(0, 8).map((row) => row.contact),
        };
      }
    }

    return { query, status: "ok" as const, contact: best.contact };
  });
}
