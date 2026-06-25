import {
  distributionChannelOptions,
  distributionWindowOptions,
  factCheckingSourceOptions,
  hardDataSourceOptions,
  oppositionThemeGroups,
  sentinelThemeGroups,
  socialNetworkOptions,
} from "@/lib/constants";

export type MockSocialProfile = {
  network: string;
  handle: string;
};

export const MOCK_SENTINEL_THEMES_DEFAULT = [
  "Carga Tributaria",
  "Inflacao e Precos",
  "Seguranca Publica",
  "Apoio ao Agronegocio",
  "Valores Tradicionais",
  "Defesa da Vida",
];

export const MOCK_OPPOSITION_THEMES_DEFAULT = [
  "Desemprego",
  "Seguranca Publica",
  "Combate a Corrupcao",
  "Mobilidade Urbana",
  "Saude Publica / Filas",
];

export const MOCK_FACT_CHECKING_DEFAULT = ["Agencia Lupa", "PolitiFact (Global)"];

export const MOCK_HARD_DATA_DEFAULT = [
  "IBGE (Populacao/Censo)",
  "IPEA (Pesquisa Economica)",
  "Banco Central do Brasil",
];

export const MOCK_CHANNELS_DEFAULT = [
  "Instagram (Feed/Reels)",
  "X / Twitter (Threads)",
  "TikTok",
];

export const MOCK_WINDOWS_DEFAULT = [
  "Manha (07h-11h)",
  "Almoco (11h-14h)",
  "Tarde (14h-18h)",
  "Noite (18h-22h)",
];

export const MOCK_AUDIT_QUEUE = [
  {
    id: "audit-1",
    title: "Resposta rapida — fila de cirurgias no SUS",
    status: "aprovado" as const,
    sources: 3,
    deltaSeconds: 14,
  },
  {
    id: "audit-2",
    title: "Reels — mobilidade urbana e BRT",
    status: "revisao" as const,
    sources: 2,
    deltaSeconds: null,
  },
];

export const MOCK_DISTRIBUTION_QUEUE = [
  {
    id: "dist-1",
    title: "Resposta rapida — fila de cirurgias no SUS",
    channels: ["Instagram (Feed/Reels)", "X / Twitter (Threads)"],
    scheduledFor: "Hoje, 18:30",
  },
  {
    id: "dist-2",
    title: "TikTok — reforma tributaria e cesta basica",
    channels: ["TikTok"],
    scheduledFor: "Amanha, 11:15",
  },
];

export function toggleMockValue(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

export function allSentinelThemeOptions() {
  return sentinelThemeGroups.flatMap((group) => group.options);
}

export function allOppositionThemeOptions() {
  return oppositionThemeGroups.flatMap((group) => group.options);
}

export {
  sentinelThemeGroups,
  oppositionThemeGroups,
  socialNetworkOptions,
  factCheckingSourceOptions,
  hardDataSourceOptions,
  distributionChannelOptions,
  distributionWindowOptions,
};
