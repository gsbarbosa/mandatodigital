import { describe, expect, it } from "vitest";

import {
  computeOnboarding,
  deriveAppDone,
  onboardingStorageKey,
  resolveSidebarTarget,
  type OnboardingSignals,
} from "./onboarding";

const NO_SIGNALS: OnboardingSignals = {
  hasRadarThemes: false,
  hasAvatarImage: false,
  hasVoiceAudio: false,
  hasGeneratedContent: false,
};

function stepById(result: ReturnType<typeof computeOnboarding>, id: string) {
  const step = result.steps.find((s) => s.id === id);
  if (!step) {
    throw new Error(`etapa ${id} não encontrada`);
  }
  return step;
}

describe("deriveAppDone", () => {
  it("marca avatar apenas com foto E voz", () => {
    expect(deriveAppDone({ ...NO_SIGNALS, hasAvatarImage: true }).avatar).toBe(false);
    expect(
      deriveAppDone({ ...NO_SIGNALS, hasAvatarImage: true, hasVoiceAudio: true }).avatar,
    ).toBe(true);
  });

  it("conteúdo gerado conclui ver-notícias e gerar", () => {
    const done = deriveAppDone({ ...NO_SIGNALS, hasGeneratedContent: true });
    expect(done.noticias).toBe(true);
    expect(done.gerar).toBe(true);
  });
});

describe("computeOnboarding", () => {
  it("usuário novo começa ativo na etapa 1", () => {
    const result = computeOnboarding({ signals: NO_SIGNALS, persisted: {} });
    expect(result.isActive).toBe(true);
    expect(result.isComplete).toBe(false);
    expect(result.currentStepId).toBe("temas");
    expect(stepById(result, "temas").current).toBe(true);
  });

  it("radar salvo avança para treinar avatar", () => {
    const result = computeOnboarding({
      signals: { ...NO_SIGNALS, hasRadarThemes: true },
      persisted: {},
    });
    expect(stepById(result, "temas").done).toBe(true);
    expect(result.currentStepId).toBe("avatar");
  });

  it("preenchimento monotônico: avatar pronto conclui temas mesmo sem radar derivável", () => {
    const result = computeOnboarding({
      signals: { ...NO_SIGNALS, hasAvatarImage: true, hasVoiceAudio: true },
      persisted: {},
    });
    expect(stepById(result, "temas").done).toBe(true);
    expect(stepById(result, "avatar").done).toBe(true);
    expect(result.currentStepId).toBe("noticias");
  });

  it("conteúdo gerado conclui o onboarding e some a trilha", () => {
    const result = computeOnboarding({
      signals: { ...NO_SIGNALS, hasGeneratedContent: true },
      persisted: {},
    });
    expect(result.isComplete).toBe(true);
    expect(result.isActive).toBe(false);
    expect(result.currentStepId).toBeNull();
  });

  it("dispensar desativa a trilha mesmo incompleta", () => {
    const result = computeOnboarding({ signals: NO_SIGNALS, persisted: { dismissed: true } });
    expect(result.isActive).toBe(false);
    expect(result.isComplete).toBe(false);
  });

  it("marcador local conclui etapa puramente visual", () => {
    const result = computeOnboarding({ signals: NO_SIGNALS, persisted: { localDone: ["temas"] } });
    expect(stepById(result, "temas").done).toBe(true);
    expect(result.currentStepId).toBe("avatar");
  });
});

describe("resolveSidebarTarget", () => {
  it("mapeia etapa atual para o item do menu", () => {
    expect(resolveSidebarTarget("temas", "/monitoramento")).toBe("monitoramento");
    expect(resolveSidebarTarget("temas", "/monitoramento/temas")).toBe("temas-config");
    expect(resolveSidebarTarget("avatar", "/avatares/foto-real/treinar")).toBe("avatar-config");
    expect(resolveSidebarTarget("noticias", "/monitoramento")).toBe("monitoramento");
    expect(resolveSidebarTarget("gerar", "/criativo/novo")).toBe("criativos");
    expect(resolveSidebarTarget(null, "/monitoramento")).toBeNull();
  });
});

describe("onboardingStorageKey", () => {
  it("isola por usuário e cai para anon", () => {
    expect(onboardingStorageKey("user-123")).toBe("md:onboarding:v1:user-123");
    expect(onboardingStorageKey(null)).toBe("md:onboarding:v1:anon");
    expect(onboardingStorageKey("  ")).toBe("md:onboarding:v1:anon");
  });
});
