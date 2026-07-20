/**
 * Onboarding guiado (não fictício): progresso derivado do estado real do app
 * (temas por esfera, assets de avatar, persona/glossário) + marcadores locais.
 *
 * Fase 1 — Selecionar Temas (4 passos): Nacional → Estadual → Municipal → Adversário
 * Fase 2 — Treinar Avatar (4 passos): Foto → Áudio → Persona → Glossário
 * Fase 3 — Monitoramento de Pautas (1 passo): overview Sentinela → Pautar
 * Fase 4 — Criar Roteiro (4 passos): Arquétipo → Tom → Tema → Aprovar roteiro
 * Fase 5 — Produzir Vídeo (2 passos): Escolher avatar → Gerar vídeo
 */

export type OnboardingPhaseId = "temas" | "avatar" | "pautas" | "roteiro" | "video";

export type OnboardingStepId =
  | "temas-federal"
  | "temas-estadual"
  | "temas-municipal"
  | "temas-adversarios"
  | "avatar-foto"
  | "avatar-audio"
  | "avatar-persona"
  | "avatar-glossario"
  | "pautas-pautar"
  | "criativo-arquetipo"
  | "criativo-tom"
  | "criativo-tema"
  | "criativo-roteiro"
  | "criativo-avatar"
  | "criativo-gerar";

/** Alvo de destaque no menu lateral. */
export type OnboardingSidebarTarget =
  | "monitoramento"
  | "temas-config"
  | "avatar-config"
  | "criativo"
  | null;

export type OnboardingPhaseDef = {
  id: OnboardingPhaseId;
  order: number;
  label: string;
};

export type OnboardingStepDef = {
  id: OnboardingStepId;
  phase: OnboardingPhaseId;
  /** Ordem dentro da fase (1..4) — usado no tooltip "Passo X de 4". */
  phaseOrder: number;
  label: string;
  /** Rota + hash da seção real. */
  route: string;
  /** data-onboarding-anchor na página. */
  anchor: string;
  sidebar: Exclude<OnboardingSidebarTarget, null>;
};

export const ONBOARDING_PHASES: readonly OnboardingPhaseDef[] = [
  { id: "temas", order: 1, label: "Selecionar Temas" },
  { id: "avatar", order: 2, label: "Treinar Avatar" },
  { id: "pautas", order: 3, label: "Monitoramento de Pautas" },
  { id: "roteiro", order: 4, label: "Criar Roteiro" },
  { id: "video", order: 5, label: "Produzir Vídeo" },
] as const;

