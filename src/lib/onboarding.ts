/**
 * Onboarding guiado (não fictício): o usuário executa as ações reais do sistema
 * enquanto uma camada guia por cima. O progresso é derivado do estado real do
 * app (temas do radar salvos, assets de avatar enviados, conteúdo gerado) e
 * combinado com marcadores locais das etapas puramente visuais.
 *
 * Esta camada é pura (sem React) para ser testável e reutilizável.
 */

export type OnboardingStepId = "temas" | "avatar" | "noticias" | "gerar";

/** Alvo de destaque no menu lateral para a etapa atual. */
export type OnboardingSidebarTarget =
  | "monitoramento"
  | "temas-config"
  | "avatar-config"
  | "criativos"
  | null;

export type OnboardingStepDef = {
  id: OnboardingStepId;
  order: number;
  /** Rótulo exibido na trilha e usado na jornada. */
  label: string;
  /** Rota real do sistema onde a etapa acontece. */
  route: string;
  /** Item do menu lateral destacado enquanto a etapa está ativa. */
  sidebar: Exclude<OnboardingSidebarTarget, null>;
};

export const ONBOARDING_STEPS: readonly OnboardingStepDef[] = [
  { id: "temas", order: 1, label: "Selecionar Temas", route: "/monitoramento", sidebar: "monitoramento" },
  { id: "avatar", order: 2, label: "Treinar Avatar", route: "/avatares/foto-real/treinar", sidebar: "avatar-config" },
  { id: "noticias", order: 3, label: "Ver notícias dos temas", route: "/monitoramento", sidebar: "monitoramento" },
  { id: "gerar", order: 4, label: "Pautar e Gerar Vídeo", route: "/criativo/novo", sidebar: "criativos" },
] as const;

const STEP_ORDER: readonly OnboardingStepId[] = ONBOARDING_STEPS.map((step) => step.id);

/**
 * Sinais reais do sistema usados para derivar quais etapas já foram concluídas,
 * mesmo que o usuário nunca tenha visto a trilha (ex.: conta que já configurou
 * o radar antes do onboarding existir).
 */
export type OnboardingSignals = {
  /** Radar salvo com ao menos um tema de interesse. */
  hasRadarThemes: boolean;
  /** Foto de referência do avatar enviada. */
  hasAvatarImage: boolean;
  /** Áudio de voz enviado. */
  hasVoiceAudio: boolean;
  /** Ao menos um criativo/vídeo gerado. */
  hasGeneratedContent: boolean;
};

/** Estado persistido no navegador, por usuário. */
export type OnboardingPersistedState = {
  /** Usuário optou por pular a apresentação guiada. */
  dismissed?: boolean;
  /** Modal de boas-vindas já exibido. */
  welcomeSeen?: boolean;
  /** Etapas concluídas de forma puramente visual (não deriváveis do backend). */
  localDone?: OnboardingStepId[];
};

export const EMPTY_ONBOARDING_STATE: OnboardingPersistedState = {};

export type OnboardingStepView = OnboardingStepDef & {
  done: boolean;
  current: boolean;
};

export type OnboardingComputed = {
  steps: OnboardingStepView[];
  currentStepId: OnboardingStepId | null;
  /** Todas as etapas concluídas. */
  isComplete: boolean;
  /** Deve exibir a trilha guiada (ativo e não dispensado). */
  isActive: boolean;
};

/** Deriva a conclusão de cada etapa a partir dos sinais reais do sistema. */
export function deriveAppDone(signals: OnboardingSignals): Record<OnboardingStepId, boolean> {
  return {
    temas: signals.hasRadarThemes,
    avatar: signals.hasAvatarImage && signals.hasVoiceAudio,
    // "Ver notícias" e "Gerar" só têm rastro persistido quando há conteúdo gerado;
    // nesse caso ambas já ocorreram de fato.
    noticias: signals.hasGeneratedContent,
    gerar: signals.hasGeneratedContent,
  };
}

/**
 * Combina os sinais reais com os marcadores locais e resolve a etapa atual.
 * Aplica preenchimento monotônico: se uma etapa posterior está concluída, todas
 * as anteriores também estão.
 */
export function computeOnboarding(input: {
  signals: OnboardingSignals;
  persisted: OnboardingPersistedState;
}): OnboardingComputed {
  const appDone = deriveAppDone(input.signals);
  const local = new Set(input.persisted.localDone ?? []);

  const doneMap: Record<OnboardingStepId, boolean> = {
    temas: appDone.temas || local.has("temas"),
    avatar: appDone.avatar || local.has("avatar"),
    noticias: appDone.noticias || local.has("noticias"),
    gerar: appDone.gerar || local.has("gerar"),
  };

  let lastDoneIdx = -1;
  STEP_ORDER.forEach((id, index) => {
    if (doneMap[id]) {
      lastDoneIdx = index;
    }
  });
  for (let i = 0; i < lastDoneIdx; i += 1) {
    doneMap[STEP_ORDER[i]] = true;
  }

  const currentStepId = STEP_ORDER.find((id) => !doneMap[id]) ?? null;
  const isComplete = currentStepId === null;
  const isActive = !input.persisted.dismissed && !isComplete;

  const steps: OnboardingStepView[] = ONBOARDING_STEPS.map((step) => ({
    ...step,
    done: doneMap[step.id],
    current: step.id === currentStepId,
  }));

  return { steps, currentStepId, isComplete, isActive };
}

/** Destaque do menu lateral para a etapa atual, considerando a rota corrente. */
export function resolveSidebarTarget(
  currentStepId: OnboardingStepId | null,
  pathname: string,
): OnboardingSidebarTarget {
  switch (currentStepId) {
    case "temas":
      return pathname.startsWith("/monitoramento/temas") ? "temas-config" : "monitoramento";
    case "avatar":
      return "avatar-config";
    case "noticias":
      return "monitoramento";
    case "gerar":
      return "criativos";
    default:
      return null;
  }
}

const STORAGE_PREFIX = "md:onboarding:v1:";

export function onboardingStorageKey(userKey: string | null | undefined): string {
  return `${STORAGE_PREFIX}${userKey && userKey.trim() ? userKey.trim() : "anon"}`;
}

export function readOnboardingState(userKey: string | null | undefined): OnboardingPersistedState {
  if (typeof window === "undefined") {
    return EMPTY_ONBOARDING_STATE;
  }
  try {
    const raw = window.localStorage.getItem(onboardingStorageKey(userKey));
    if (!raw) {
      return EMPTY_ONBOARDING_STATE;
    }
    const parsed = JSON.parse(raw) as OnboardingPersistedState;
    return {
      dismissed: Boolean(parsed.dismissed),
      welcomeSeen: Boolean(parsed.welcomeSeen),
      localDone: Array.isArray(parsed.localDone)
        ? parsed.localDone.filter((id): id is OnboardingStepId =>
            STEP_ORDER.includes(id as OnboardingStepId),
          )
        : [],
    };
  } catch {
    return EMPTY_ONBOARDING_STATE;
  }
}

export function writeOnboardingState(
  userKey: string | null | undefined,
  state: OnboardingPersistedState,
): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(onboardingStorageKey(userKey), JSON.stringify(state));
  } catch {
    // Persistência é best-effort; ignorar falhas de quota/privacidade.
  }
}
