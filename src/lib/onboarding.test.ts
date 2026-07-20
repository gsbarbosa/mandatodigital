import { describe, expect, it } from "vitest";

import {
  computeOnboarding,
  deriveAppDone,
  meetsTemasPhaseGate,
  onboardingStorageKey,
  resolveSidebarTarget,
  TEMAS_PHASE_MIN_THEMES,
  type OnboardingSignals,
} from "./onboarding";

const NO_SIGNALS: OnboardingSignals = {
  hasFederalThemes: false,
  hasEstadualThemes: false,
  hasMunicipalSignal: false,
  hasOppositionSignal: false,
  hasAvatarImage: false,
  hasVoiceAudio: false,
  hasPersonaSpectrum: false,
  hasGlossary: false,
  selectedThemeCount: 0,
  hasSocialProfile: false,
};

function stepById(result: ReturnType<typeof computeOnboarding>, id: string) {
  const step = result.steps.find((s) => s.id === id);
  if (!step) {
    throw new Error(`etapa ${id} não encontrada`);
  }
  return step;
}

describe("meetsTemasPhaseGate", () => {
  it("exige 5 temas sem rede social", () => {
    expect(
      meetsTemasPhaseGate({
        ...NO_SIGNALS,
        selectedThemeCount: TEMAS_PHASE_MIN_THEMES - 1,
      }),
    ).toBe(false);
    expect(
      meetsTemasPhaseGate({
        ...NO_SIGNALS,
        selectedThemeCount: TEMAS_PHASE_MIN_THEMES,
      }),
    ).toBe(true);
  });

  it("1 rede social libera mesmo com poucos temas", () => {
    expect(
      meetsTemasPhaseGate({
        ...NO_SIGNALS,
        selectedThemeCount: 1,
        hasSocialProfile: true,
      }),
    ).toBe(true);
  });
});

describe("deriveAppDone", () => {
  it("marca foto e áudio de forma independente", () => {
    expect(deriveAppDone({ ...NO_SIGNALS, hasAvatarImage: true })["avatar-foto"]).toBe(true);
    expect(deriveAppDone({ ...NO_SIGNALS, hasAvatarImage: true })["avatar-audio"]).toBe(false);
    expect(deriveAppDone({ ...NO_SIGNALS, hasVoiceAudio: true })["avatar-audio"]).toBe(true);
  });

  it("marca esferas de temas separadamente", () => {
    const done = deriveAppDone({
      ...NO_SIGNALS,
      hasFederalThemes: true,
      hasEstadualThemes: true,
    });
    expect(done["temas-federal"]).toBe(true);
    expect(done["temas-estadual"]).toBe(true);
    expect(done["temas-municipal"]).toBe(false);
    expect(done["temas-adversarios"]).toBe(false);
  });
});