export const ONBOARDING_STEPS: readonly OnboardingStepDef[] = [
  {
    id: "temas-federal",
    phase: "temas",
    phaseOrder: 1,
    label: "Nível Nacional",
    route: "/monitoramento/temas#federal",
    anchor: "temas-federal",
    sidebar: "temas-config",
  },
  {
    id: "temas-estadual",
    phase: "temas",
    phaseOrder: 2,
    label: "Nível Estadual",
    route: "/monitoramento/temas#estadual",
    anchor: "temas-estadual",
    sidebar: "temas-config",
  },
  {
    id: "temas-municipal",
    phase: "temas",
    phaseOrder: 3,
    label: "Nível Municipal",
    route: "/monitoramento/temas#municipal",
    anchor: "temas-municipal",
    sidebar: "temas-config",
  },
  {
    id: "temas-adversarios",
    phase: "temas",
    phaseOrder: 4,
    label: "Adversário político",
    route: "/monitoramento/temas#adversarios",
    anchor: "temas-adversarios",
    sidebar: "temas-config",
  },
  {
    id: "avatar-foto",
    phase: "avatar",
    phaseOrder: 1,
    label: "Enviar foto",
    route: "/avatares/foto-real/treinar#foto",
    anchor: "avatar-foto",
    sidebar: "avatar-config",
  },
  {
    id: "avatar-audio",
    phase: "avatar",
    phaseOrder: 2,
    label: "Enviar áudio",
    route: "/avatares/foto-real/treinar#audio",
    anchor: "avatar-audio",
    sidebar: "avatar-config",
  },
  {
    id: "avatar-persona",
    phase: "avatar",
    phaseOrder: 3,
    label: "Calibragem de Persona",
    route: "/curador#persona",
    anchor: "avatar-persona",
    sidebar: "avatar-config",
  },
  {
    id: "avatar-glossario",
    phase: "avatar",
    phaseOrder: 4,
    label: "Glossário de expressões",
    route: "/curador#glossario",
    anchor: "avatar-glossario",
    sidebar: "avatar-config",
  },
  {
    id: "pautas-pautar",
    phase: "pautas",
    phaseOrder: 1,
    label: "Pautar primeira pauta",
    route: "/monitoramento",
    anchor: "pautas-pautar",
    sidebar: "monitoramento",
  },
  {
    id: "criativo-arquetipo",
    phase: "roteiro",
    phaseOrder: 1,
    label: "Escolher Arquétipo",
    route: "/criativo/novo#arquetipo",
    anchor: "criativo-arquetipo",
    sidebar: "criativo",
  },
  {
    id: "criativo-tom",
    phase: "roteiro",
    phaseOrder: 2,
    label: "Escolher Tom de Linguagem",
    route: "/criativo/novo#tom",
    anchor: "criativo-tom",
    sidebar: "criativo",
  },
  {
    id: "criativo-tema",
    phase: "roteiro",
    phaseOrder: 3,
    label: "Tema do vídeo",
    route: "/criativo/novo#tema",
    anchor: "criativo-tema",
    sidebar: "criativo",
  },
  {
    id: "criativo-roteiro",
    phase: "roteiro",
    phaseOrder: 4,
    label: "Aprovação do roteiro",
    route: "/criativo/novo#roteiro",
    anchor: "criativo-roteiro",
    sidebar: "criativo",
  },
  {
    id: "criativo-avatar",
    phase: "video",
    phaseOrder: 1,
    label: "Escolher avatar",
    route: "/criativo/novo#avatar",
    anchor: "criativo-avatar",
    sidebar: "criativo",
  },
  {
    id: "criativo-gerar",
    phase: "video",
    phaseOrder: 2,
    label: "Gerar vídeo a partir do avatar",
    route: "/criativo/novo#gerar",
    anchor: "criativo-gerar",
    sidebar: "criativo",
  },
] as const;

export const ONBOARDING_GUIDE_COPY: Record<
  OnboardingStepId,
  { title: string; body: string }
> = {
  "temas-federal": {
    title: "Nível Nacional",
    body: "Selecione os temas federais do seu radar. É a base do monitoramento político em escala nacional.",
  },
  "temas-estadual": {
    title: "Nível Estadual",
    body: "Informe a UF e escolha os temas estaduais. O Sentinela passa a olhar também a agenda do seu estado.",
  },
  "temas-municipal": {
    title: "Nível Municipal",
    body: "Adicione perfis e portais locais para cobrir a política municipal e a sua cidade.",
  },
  "temas-adversarios": {
    title: "Adversário político",
    body: "Cadastre os perfis dos adversários para o radar acompanhar a narrativa deles também.",
  },
  "avatar-foto": {
    title: "Enviar foto",
    body: "Envie uma foto nítida, de frente e bem iluminada. Ela é a base visual do seu avatar.",
  },
  "avatar-audio": {
    title: "Enviar áudio",
    body: "Grave ou envie um áudio limpo da sua voz (30s–2min) para clonar o timbre nos vídeos.",
  },
  "avatar-persona": {
    title: "Calibragem de Persona",
    body: "Ajuste o espectro ideológico. Isso orienta o tom dos roteiros gerados pelo Mandato Digital.",
  },
  "avatar-glossario": {
    title: "Glossário de expressões",
    body: "Inclua palavras e frases típicas da sua comunicação para os textos soarem com a sua voz.",
  },
  "pautas-pautar": {
    title: "Pautar no Criativo",
    body: "Este é o botão Pautar da primeira pauta do radar. Toque nele para gerar conteúdo com o seu avatar.",
  },
  "criativo-arquetipo": {
    title: "Escolher Arquétipo",
    body: "Escolha no máximo um arquétipo. Ele define a postura narrativa do roteiro e do vídeo.",
  },
  "criativo-tom": {
    title: "Escolher Tom de Linguagem",
    body: "Selecione o tom da fala. Isso calibra o estilo do texto gerado pelo Mandato Digital.",
  },
  "criativo-tema": {
    title: "Tema do vídeo",
    body: "Confirme ou ajuste o tema da pauta e clique em Gerar roteiro quando estiver pronto.",
  },
  "criativo-roteiro": {
    title: "Aprovação do roteiro",
    body: "Revise o texto, edite se precisar e aprove o roteiro. O validador confere as afirmações antes da produção.",
  },
  "criativo-avatar": {
    title: "Escolher avatar",
    body: "Selecione o modelo de avatar para este vídeo: Foto real, Caricato ou Mascote 3D.",
  },
  "criativo-gerar": {
    title: "Gerar o vídeo",
    body: "Com roteiro aprovado e avatar escolhido, gere o conteúdo a partir do avatar selecionado.",
  },
};

