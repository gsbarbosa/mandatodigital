import { sentinelThemeGroups } from "./constants";
import { normalizeSentinelText } from "./sentinel-text";

/**
 * Sphere-facing catalogs for the "Redefinir temas" screen. Values MUST be the
 * exact option strings from constants.ts — the backend (expansions, matching)
 * keys on them. Federal exposes the full catalog; Estadual is the mock's subset.
 */

export type SphereThemeGroup = {
  title: string;
  options: readonly string[];
};

export const federalThemeGroups: readonly SphereThemeGroup[] = sentinelThemeGroups;

export const estadualThemeGroups: readonly SphereThemeGroup[] = [
  {
    title: "Economia, Trabalho e Mercado",
    options: [
      "Carga Tributária",
      "Reforma Fiscal",
      "Desemprego",
      "Inflação e Preços",
      "Empreendedorismo",
      "Privatizações",
      "Subsídios Estatais",
      "Geração de Renda",
      "MEI e Simples Nacional",
      "Contratos Públicos",
    ],
  },
  {
    title: "Segurança, Justiça e Combate ao Crime",
    options: [
      "Segurança Pública",
      "Combate à Corrupção",
      "Combate ao Tráfico",
      "Sistema Prisional",
      "Ressocialização",
      "Direitos Humanos",
      "Proteção de Fronteiras",
      "Valorização Policial",
      "Câmeras Corporais",
    ],
  },
  {
    title: "Meio Ambiente, Agro e Infraestrutura",
    options: [
      "Apoio ao Agronegócio",
      "Transição Energética",
      "Proteção de Biomas",
      "Mobilidade Urbana",
      "Agricultura Familiar",
      "Demarcação de Terras",
      "Saneamento Básico",
      "Ferrovias e Portos",
    ],
  },
  {
    title: "Sociedade, Costumes e Pautas Morais",
    options: [
      "Valores Tradicionais",
      "Cota Racial e Social",
      "Proteção da Família",
      "Liberdade Religiosa",
      "Direitos da Mulher",
      "Legalização de Drogas",
      "Defesa da Vida",
      "Direitos das Minorias",
      "Ideologia de Gênero",
      "Direitos LGBTQIA+",
    ],
  },
  {
    title: "Estado, Saúde e Educação",
    options: [
      "Saúde Pública (SUS)",
      "Educação Básica",
      "Educação Superior",
      "Combate à Fome / Pobreza",
      "Programas Assistenciais",
      "Ensino Técnico",
      "Piso Salarial",
      "Fila de Cirurgias",
      "Vacinação",
    ],
  },
  {
    title: "Política Externa, Tecnologia e Mídia",
    options: [
      "Liberdade de Expressão",
      "Soberania Nacional",
      "Combate a Fake News",
      "Transparência Gov.",
    ],
  },
];

const ALL_CATALOG_LABELS: readonly string[] = [
  ...new Set([
    ...federalThemeGroups.flatMap((group) => [...group.options]),
    ...estadualThemeGroups.flatMap((group) => [...group.options]),
  ]),
];

const CATALOG_BY_NORMALIZED = new Map(
  ALL_CATALOG_LABELS.map((label) => [normalizeSentinelText(label), label] as const),
);

/**
 * Mapeia tema salvo (com ou sem acento) para o label canônico acentuado do catálogo.
 * Temas custom fora do catálogo permanecem como vieram.
 */
export function canonicalizeSentinelTheme(theme: string): string {
  const trimmed = theme.trim();
  if (!trimmed) {
    return trimmed;
  }
  return CATALOG_BY_NORMALIZED.get(normalizeSentinelText(trimmed)) ?? trimmed;
}

export function canonicalizeSentinelThemes(themes: string[]): string[] {
  return [...new Set(themes.map(canonicalizeSentinelTheme).filter(Boolean))];
}

export function themesInCatalog(selected: string[], groups: readonly SphereThemeGroup[]): string[] {
  const catalog = new Set(groups.flatMap((group) => [...group.options]));
  return canonicalizeSentinelThemes(selected).filter((theme) => catalog.has(theme));
}

/** Máximo de temas de interesse (convidado). Premium sem teto na UI. */
export const MAX_INTEREST_THEMES = 8;

/**
 * @deprecated Use MAX_INTEREST_THEMES — radar unificado (sem split nacional/estadual na config).
 * Mantido como alias para scripts/RSS que ainda importam o nome antigo.
 */
export const MAX_THEMES_PER_SPHERE = MAX_INTEREST_THEMES;

/** Capacidade total do radar de temas (convidado). */
export const MAX_RADAR_THEMES_TOTAL = MAX_INTEREST_THEMES;

/** Cidades do radar municipal (convidado). */
export const MAX_MUNICIPAL_CITIES = 2;

/** Portais do radar municipal (convidado). */
export const MAX_MUNICIPAL_PORTALS = 2;

/** Perfis @ de interesse (convidado) — esfera aparte no monitoramento. */
export const MAX_INTEREST_PROFILES = 2;

/** Perfis @ de adversários (convidado). */
export const MAX_ADVERSARY_PROFILES = 2;

/**
 * @deprecated Use MAX_INTEREST_PROFILES — perfis saíram da seção municipal.
 */
export const MAX_MUNICIPAL_PROFILES = MAX_INTEREST_PROFILES;

/** Catálogo único da tela “temas de interesse” (catálogo federal completo). */
export const interestThemeGroups: readonly SphereThemeGroup[] = federalThemeGroups;

export function countRadarThemes(input: { federal: string[]; estadual: string[] }): number {
  return new Set([...input.federal, ...input.estadual]).size;
}

export function countInterestThemes(themes: string[]): number {
  return canonicalizeSentinelThemes(themes).length;
}
