/**
 * Onboarding guiado (não fictício): progresso derivado do estado real do app
 * (UF/municípios, temas, assets de avatar, persona/glossário) + marcadores locais.
 *
 * A ordem dos passos da fase 1 segue a ordem visual da tela "Selecionar temas":
 * mapa de UF + municípios → temas de interesse → fontes/portais regionais →
 * perfis de rede sociais → adversários → Salvar radar.
 *
 * Fase 1 — Selecionar Temas (6 passos): Território → Temas → Fontes → Interesse → Adversário → Salvar
 * Fase 2 — Treinar Avatar (4 passos): Foto → Áudio → Persona → Glossário
 * Fase 3 — Monitoramento de Pautas (2 passos): como o radar atualiza → Pautar
 * Fase 4 — Criar Roteiro (4 passos): Arquétipo → Tom → Tema → Aprovar roteiro
 * Fase 5 — Produzir Vídeo (2 passos): Escolher avatar → Gerar vídeo
 */

import {
  MAX_INTEREST_THEMES,
  MAX_MUNICIPAL_CITIES,
  MAX_MUNICIPAL_PORTALS,
} from "@/lib/sphere-theme-catalog";

export type OnboardingPhaseId = "temas" | "avatar" | "pautas" | "roteiro" | "video";

export type OnboardingStepId =
  | "temas-territorio"
  | "temas-federal"
  | "temas-municipal"
  | "temas-interesse"
  | "temas-adversarios"
  | "temas-salvar"
  | "avatar-foto"
  | "avatar-audio"
  | "avatar-persona"
  | "avatar-glossario"
  | "pautas-radar"
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

/**
 * Lado da tela onde o tip deve ficar ancorado.
 * "auto" deixa o posicionador escolher (abaixo → acima → direita → esquerda).
 */