const STEP_ORDER: readonly OnboardingStepId[] = ONBOARDING_STEPS.map((step) => step.id);

export function countPhaseSteps(phaseId: OnboardingPhaseId | null): number {
  if (!phaseId) {
    return 0;
  }
  return ONBOARDING_STEPS.filter((step) => step.phase === phaseId).length;
}

/** Mínimo de temas (nacional + estadual) para liberar a fase 1 sem rede social. */
export const TEMAS_PHASE_MIN_THEMES = 5;

export type OnboardingSignals = {
  hasFederalThemes: boolean;
  hasEstadualThemes: boolean;
  hasMunicipalSignal: boolean;
  hasOppositionSignal: boolean;
  hasAvatarImage: boolean;
  hasVoiceAudio: boolean;
  /** Spectrum já definido (inclui default salvo). */
  hasPersonaSpectrum: boolean;
  hasGlossary: boolean;
  /** Total de temas nacionais + estaduais selecionados. */
  selectedThemeCount: number;
  /** Qualquer @ em interesse ou adversários. */
  hasSocialProfile: boolean;
};

/** Gate da fase 1: ≥5 temas (federal+estadual) OU ≥1 rede social. */
export function meetsTemasPhaseGate(signals: OnboardingSignals): boolean {
  return signals.selectedThemeCount >= TEMAS_PHASE_MIN_THEMES || signals.hasSocialProfile;
}

export type OnboardingPersistedState = {
  dismissed?: boolean;
  welcomeSeen?: boolean;
  localDone?: OnboardingStepId[];
  replayRequested?: boolean;
  /**
   * Tour do zero na mesma conta: ignora sinais do app (temas/foto já salvos)
   * e só conta o que o usuário avançar de novo no checklist/tip.
   */
  tourFromScratch?: boolean;
};

export const EMPTY_ONBOARDING_STATE: OnboardingPersistedState = {};

export type OnboardingStepView = OnboardingStepDef & {
  done: boolean;
  current: boolean;
};

export type OnboardingComputed = {
  steps: OnboardingStepView[];
  currentStepId: OnboardingStepId | null;
  currentPhaseId: OnboardingPhaseId | null;
  /** Índice 1..4 dentro da fase atual (para o tooltip). */
  currentPhaseStep: number | null;
  phaseStepCount: number;
  isComplete: boolean;
  isActive: boolean;
  /** Gate da fase temas: 5 temas ou 1 rede social. */
  temasPhaseReady: boolean;
  selectedThemeCount: number;
  /** Áudio de voz real enviado (obrigatório para sair da fase avatar / produzir). */
  hasVoiceAudio: boolean;
};

export function deriveAppDone(signals: OnboardingSignals): Record<OnboardingStepId, boolean> {
  return {
    "temas-federal": signals.hasFederalThemes,
    "temas-estadual": signals.hasEstadualThemes,
    "temas-municipal": signals.hasMunicipalSignal,
    "temas-adversarios": signals.hasOppositionSignal,
    "avatar-foto": signals.hasAvatarImage,
    "avatar-audio": signals.hasVoiceAudio,
    // Spectrum costuma vir com default — persona só fecha via Próximo/localDone.
    "avatar-persona": false,
    "avatar-glossario": signals.hasGlossary,
    // Fecha via Próximo/Pautar (localDone) — não há sinal de app.
    "pautas-pautar": false,
    "criativo-arquetipo": false,
    "criativo-tom": false,
    "criativo-tema": false,
    "criativo-roteiro": false,
    "criativo-avatar": false,
    "criativo-gerar": false,
  };
}

