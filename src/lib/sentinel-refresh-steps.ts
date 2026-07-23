/** Etapas narradas do refresh do Sentinela (Roteiro.gif no roadmap). */
export const SENTINEL_REFRESH_STEPS = [
  "Organizando a pesquisa",
  "Mapeando assuntos relacionados",
  "Buscando notícias no país, estado, cidade e adversários",
  "Separando as notícias que importam",
  "Checando com IA se as notícias são reais",
  "Montando o seu painel",
] as const;

export type SentinelRefreshStep = (typeof SENTINEL_REFRESH_STEPS)[number];

/** Intervalo entre etapas enquanto a API ainda responde (refresh pode levar ~1–2 min). */
export const SENTINEL_REFRESH_STEP_MS = 7_500;