export type OnboardingTipPlacement = "auto" | "left" | "right";

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
  /**
   * Item do menu lateral que fica com aparência de "clicado" durante o passo.
   * `null` nos passos fora do menu (Calibragem de Persona e Glossário, em /curador).
   */
  sidebar: OnboardingSidebarTarget;
  /** Lado fixo do tip na tela (padrão: "auto"). */
  placement?: OnboardingTipPlacement;
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
    id: "temas-territorio",
    phase: "temas",
    phaseOrder: 1,
    label: "Estado e municípios",
    route: "/monitoramento/temas#territorio",
    anchor: "temas-territorio",
    sidebar: "temas-config",
  },
  {
    id: "temas-federal",
    phase: "temas",
    phaseOrder: 2,
    label: "Temas de interesse",
    route: "/monitoramento/temas#temas",
    anchor: "temas-federal",
    sidebar: "temas-config",
  },
  {
    id: "temas-municipal",
    phase: "temas",
    phaseOrder: 3,
    label: "Fontes do monitoramento",
    route: "/monitoramento/temas#municipal",
    anchor: "temas-municipal",
    sidebar: "temas-config",
    placement: "right",
  },
  {
    id: "temas-interesse",
    phase: "temas",
    phaseOrder: 4,
    label: "Perfis de rede sociais",
    route: "/monitoramento/temas#interesse",
    anchor: "temas-interesse",
    sidebar: "temas-config",
    placement: "right",
  },
  {
    id: "temas-adversarios",
    phase: "temas",
    phaseOrder: 5,
    label: "Adversários políticos",
    route: "/monitoramento/temas#adversarios",
    anchor: "temas-adversarios",
    sidebar: "temas-config",
    placement: "right",
  },
  {
    id: "temas-salvar",
    phase: "temas",
    phaseOrder: 6,
    label: "Salvar radar",
    route: "/monitoramento/temas#salvar",
    anchor: "temas-salvar",
    sidebar: "temas-config",
    placement: "right",
  },
  {
    id: "avatar-foto",
    phase: "avatar",
    phaseOrder: 1,
    label: "Enviar foto",
    route: "/avatares/foto-real/treinar#foto",
    anchor: "avatar-foto",
    sidebar: "avatar-config",
    placement: "right",
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
    // /curador não tem item próprio no menu — sem destaque lateral aqui.
    sidebar: null,
    placement: "right",
  },
  {
    id: "avatar-glossario",
    phase: "avatar",
    phaseOrder: 4,
    label: "Glossário de expressões",
    route: "/curador#glossario",
    anchor: "avatar-glossario",
    sidebar: null,
    placement: "right",
  },
  {
    id: "pautas-radar",
    phase: "pautas",
    phaseOrder: 1,
    label: "Como o radar atualiza",
    route: "/monitoramento",
    anchor: "pautas-radar",
    sidebar: "monitoramento",
    placement: "right",
  },
  {
    id: "pautas-pautar",
    phase: "pautas",
    phaseOrder: 2,
    label: "Pautar primeira pauta",
    route: "/monitoramento",
    anchor: "pautas-pautar",
    sidebar: "monitoramento",
    placement: "right",
  },
  {
    id: "criativo-arquetipo",
    phase: "roteiro",
    phaseOrder: 1,
    label: "Escolher Arquétipo",
    route: "/criativo/novo#arquetipo",
    anchor: "criativo-arquetipo",
    sidebar: "criativo",
    placement: "right",
  },
  {
    id: "criativo-tom",
    phase: "roteiro",
    phaseOrder: 2,
    label: "Escolher Tom de Linguagem",
    route: "/criativo/novo#tom",
    anchor: "criativo-tom",
    sidebar: "criativo",
    placement: "right",
  },
  {
    id: "criativo-tema",
    phase: "roteiro",
    phaseOrder: 3,
    label: "Tema do vídeo",
    route: "/criativo/novo#tema",
    anchor: "criativo-tema",
    sidebar: "criativo",
    placement: "right",
  },
  {
    id: "criativo-roteiro",
    phase: "roteiro",
    phaseOrder: 4,
    label: "Aprovação do roteiro",
    route: "/criativo/novo#roteiro",
    anchor: "criativo-roteiro",
    sidebar: "criativo",
    placement: "right",
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
    placement: "right",
  },
] as const;

export const ONBOARDING_GUIDE_COPY: Record<
  OnboardingStepId,
  { title: string; body: string }