export function computeOnboarding(input: {
  signals: OnboardingSignals;
  persisted: OnboardingPersistedState;
}): OnboardingComputed {
  const local = new Set(input.persisted.localDone ?? []);
  const fromScratch = Boolean(input.persisted.tourFromScratch);

  const appDone = fromScratch
    ? (Object.fromEntries(STEP_ORDER.map((id) => [id, false])) as Record<
        OnboardingStepId,
        boolean
      >)
    : deriveAppDone(input.signals);

  const doneMap = Object.fromEntries(
    STEP_ORDER.map((id) => [id, Boolean(appDone[id] || local.has(id))]),
  ) as Record<OnboardingStepId, boolean>;

  if (!fromScratch) {
    let lastDoneIdx = -1;
    STEP_ORDER.forEach((id, index) => {
      if (doneMap[id]) {
        lastDoneIdx = index;
      }
    });
    for (let i = 0; i < lastDoneIdx; i += 1) {
      doneMap[STEP_ORDER[i]] = true;
    }
  }

  // Áudio real é obrigatório — Próximo/localDone/monotonic não bastam.
  // Sem isso o usuário chega em "Nova pauta" com a UI bloqueada e o tip preso.
  if (!input.signals.hasVoiceAudio) {
    doneMap["avatar-audio"] = false;
  }

  const temasPhaseReady = meetsTemasPhaseGate(input.signals);

  let currentStepId = STEP_ORDER.find((id) => !doneMap[id]) ?? null;
  // Sem radar mínimo, não sai da fase de temas (mesmo com steps posteriores done).
  if (!temasPhaseReady) {
    const wouldLeaveTemas =
      currentStepId === null ||
      ONBOARDING_STEPS.find((step) => step.id === currentStepId)?.phase !== "temas";
    if (wouldLeaveTemas) {
      currentStepId = "temas-adversarios";
    }
  }

  // Sem áudio, não avança além de avatar-audio (desprende tip preso em Nova pauta).
  if (!input.signals.hasVoiceAudio) {
    const currentPhase =
      currentStepId === null
        ? null
        : ONBOARDING_STEPS.find((step) => step.id === currentStepId)?.phase ?? null;
    const pastAudio =
      currentStepId === null ||
      currentPhase === "pautas" ||
      currentPhase === "roteiro" ||
      currentPhase === "video" ||
      (currentStepId !== null &&
        STEP_ORDER.indexOf(currentStepId) > STEP_ORDER.indexOf("avatar-audio"));
    if (pastAudio) {
      currentStepId = "avatar-audio";
    }
  }

  const currentMeta = currentStepId
    ? ONBOARDING_STEPS.find((step) => step.id === currentStepId) ?? null
    : null;
  const isComplete = currentStepId === null;
  const isActive =
    fromScratch || Boolean(input.persisted.replayRequested)
      ? !input.persisted.dismissed
      : !input.persisted.dismissed && !isComplete;

  const steps: OnboardingStepView[] = ONBOARDING_STEPS.map((step) => ({
    ...step,
    done: doneMap[step.id],
    current: step.id === currentStepId,
  }));

  const currentPhaseId = currentMeta?.phase ?? null;

  return {
    steps,
    currentStepId,
    currentPhaseId,
    currentPhaseStep: currentMeta?.phaseOrder ?? null,
    phaseStepCount: countPhaseSteps(currentPhaseId),
    isComplete,
    isActive,
    temasPhaseReady,
    selectedThemeCount: input.signals.selectedThemeCount,
    hasVoiceAudio: input.signals.hasVoiceAudio,
  };
}

export function resolveSidebarTarget(
  currentStepId: OnboardingStepId | null,
  _pathname: string,
): OnboardingSidebarTarget {
  if (!currentStepId) {
    return null;
  }
  return ONBOARDING_STEPS.find((step) => step.id === currentStepId)?.sidebar ?? null;
}

export function getStepDef(stepId: OnboardingStepId | null): OnboardingStepDef | null {
  if (!stepId) {
    return null;
  }
  return ONBOARDING_STEPS.find((step) => step.id === stepId) ?? null;
}

/** v2 — IDs granulares por esfera/avatar. */
const STORAGE_PREFIX = "md:onboarding:v2:";

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
      replayRequested: Boolean(parsed.replayRequested),
      tourFromScratch: Boolean(parsed.tourFromScratch),
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
    // Persistência é best-effort.
  }
}
