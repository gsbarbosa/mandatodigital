/**
 * Listas canônicas da eleição de 2026 usadas no cadastro do usuário.
 *
 * Ficam aqui (e não no componente) porque o seed da base TSE
 * (scripts/seed-tse-candidates.ts) precisa normalizar para exatamente
 * estes valores — senão o `<select>` recebe um valor inexistente e
 * renderiza vazio.
 */

export const UF_LIST = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

/** Partidos registrados no TSE disputando a eleição de 2026. */
export const PARTIDOS_2026 = [
  "AGIR", "AVANTE", "CIDADANIA", "DC", "DEMOCRATA", "MDB", "MISSÃO", "MOBILIZA",
  "NOVO", "PCB", "PCdoB", "PCO", "PDT", "PL", "PMB", "PODE", "PP", "PRD", "PRTB",
  "PSB", "PSD", "PSDB", "PSOL", "PSTU", "PT", "PV", "REDE", "REPUBLICANOS",
  "SOLIDARIEDADE", "UNIÃO BRASIL", "UP",
] as const;

export const CARGOS_2026 = [
  "Deputado Federal",
  "Deputado Estadual",
  "Deputado Distrital",
  "Senador",
  "Governador",
  "Presidente",
] as const;

export function isUf(value: string): boolean {
  return (UF_LIST as readonly string[]).includes(value);
}

export function isPartido2026(value: string): boolean {
  return (PARTIDOS_2026 as readonly string[]).includes(value);
}

export function isCargo2026(value: string): boolean {
  return (CARGOS_2026 as readonly string[]).includes(value);
}
