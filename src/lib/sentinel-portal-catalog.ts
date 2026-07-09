/**
 * Catálogo fixo de portais por esfera — federal (5 nacionais) e estadual (5 por UF).
 * Usado pelo Sentinela para RSS/Google News sem depender do candidato cadastrar portais.
 */

export const BRAZILIAN_UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export type BrazilianUf = (typeof BRAZILIAN_UFS)[number];

/** Cinco portais nacionais monitorados automaticamente no nível federal. */
export const NATIONAL_PORTAL_HOSTS = [
  "g1.globo.com",
  "cnnbrasil.com.br",
  "estadao.com.br",
  "folha.uol.com.br",
  "uol.com.br",
] as const;

/**
 * Cinco portais por UF para o nível estadual.
 * Curadoria inicial — prioriza veículos com RSS ou fallback via Google News site:.
 */
export const STATE_PORTAL_HOSTS: Record<BrazilianUf, readonly string[]> = {
  AC: ["g1.globo.com", "ac24horas.com", "agencia.ac.gov.br", "uol.com.br", "r7.com"],
  AL: ["g1.globo.com", "tribunahoje.com", "uol.com.br", "r7.com", "terra.com.br"],
  AP: ["g1.globo.com", "diarioamapa.com.br", "uol.com.br", "r7.com", "terra.com.br"],
  AM: ["g1.globo.com", "d24am.com", "uol.com.br", "r7.com", "terra.com.br"],
  BA: ["g1.globo.com", "correio24horas.com.br", "atarde.com.br", "uol.com.br", "r7.com"],
  CE: ["g1.globo.com", "opovo.com.br", "verdesmares.com.br", "uol.com.br", "r7.com"],
  DF: ["g1.globo.com", "correiobraziliense.com.br", "metropoles.com", "uol.com.br", "r7.com"],
  ES: ["g1.globo.com", "gazetaonline.com.br", "uol.com.br", "r7.com", "terra.com.br"],
  GO: ["g1.globo.com", "opopular.com.br", "uol.com.br", "r7.com", "gdnonline.com.br"],
  MA: ["g1.globo.com", "imirante.com", "uol.com.br", "r7.com", "terra.com.br"],
  MT: ["g1.globo.com", "midiamax.com", "uol.com.br", "r7.com", "terra.com.br"],
  MS: ["g1.globo.com", "campograndenews.com.br", "uol.com.br", "r7.com", "terra.com.br"],
  MG: ["g1.globo.com", "otempo.com.br", "uai.com.br", "uol.com.br", "r7.com"],
  PA: ["g1.globo.com", "oliberal.com", "uol.com.br", "r7.com", "terra.com.br"],
  PB: ["g1.globo.com", "paraiba.com.br", "uol.com.br", "r7.com", "terra.com.br"],
  PR: ["g1.globo.com", "gazetadopovo.com.br", "tribunapr.com.br", "uol.com.br", "r7.com"],
  PE: ["g1.globo.com", "diariodepernambuco.com.br", "jc.com.br", "uol.com.br", "r7.com"],
  PI: ["g1.globo.com", "meionorte.com", "uol.com.br", "r7.com", "terra.com.br"],
  RJ: ["g1.globo.com", "oglobo.globo.com", "extra.globo.com", "odia.ig.com.br", "uol.com.br"],
  RN: ["g1.globo.com", "tribunadonorte.com.br", "uol.com.br", "r7.com", "terra.com.br"],
  RS: ["g1.globo.com", "correiodopovo.com.br", "gauchazh.clicrbs.com.br", "uol.com.br", "r7.com"],
  RO: ["g1.globo.com", "rondoniaovivo.com", "uol.com.br", "r7.com", "terra.com.br"],
  RR: ["g1.globo.com", "folhabv.com.br", "uol.com.br", "r7.com", "terra.com.br"],
  SC: ["g1.globo.com", "nsctotal.com.br", "ndmais.com.br", "uol.com.br", "r7.com"],
  SP: ["g1.globo.com", "folha.uol.com.br", "estadao.com.br", "uol.com.br", "r7.com"],
  SE: ["g1.globo.com", "infonet.com.br", "uol.com.br", "r7.com", "terra.com.br"],
  TO: ["g1.globo.com", "gurupionline.com.br", "uol.com.br", "r7.com", "terra.com.br"],
};

export function normalizeUf(input: string): BrazilianUf | null {
  const uf = input.trim().toUpperCase();
  return (BRAZILIAN_UFS as readonly string[]).includes(uf) ? (uf as BrazilianUf) : null;
}

export function getNationalPortalHosts(): string[] {
  return [...NATIONAL_PORTAL_HOSTS];
}

export function getStatePortalHosts(uf: string): string[] {
  const normalized = normalizeUf(uf);
  if (!normalized) {
    return [];
  }
  return [...STATE_PORTAL_HOSTS[normalized]];
}

export function countCatalogPortalHosts(input: {
  federalThemeCount: number;
  estadualThemeCount: number;
  state: string;
}): number {
  let count = 0;
  if (input.federalThemeCount > 0) {
    count += NATIONAL_PORTAL_HOSTS.length;
  }
  if (input.estadualThemeCount > 0 && normalizeUf(input.state)) {
    count += STATE_PORTAL_HOSTS[normalizeUf(input.state)!].length;
  }
  return count;
}

export function isNationalPortalHost(host: string): boolean {
  const normalized = host.trim().toLowerCase().replace(/^www\./, "");
  return NATIONAL_PORTAL_HOSTS.some(
    (candidate) => normalized === candidate || normalized.endsWith(`.${candidate}`),
  );
}

export function isStatePortalHost(host: string, uf: string): boolean {
  const normalizedUf = normalizeUf(uf);
  if (!normalizedUf) {
    return false;
  }
  const normalized = host.trim().toLowerCase().replace(/^www\./, "");
  return STATE_PORTAL_HOSTS[normalizedUf].some(
    (candidate) => normalized === candidate || normalized.endsWith(`.${candidate}`),
  );
}
