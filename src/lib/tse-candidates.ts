/**
 * Normalização da base de candidaturas do TSE (consulta_cand_2026) para os
 * campos do cadastro do usuário.
 *
 * Só funções puras aqui — a leitura/escrita no Firestore vive em
 * tse-candidates-storage.ts, e o seed em scripts/seed-tse-candidates.ts.
 *
 * O dataset cobre 4 dos 10 campos do cadastro. Telefone e endereço não existem
 * no arquivo e DS_EMAIL vem 100% redigido como "NÃO DIVULGÁVEL".
 */

import { CARGOS_2026, PARTIDOS_2026, isUf } from "@/lib/eleicao-2026";

/** Campos que o CPF consegue preencher. String vazia = não preencher. */
export type TseCandidatePrefill = {
  fullName: string;
  party: string;
  uf: string;
  role: string;
};

/** Linha crua do CSV do TSE, só com as colunas que interessam. */
export type TseCandidateRow = {
  NR_CPF_CANDIDATO: string;
  NM_CANDIDATO: string;
  SG_UF: string;
  SG_PARTIDO: string;
  DS_CARGO: string;
};

/** Sigla do TSE que não bate com o rótulo do `<select>` do cadastro. */
const PARTY_ALIASES: Record<string, string> = {
  "UNIAO": "UNIÃO BRASIL",
};

const NAME_PARTICLES = new Set([
  "da", "das", "de", "del", "di", "do", "dos", "du", "e", "la", "van", "von", "y",
]);

/** O TSE marca ausência com "#NULO", "#NE", "NÃO DIVULGÁVEL" etc. */
export function isTsePlaceholder(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return true;
  }
  if (trimmed.startsWith("#")) {
    return true;
  }
  return stripAccents(trimmed).toUpperCase() === "NAO DIVULGAVEL";
}

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function capitalizeSegments(word: string): string {
  // Preserva hífen e apóstrofo: "d'ávila" → "D'Ávila", "santa-rita" → "Santa-Rita".
  return word.replace(
    /(^|[-'’])(\p{L})/gu,
    (_match, separator: string, letter: string) =>
      `${separator}${letter.toLocaleUpperCase("pt-BR")}`,
  );
}

/** O TSE grava tudo em caixa alta; o formulário fica melhor em caixa mista. */
export function normalizeCandidateName(raw: string): string {
  if (isTsePlaceholder(raw)) {
    return "";
  }
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR")
    .split(" ")
    .map((word, index) =>
      index > 0 && NAME_PARTICLES.has(word) ? word : capitalizeSegments(word),
    )
    .join(" ");
}

/** Devolve "" quando a sigla não existe no `<select>` de partidos. */
export function normalizeTseParty(raw: string): string {
  if (isTsePlaceholder(raw)) {
    return "";
  }
  const key = stripAccents(raw.trim()).toUpperCase();
  const alias = PARTY_ALIASES[key];
  if (alias) {
    return alias;
  }
  const match = PARTIDOS_2026.find(
    (party) => stripAccents(party).toUpperCase() === key,
  );
  return match ?? "";
}

/**
 * Devolve "" para cargos sem equivalente no cadastro — vice-governador,
 * vice-presidente e suplentes de senador (487 das 15.866 linhas de 2026).
 */
export function normalizeTseCargo(raw: string): string {
  if (isTsePlaceholder(raw)) {
    return "";
  }
  const key = stripAccents(raw.trim()).toUpperCase();
  const match = CARGOS_2026.find(
    (cargo) => stripAccents(cargo).toUpperCase() === key,
  );
  return match ?? "";
}

/** SG_UF vem "BR" para presidente/vice, que não é opção no cadastro. */
export function normalizeTseUf(raw: string): string {
  if (isTsePlaceholder(raw)) {
    return "";
  }
  const uf = raw.trim().toUpperCase();
  return isUf(uf) ? uf : "";
}

export function toCandidatePrefill(row: TseCandidateRow): TseCandidatePrefill {
  return {
    fullName: normalizeCandidateName(row.NM_CANDIDATO ?? ""),
    party: normalizeTseParty(row.SG_PARTIDO ?? ""),
    uf: normalizeTseUf(row.SG_UF ?? ""),
    role: normalizeTseCargo(row.DS_CARGO ?? ""),
  };
}

export function hasAnyPrefillValue(prefill: TseCandidatePrefill): boolean {
  return Boolean(prefill.fullName || prefill.party || prefill.uf || prefill.role);
}

/**
 * Mesmo CPF em mais de um registro (candidato a dois cargos/partidos).
 * Mantém só o que é consenso entre os registros — divergiu, não preenche,
 * em vez de chutar qual candidatura é a "certa".
 */
export function mergeCandidatePrefills(
  prefills: TseCandidatePrefill[],
): TseCandidatePrefill {
  const pick = (field: keyof TseCandidatePrefill) => {
    const values = new Set(
      prefills.map((prefill) => prefill[field]).filter(Boolean),
    );
    return values.size === 1 ? [...values][0] : "";
  };

  return {
    fullName: pick("fullName"),
    party: pick("party"),
    uf: pick("uf"),
    role: pick("role"),
  };
}
