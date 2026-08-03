/**
 * Constantes e helpers do modo DEMO (apresentação / degustação).
 * Tudo atrás de `isDemoMode()` — desligar a flag restaura o comportamento normal.
 * Contas em `DEMO_MODE_EXEMPT_EMAILS` ficam em full product mesmo com a flag ligada.
 */

import { archetypeOptions, voiceToneOptions } from "@/lib/constants";
import { normalizeAccountEmail } from "@/lib/dev-account-mode";
import { isDemoMode } from "@/lib/feature-flags";

/** Contas internas isentas da degustação enquanto DEMO_MODE global está on. */
export const DEMO_MODE_EXEMPT_EMAILS = ["tribeiro81@gmail.com"] as const;

export function isDemoModeExemptEmail(email: string | null | undefined) {
  const normalized = normalizeAccountEmail(email);
  return (DEMO_MODE_EXEMPT_EMAILS as readonly string[]).includes(normalized);
}

/**
 * DEMO efetivo para um usuário: flag global ligada e e-mail fora da isenção.
 * Preferir este helper (com e-mail da sessão) em vez de `isDemoMode()` puro.
 */
export function isDemoModeActiveForEmail(email: string | null | undefined) {
  if (!isDemoMode()) {
    return false;
  }
  return !isDemoModeExemptEmail(email);
}

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
 *
 * Arquétipo e Tom aplicam a mesma logica do gerador real (avatar-video-prompt.ts):
 * sao "ferramentas taticas" de COMO falar, independentes de posicionamento ideologico —
 * so entram como flavor de abertura/fechamento, sem tocar no conteudo informativo central
 * nem inventar conteudo politico (a degustacao nao tem "tema" para ancorar isso).
 * Continua deterministico (sem chamada de IA): degustacao precisa ser rapida, gratuita
 * e sem risco de fuga de escopo antes do usuario virar cliente pagante.
 */
export type DemoAvatarScriptKind = "gemeo" | "caricato" | "mascote3d";

const DEMO_AVATAR_SCRIPT_LABEL: Record<DemoAvatarScriptKind, string> = {
  gemeo: "gêmeo digital",
  caricato: "caricato",
  mascote3d: "mascote 3D",
};

type ArchetypeOption = (typeof archetypeOptions)[number];
type VoiceToneOption = (typeof voiceToneOptions)[number];

/** Abertura no lugar de "Olá." — flavor de tom, sem conteudo politico. */
const DEMO_TONE_OPENERS: Record<VoiceToneOption, string> = {
  Academico: "Prezado(a),",
  Popular: "E aí, tudo certo?",
  Indignado: "Chega de esperar.",
  Conciliador: "Que bom te ver por aqui.",
  Institucional: "Boa tarde.",
  "Tecnico/Exito": "Vamos direto ao resultado.",
  Didatico: "Vou te explicar rapidinho.",
  Patriotico: "Pelo nosso Brasil,",
  Agressivo: "Sem rodeios.",
  Sofisticado: "É um prazer.",
  Otimista: "Que alegria estar aqui!",
  "Paternal/Maternal": "Vem cá, deixa eu te mostrar uma coisa.",
  "Sarcastico/Ironico": "Ah, finalmente chegou a hora.",
  Motivacional: "Bora com tudo!",
  Denuncista: "Presta atenção nisso.",
  Humoristico: "Opa, chegou a diversão!",
};

/** Fechamento extra — flavor de arquetipo, sem conteudo politico. */
const DEMO_ARCHETYPE_CLOSERS: Record<ArchetypeOption, string> = {
  "O Estadista (Serio, Longo prazo)":
    "Como estadista, penso sempre no que constrói o futuro do nosso mandato.",
  "Homem do Povo (Empatia)":
    "Porque, no fim das contas, tudo isso é para te ouvir e representar de verdade.",
  "O Xerife/Justiceiro (Ordem)": "E ordem se constrói com presença e transparência, todos os dias.",
  "O Missionario (Moral/Costumes)": "Tudo isso a serviço dos valores que defendemos juntos.",
  "O Gestor/CEO (Eficiencia)": "Eficiência é isso: tecnologia trabalhando para o seu mandato.",
  "O Militante (Mobilizador)": "E é assim que a gente mobiliza: mandato forte se constrói junto.",
  "O Professor (Didatico)": "E, como sempre, o segredo está em explicar bem, passo a passo.",
  "O Conciliador (Uniao/Pontes)": "Tudo pensado para unir, dialogar e construir pontes.",
  "Agro/Regionalista (Interior)": "Tecnologia de ponta, com os pés fincados na nossa terra.",
  "O Inovador/Digital (Tech)": "É inovação de verdade, chegando primeiro no seu mandato.",
};

export function demoFixedAvatarScript(
  kind: DemoAvatarScriptKind = "gemeo",
  style?: { archetype?: string; tone?: string },
): string {
  const label = DEMO_AVATAR_SCRIPT_LABEL[kind];
  const opener = DEMO_TONE_OPENERS[style?.tone as VoiceToneOption] ?? "Olá.";
  const closer = DEMO_ARCHETYPE_CLOSERS[style?.archetype as ArchetypeOption];

  return (
    `${opener} Eu sou o seu ${label}. Nessa degustação o objetivo é conhecer o resultado visual do seu avatar treinado. ` +
    "Se não está soando exatamente como você, basta fazer um novo upload da sua voz. " +
    "Aproveito para dizer que além dos avatares, monitoramos os temas da sua região, geramos pautas automatizadas, " +
    "publicações em 7 redes sociais e tudo em conformidade com as resoluções atuais do TSE." +
    (closer ? ` ${closer}` : "")
  );
}

/** @deprecated Preferir `demoFixedAvatarScript(kind)` — mantido como default (Gêmeo). */
export const DEMO_FIXED_AVATAR_SCRIPT = demoFixedAvatarScript("gemeo");

export const DEMO_GENERATE_AVATAR_TITLE = "Vídeo de demonstração";

export const DEMO_GENERATE_AVATAR_BODY =
  "Na degustação o vídeo serve para você ver o resultado do seu avatar. " +
  "Nos planos pagos, o roteiro aprovado é o que o avatar fala de fato. " +
  "Aviso: nessa versão, o avatar lê um texto padrão.";

export const DEMO_GENERATE_AVATAR_CTA = "Gerar vídeo de demonstração";

export const DEMO_GENERATE_AVATAR_CANCEL = "Cancelar";

export const DEMO_DEGUSTACAO_TITLE = "Degustação Liberada";

export const DEMO_DEGUSTACAO_BODY =
  "Você está no pacote degustação: configure os temas do seu interesse e explore as pautas, monte seu avatar e gere vídeos de demonstração. " +
  "Os créditos são limitados — quando acabarem, você pode fazer sua assinatura em \"Acesso Antecipado\".";

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
