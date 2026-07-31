/**
 * Constantes e helpers do modo DEMO (apresentação / degustação).
 * Tudo atrás de `isDemoMode()` — desligar a flag restaura o comportamento normal.
 */

import { isDemoMode } from "@/lib/feature-flags";

/** Limite de salvamentos de temas (Sentinela) na degustação. */
export const DEMO_THEME_SAVE_LIMIT = 3;

/** Máximo de vídeos gerados por avatar na degustação. */
export const DEMO_MAX_VIDEOS_PER_AVATAR = 2;

/** Tarja de campanha queimada em roteiro livre / preview demo. */
export const DEMO_CAMPAIGN_OVERLAY_TEXT =
  "Divulgação autorizada somente em período de campanha, após 16/Agosto.";

/**
 * Roteiro fixo falado pelo avatar na degustação (propaganda Mandato Digital).
 * Substituído no generate — o usuário vê o aviso antes de confirmar.
 */
export const DEMO_FIXED_AVATAR_SCRIPT =
  "Olá. Este é o meu gêmeo digital no Mandato Digital, a plataforma que une monitoramento, roteiro, avatar e compliance eleitoral em um só fluxo. " +
  "Aqui você acompanha pautas, produz conteúdo com a sua imagem e voz, e publica com transparência exigida pela Justiça Eleitoral. " +
  "Na versão completa, cada vídeo fala o roteiro aprovado da sua campanha. Nesta degustação, o objetivo é você conhecer o resultado visual do avatar. " +
  "Mandato Digital: inteligência artificial a serviço do seu mandato, com responsabilidade e conformidade.";

export const DEMO_GENERATE_AVATAR_NOTICE =
  "Neste modo degustação, o vídeo gerado é exclusivamente de caráter elucidativo e permite a visualização do seu avatar. " +
  "Para os assinantes, o roteiro aprovado é o roteiro falado do seu avatar.";

export const DEMO_DEGUSTACAO_TITLE = "Degustação Liberada";

export const DEMO_DEGUSTACAO_BODY =
  "Você está no pacote degustação: explore o Sentinela, monte seu avatar e gere vídeos de demonstração. " +
  "Os créditos são limitados — quando acabarem, restam Planos e CNPJ para continuar a reserva.";

export const DEMO_CREDITS_LOCKED_MESSAGE =
  "Seus créditos da degustação acabaram. Escolha um plano ou avance o CNPJ para liberar a campanha completa.";

export const DEMO_REFRESH_PAUTA_HINT =
  "Nesta versão as pautas são atualizadas unicamente pela manhã.";

export const DEMO_THEME_SAVE_BLOCKED_MESSAGE =
  "Limite da degustação atingido: você já salvou os temas 3 vezes. Escolha um plano para continuar ajustando.";

/** Rotas que permanecem acessíveis com créditos esgotados em DEMO_MODE. */
export const DEMO_UNLOCKED_PATHS = [
  "/acesso-antecipado/planos",
  "/acesso-antecipado/cnpj",
  "/planos",
  "/login",
  "/logout",
] as const;

export function isDemoUnlockedPath(pathname: string): boolean {
  return DEMO_UNLOCKED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export { isDemoMode };

/** Storage keys client-side (prefixados). */
export const DEMO_STORAGE_KEYS = {
  themeSaves: "md-demo-theme-saves-v1",
  videosByAvatar: "md-demo-videos-by-avatar-v1",
  degustacaoSeen: "md-demo-degustacao-seen-v1",
} as const;

export function readDemoThemeSaveCount(): number {
  if (typeof window === "undefined") {
    return 0;
  }
  const raw = window.localStorage.getItem(DEMO_STORAGE_KEYS.themeSaves);
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function incrementDemoThemeSaveCount(): number {
  const next = readDemoThemeSaveCount() + 1;
  window.localStorage.setItem(DEMO_STORAGE_KEYS.themeSaves, String(next));
  return next;
}

export function readDemoVideosForAvatar(avatarKey: string): number {
  if (typeof window === "undefined") {
    return 0;
  }
  try {
    const raw = window.localStorage.getItem(DEMO_STORAGE_KEYS.videosByAvatar);
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    return Math.max(0, Math.floor(map[avatarKey] ?? 0));
  } catch {
    return 0;
  }
}

export function incrementDemoVideosForAvatar(avatarKey: string): number {
  const current = readDemoVideosForAvatar(avatarKey);
  const next = current + 1;
  try {
    const raw = window.localStorage.getItem(DEMO_STORAGE_KEYS.videosByAvatar);
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    map[avatarKey] = next;
    window.localStorage.setItem(DEMO_STORAGE_KEYS.videosByAvatar, JSON.stringify(map));
  } catch {
    window.localStorage.setItem(
      DEMO_STORAGE_KEYS.videosByAvatar,
      JSON.stringify({ [avatarKey]: next }),
    );
  }
  return next;
}

export function hasSeenDemoDegustacao(): boolean {
  if (typeof window === "undefined") {
    return true;
  }
  return window.localStorage.getItem(DEMO_STORAGE_KEYS.degustacaoSeen) === "1";
}

export function markDemoDegustacaoSeen() {
  window.localStorage.setItem(DEMO_STORAGE_KEYS.degustacaoSeen, "1");
}

/** ~words for target duration (≈ 2.3 words/sec spoken BR). */
export function maxScriptWordsForPlan(planId: string | null | undefined): number {
  switch (planId) {
    case "elite":
      return 420; // ~3 min
    case "avancado":
      return 210; // ~90 s
    case "essencial":
    default:
      return 140; // ~1 min
  }
}

export function maxVideoSecondsLabelForPlan(planId: string | null | undefined): string {
  switch (planId) {
    case "elite":
      return "até 3 minutos";
    case "avancado":
      return "até 90 segundos";
    default:
      return "até 1 minuto";
  }
}