> = {
  "temas-territorio": {
    title: "Estado e municípios",
    body: `Clique no mapa para escolher a UF do mandato e selecione até ${MAX_MUNICIPAL_CITIES} municípios da sua base. Trocar de estado limpa os municípios já escolhidos.`,
  },
  "temas-federal": {
    title: "Temas de interesse",
    body: `Selecione até ${String(MAX_INTEREST_THEMES).padStart(2, "0")} temas da sua bandeira e campanha. Vamos monitorar o cenário político em escala nacional, estadual e municipal para você.`,
  },
  "temas-municipal": {
    title: "Fontes do monitoramento",
    body: `As fontes nacionais e as do seu estado já estão definidas — para conferir basta clicar sobre Fontes Nacionais ou Estaduais. Acrescente até ${MAX_MUNICIPAL_PORTALS} portais regionais do(s) seu(s) município(s).`,
  },
  "temas-interesse": {
    title: "Perfis de rede sociais",
    body: "Cadastre contas @ do Instagram, TikTok ou Twitter/X para acompanhar. O radar mostra os últimos posts com foco em engajamento.",
  },
  "temas-adversarios": {
    title: "Adversários políticos",
    body: "Cadastre os perfis @ dos adversários. O radar lista os últimos posts deles por engajamento, em seção separada.",
  },
  "temas-salvar": {
    title: "Salvar radar",
    body: "Salve suas configurações para o monitoramento das pautas da sua campanha.",
  },
  "avatar-foto": {
    title: "Enviar foto",
    body: "Aceite a Política de Privacidade e envie uma foto nítida, seguindo rigorosamente as instruções do card “A Foto Perfeita”. Atenção: a foto é a base visual do avatar.",
  },
  "avatar-audio": {
    title: "Enviar áudio",
    body: "Grave ou envie um áudio limpo da sua voz conforme as instruções do card “A Voz Perfeita”. Sem esse áudio não é possível produzir o vídeo. A qualidade do áudio influencia a expressividade do avatar, além da própria voz.",
  },
  "avatar-persona": {
    title: "Calibragem de Persona",
    body: "Arraste a linha para calibrar seu posicionamento ideológico entre esquerda e direita. Os roteiros gerados seguirão essa orientação política.",
  },
  "avatar-glossario": {
    title: "Glossário de expressões",
    body: "Inclua expressões típicas da sua fala (né, tipo, olha, sabe). Elas são incorporadas aos roteiros para o texto soar com a sua voz.",
  },
  "pautas-radar": {
    title: "Como o radar atualiza",
    body: "As pautas chegam separadas em Nacional, Estadual, Municipal, Interesse e Adversários, com atualização automática às 08:00. Antecipar a atualização consome créditos.",
  },
  "pautas-pautar": {
    title: "Pautar notícia",
    body: "Este é o botão Pautar da primeira pauta do radar. Toque nele ou escolha outra pauta para gerar conteúdo com o seu avatar.",
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
    body: "Revise o texto, edite se precisar e clique em Aprovar roteiro. Esse será o texto utilizado para produção do vídeo.",
  },
  "criativo-avatar": {
    title: "Escolher avatar",
    body: "Escolha o modelo deste vídeo: Gêmeo Digital (sua foto com voz clonada), Caricato ou Mascote 3D. Caricato e Mascote precisam ser gerados antes em Avatares > Caricato > Regenerar Caricato.",
  },
  "criativo-gerar": {
    title: "Gerar o vídeo",
    body: "Com roteiro aprovado e avatar escolhido, clique em Gerar Conteúdo. O selo TSE é aplicado automaticamente ao final.",
  },
};

const STEP_ORDER: readonly OnboardingStepId[] = ONBOARDING_STEPS.map((step) => step.id);

export function countPhaseSteps(phaseId: OnboardingPhaseId | null): number {
  if (!phaseId) {
    return 0;
  }
  return ONBOARDING_STEPS.filter((step) => step.phase === phaseId).length;
}

/** Mínimo de temas de interesse para liberar a fase 1 sem rede social. */
export const TEMAS_PHASE_MIN_THEMES = 5;

export type OnboardingSignals = {
  hasFederalThemes: boolean;
  /** UF do mandato escolhida no mapa (seção Estado/Município). */
  hasCoverageUf: boolean;
  /** Portal regional informado no bloco Nível Municipal. */
  hasMunicipalSignal: boolean;
  hasInterestSignal: boolean;
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
  /** "Salvar radar" já foi clicado nesta trilha — libera o Próximo do passo 6. */
  radarSaved?: boolean;
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
    "temas-territorio": signals.hasCoverageUf,
    "temas-federal": signals.hasFederalThemes,
    "temas-municipal": signals.hasMunicipalSignal,
    "temas-interesse": signals.hasInterestSignal,
    "temas-adversarios": signals.hasOppositionSignal,
    // Salvar radar só fecha via Próximo/localDone — o perfil salvo não distingue
    // "salvei agora" de "já existia".
    "temas-salvar": false,
    "avatar-foto": signals.hasAvatarImage,
    "avatar-audio": signals.hasVoiceAudio,
    // Spectrum costuma vir com default — persona só fecha via Próximo/localDone.
    "avatar-persona": false,
    "avatar-glossario": signals.hasGlossary,
    // Fecham via Próximo/Pautar (localDone) — não há sinal de app.
    "pautas-radar": false,
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
      currentStepId = "temas-salvar";
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
      radarSaved: Boolean(parsed.radarSaved),
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
