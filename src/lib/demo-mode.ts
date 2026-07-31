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
 * Roteiro fixo falado na degustação.
 * O trecho "[gêmeo digital]" muda conforme o estilo escolhido (gêmeo / caricato / 3D).
 */
export type DemoAvatarScriptKind = "gemeo" | "caricato" | "mascote3d";

const DEMO_AVATAR_SCRIPT_LABEL: Record<DemoAvatarScriptKind, string> = {
  gemeo: "gêmeo digital",
  caricato: "caricato",
  mascote3d: "mascote 3D",
};

export function demoFixedAvatarScript(kind: DemoAvatarScriptKind = "gemeo"): string {
  const label = DEMO_AVATAR_SCRIPT_LABEL[kind];
  return (
    `Olá. Eu sou o seu ${label}. Nessa degustação o objetivo é conhecer o resultado visual do seu avatar treinado. ` +
    "Se não está soando exatamente como você, basta fazer um novo upload da sua voz. " +
    "Aproveito para dizer que além dos avatares, monitoramos os temas da sua região, geramos pautas automatizadas, " +
    "publicações em 7 redes sociais e tudo em conformidade com as resoluções atuais do TSE."
  );
}

/** @deprecated Preferir `demoFixedAvatarScript(kind)` — mantido como default (Gêmeo). */
export const DEMO_FIXED_AVATAR_SCRIPT = demoFixedAvatarScript("gemeo");

export const DEMO_GENERATE_AVATAR_TITLE = "Vídeo de demonstração";

export const DEMO_GENERATE_AVATAR_BODY =
  "Na degustação o vídeo serve para você ver o resultado do avatar — ilustrativo, com limites do modo demonstração. " +
  "Nos planos pagos, o roteiro aprovado é o que o avatar fala de fato.";

export const DEMO_GENERATE_AVATAR_CTA = "Gerar vídeo de demonstração";

export const DEMO_GENERATE_AVATAR_CANCEL = "Cancelar";

export const DEMO_DEGUSTACAO_TITLE = "Degustação Liberada";

export const DEMO_DEGUSTACAO_BODY =
  "Você está no pacote degustação: explore o Sentinela, monte seu avatar e gere vídeos de demonstração. " +
  "Os créditos são limitados — quando acabarem, restam Planos e CNPJ para continuar a reserva.";

/** Tela pós-cadastro em DEMO_MODE (antes de entrar no produto). */
export const DEMO_ACCESS_TITLE = "Acesso de demonstração";

export const DEMO_ACCESS_BODY =
  "Seus dados foram salvos. Nesta fase de lançamento você entra com acesso de demonstração do Mandato Digital: " +
  "explore o monitoramento, configure temas e experimente o avatar com limites da degustação.";

export const DEMO_ACCESS_CTA = "Seguir com acesso de demonstração";

export const DEMO_REFRESH_PAUTA_HINT =
  "Nesta versão as pautas são atualizadas unicamente pela manhã.";

export const DEMO_THEME_SAVE_BLOCKED_MESSAGE =
  "Limite da degustação atingido: você já salvou os temas 3 vezes. Escolha um plano para continuar ajustando.";

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
