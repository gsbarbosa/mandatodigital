import { sentinelThemeGroups } from "./constants";

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
      "Carga Tributaria",
      "Reforma Fiscal",
      "Desemprego",
      "Inflacao e Precos",
      "Empreendedorismo",
      "Privatizacoes",
      "Subsidios Estatais",
      "Geracao de Renda",
      "Contratos Publicos",
    ],
  },
  {
    title: "Seguranca, Justica e Combate ao Crime",
    options: [
      "Seguranca Publica",
      "Combate a Corrupcao",
      "Combate ao Trafico",
      "Sistema Prisional",
      "Ressocializacao",
      "Direitos Humanos",
      "Valorizacao Policial",
      "Cameras Corporais",
    ],
  },
  {
    title: "Meio Ambiente, Agro e Infraestrutura",
    options: [
      "Apoio ao Agronegocio",
      "Transicao Energetica",
      "Protecao de Biomas",
      "Mobilidade Urbana",
      "Agricultura Familiar",
      "Saneamento Basico",
    ],
  },
  {
    title: "Sociedade, Costumes e Pautas Morais",
    options: [
      "Valores Tradicionais",
      "Cota Racial e Social",
      "Protecao da Familia",
      "Liberdade Religiosa",
      "Direitos da Mulher",
      "Defesa da Vida",
      "Direitos das Minorias",
      "Ideologia de Genero",
      "Direitos LGBTQIA+",
    ],
  },
  {
    title: "Estado, Saude e Educacao",
    options: [
      "Saude Publica (SUS)",
      "Educacao Basica",
      "Combate a Fome / Pobreza",
      "Programas Assistenciais",
      "Ensino Tecnico",
      "Fila de Cirurgias",
    ],
  },
  {
    title: "Politica Externa, Tecnologia e Midia",
    options: [
      "Liberdade de Expressao",
      "Soberania Nacional",
      "Combate a Fake News",
      "Transparencia Gov.",
    ],
  },
];

export function themesInCatalog(selected: string[], groups: readonly SphereThemeGroup[]): string[] {
  const catalog = new Set(groups.flatMap((group) => [...group.options]));
  return selected.filter((theme) => catalog.has(theme));
}

/** Máximo de temas por esfera (Federal ou Estadual). */
export const MAX_THEMES_PER_SPHERE = 3;

/** Capacidade exibida no total combinado (Federal + Estadual). */
export const MAX_RADAR_THEMES_TOTAL = 10;

export const MAX_MUNICIPAL_PROFILES = 2;
export const MAX_MUNICIPAL_PORTALS = 2;
export const MAX_ADVERSARY_PROFILES = 2;

export function countRadarThemes(input: { federal: string[]; estadual: string[] }): number {
  return input.federal.length + input.estadual.length;
}