describe("computeOnboarding", () => {
  it("usuário novo começa no nível nacional", () => {
    const result = computeOnboarding({ signals: NO_SIGNALS, persisted: {} });
    expect(result.isActive).toBe(true);
    expect(result.currentStepId).toBe("temas-federal");
    expect(result.currentPhaseId).toBe("temas");
    expect(result.currentPhaseStep).toBe(1);
    expect(result.temasPhaseReady).toBe(false);
    expect(stepById(result, "temas-federal").current).toBe(true);
  });

  it("após temas federais avança para estadual", () => {
    const result = computeOnboarding({
      signals: { ...NO_SIGNALS, hasFederalThemes: true, selectedThemeCount: 1 },
      persisted: {},
    });
    expect(stepById(result, "temas-federal").done).toBe(true);
    expect(result.currentStepId).toBe("temas-estadual");
    expect(result.currentPhaseStep).toBe(2);
  });

  it("4 temas sem rede social não libera a fase de temas", () => {
    const result = computeOnboarding({
      signals: {
        ...NO_SIGNALS,
        hasFederalThemes: true,
        hasEstadualThemes: true,
        hasMunicipalSignal: true,
        hasOppositionSignal: true,
        selectedThemeCount: 4,
        hasSocialProfile: false,
      },
      persisted: {},
    });
    expect(result.temasPhaseReady).toBe(false);
    expect(result.currentPhaseId).toBe("temas");
    expect(result.currentStepId).toBe("temas-adversarios");
  });

  it("5 temas sem rede social libera a fase de avatar", () => {
    const result = computeOnboarding({
      signals: {
        ...NO_SIGNALS,
        hasFederalThemes: true,
        hasEstadualThemes: true,
        hasMunicipalSignal: true,
        hasOppositionSignal: true,
        selectedThemeCount: 5,
        hasSocialProfile: false,
      },
      persisted: {},
    });
    expect(result.temasPhaseReady).toBe(true);
    expect(result.currentPhaseId).toBe("avatar");
    expect(result.currentStepId).toBe("avatar-foto");
  });

  it("1 tema + 1 rede social libera a fase de avatar", () => {
    const result = computeOnboarding({
      signals: {
        ...NO_SIGNALS,
        hasFederalThemes: true,
        hasMunicipalSignal: true,
        hasOppositionSignal: true,
        selectedThemeCount: 1,
        hasSocialProfile: true,
      },
      persisted: {},
    });
    expect(result.temasPhaseReady).toBe(true);
    expect(result.currentPhaseId).toBe("avatar");
    expect(result.currentStepId).toBe("avatar-foto");
  });

  it("fase de avatar começa na foto após temas completos com gate", () => {
    const result = computeOnboarding({
      signals: {
        ...NO_SIGNALS,
        hasFederalThemes: true,
        hasEstadualThemes: true,
        hasMunicipalSignal: true,
        hasOppositionSignal: true,
        selectedThemeCount: 5,
        hasSocialProfile: false,
      },
      persisted: {},
    });
    expect(result.currentPhaseId).toBe("avatar");
    expect(result.currentStepId).toBe("avatar-foto");
  });

  it("preenchimento monotônico sem radar mínimo não pula o gate", () => {
    const result = computeOnboarding({
      signals: { ...NO_SIGNALS, hasGlossary: true },
      persisted: {},
    });
    expect(stepById(result, "temas-federal").done).toBe(true);
    expect(stepById(result, "avatar-glossario").done).toBe(true);
    expect(result.temasPhaseReady).toBe(false);
    expect(result.currentPhaseId).toBe("temas");
    expect(result.currentStepId).toBe("temas-adversarios");
    expect(result.isComplete).toBe(false);
  });

  it("glossário + radar mínimo sem áudio fica em enviar áudio", () => {
    const result = computeOnboarding({
      signals: {
        ...NO_SIGNALS,
        hasGlossary: true,
        selectedThemeCount: 5,
        hasSocialProfile: false,
      },
      persisted: {},
    });
    expect(result.temasPhaseReady).toBe(true);
    expect(result.isComplete).toBe(false);
    expect(result.currentPhaseId).toBe("avatar");
    expect(result.currentStepId).toBe("avatar-audio");
    expect(stepById(result, "avatar-audio").done).toBe(false);
  });

  it("glossário + radar mínimo + áudio avança para monitoramento de pautas", () => {
    const result = computeOnboarding({
      signals: {
        ...NO_SIGNALS,
        hasGlossary: true,
        hasVoiceAudio: true,
        selectedThemeCount: 5,
        hasSocialProfile: false,
      },
      persisted: {},
    });
    expect(result.temasPhaseReady).toBe(true);
    expect(result.isComplete).toBe(false);
    expect(result.currentPhaseId).toBe("pautas");
    expect(result.currentStepId).toBe("pautas-pautar");
    expect(result.phaseStepCount).toBe(1);
  });

  it("após pautar avança para criar roteiro", () => {
    const result = computeOnboarding({
      signals: {
        ...NO_SIGNALS,
        hasGlossary: true,
        hasVoiceAudio: true,
        selectedThemeCount: 5,
      },
      persisted: { localDone: ["pautas-pautar"] },
    });
    expect(result.isComplete).toBe(false);
    expect(result.currentPhaseId).toBe("roteiro");
    expect(result.currentStepId).toBe("criativo-arquetipo");
    expect(result.phaseStepCount).toBe(4);
  });

  it("roteiro completo avança para produzir vídeo", () => {
    const result = computeOnboarding({
      signals: {
        ...NO_SIGNALS,
        hasGlossary: true,
        hasVoiceAudio: true,
        selectedThemeCount: 5,
      },
      persisted: {
        localDone: [
          "pautas-pautar",
          "criativo-arquetipo",
          "criativo-tom",
          "criativo-tema",
          "criativo-roteiro",
        ],
      },
    });
    expect(result.currentPhaseId).toBe("video");
    expect(result.currentStepId).toBe("criativo-avatar");
    expect(result.phaseStepCount).toBe(2);
  });

  it("sem áudio não fica preso em Nova pauta — rebobina para enviar áudio", () => {
    const result = computeOnboarding({
      signals: {
        ...NO_SIGNALS,
        hasGlossary: true,
        hasVoiceAudio: false,
        selectedThemeCount: 5,
      },
      persisted: {
        localDone: [
          "avatar-audio",
          "avatar-persona",
          "avatar-glossario",
          "pautas-pautar",
          "criativo-arquetipo",
          "criativo-tom",
          "criativo-tema",
          "criativo-roteiro",
          "criativo-avatar",
        ],
      },
    });
    expect(result.hasVoiceAudio).toBe(false);
    expect(stepById(result, "avatar-audio").done).toBe(false);
    expect(result.currentPhaseId).toBe("avatar");
    expect(result.currentStepId).toBe("avatar-audio");
  });

  it("gerar vídeo concluído fecha o onboarding", () => {
    const result = computeOnboarding({
      signals: {
        ...NO_SIGNALS,
        hasGlossary: true,
        hasVoiceAudio: true,
        selectedThemeCount: 5,
      },
      persisted: {
        localDone: [
          "pautas-pautar",
          "criativo-arquetipo",
          "criativo-tom",
          "criativo-tema",
          "criativo-roteiro",
          "criativo-avatar",
          "criativo-gerar",
        ],
      },
    });
    expect(result.isComplete).toBe(true);
    expect(result.currentStepId).toBeNull();
  });

  it("dispensar desativa a trilha mesmo incompleta", () => {
    const result = computeOnboarding({ signals: NO_SIGNALS, persisted: { dismissed: true } });
    expect(result.isActive).toBe(false);
  });

  it("replay reativa mesmo completo", () => {
    const complete = computeOnboarding({
      signals: {
        ...NO_SIGNALS,
        hasGlossary: true,
        hasVoiceAudio: true,
        selectedThemeCount: 5,
      },
      persisted: {
        replayRequested: true,
        localDone: [
          "pautas-pautar",
          "criativo-arquetipo",
          "criativo-tom",
          "criativo-tema",
          "criativo-roteiro",
          "criativo-avatar",
          "criativo-gerar",
        ],
      },
    });
    expect(complete.isComplete).toBe(true);
    expect(complete.isActive).toBe(true);
  });

  it("tour do zero ignora sinais do app e começa no nacional", () => {
    const result = computeOnboarding({
      signals: {
        ...NO_SIGNALS,
        hasFederalThemes: true,
        hasEstadualThemes: true,
        hasMunicipalSignal: true,
        hasOppositionSignal: true,
        hasAvatarImage: true,
        hasVoiceAudio: true,
        hasGlossary: true,
        selectedThemeCount: 5,
        hasSocialProfile: true,
      },
      persisted: { tourFromScratch: true, localDone: [] },
    });
    expect(result.isActive).toBe(true);
    expect(result.isComplete).toBe(false);
    expect(result.currentStepId).toBe("temas-federal");
    expect(stepById(result, "temas-federal").done).toBe(false);
    expect(stepById(result, "avatar-glossario").done).toBe(false);
  });

  it("tour do zero só avança com localDone", () => {
    const result = computeOnboarding({
      signals: { ...NO_SIGNALS, hasFederalThemes: true, selectedThemeCount: 5 },
      persisted: { tourFromScratch: true, localDone: ["temas-federal"] },
    });
    expect(stepById(result, "temas-federal").done).toBe(true);
    expect(result.currentStepId).toBe("temas-estadual");
  });

  it("tour do zero com todos localDone ainda respeita o gate de radar", () => {
    const result = computeOnboarding({
      signals: { ...NO_SIGNALS, selectedThemeCount: 2, hasSocialProfile: false },
      persisted: {
        tourFromScratch: true,
        localDone: [
          "temas-federal",
          "temas-estadual",
          "temas-municipal",
          "temas-adversarios",
          "avatar-foto",
        ],
      },
    });
    expect(result.temasPhaseReady).toBe(false);
    expect(result.currentPhaseId).toBe("temas");
    expect(result.currentStepId).toBe("temas-adversarios");
  });

  it("marcador local conclui etapa", () => {
    const result = computeOnboarding({
      signals: NO_SIGNALS,
      persisted: { localDone: ["temas-federal"] },
    });
    expect(stepById(result, "temas-federal").done).toBe(true);
    expect(result.currentStepId).toBe("temas-estadual");
  });
});

describe("resolveSidebarTarget", () => {
  it("mapeia etapa atual para o item do menu", () => {
    expect(resolveSidebarTarget("temas-federal", "/monitoramento/temas")).toBe("temas-config");
    expect(resolveSidebarTarget("avatar-foto", "/avatares/foto-real/treinar")).toBe("avatar-config");
    expect(resolveSidebarTarget("avatar-persona", "/curador")).toBe("avatar-config");
    expect(resolveSidebarTarget("pautas-pautar", "/monitoramento")).toBe("monitoramento");
    expect(resolveSidebarTarget("criativo-arquetipo", "/criativo/novo")).toBe("criativo");
    expect(resolveSidebarTarget("criativo-gerar", "/criativo/novo")).toBe("criativo");
    expect(resolveSidebarTarget(null, "/monitoramento")).toBeNull();
  });
});

describe("onboardingStorageKey", () => {
  it("isola por usuário na v2", () => {
    expect(onboardingStorageKey("user-123")).toBe("md:onboarding:v2:user-123");
    expect(onboardingStorageKey(null)).toBe("md:onboarding:v2:anon");
  });
});
