"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { usePathname } from "next/navigation";

import { useProductApp } from "./provider";
import type { ProfileFormState } from "./shared";
import {
  computeOnboarding,
  EMPTY_ONBOARDING_STATE,
  readOnboardingState,
  resolveSidebarTarget,
  writeOnboardingState,
  type OnboardingComputed,
  type OnboardingPersistedState,
  type OnboardingSidebarTarget,
  type OnboardingSignals,
  type OnboardingStepId,
} from "@/lib/onboarding";

/**
 * Mensagens-ponte guiadas, disparadas nos eventos reais de sucesso do sistema
 * (radar salvo, uploads concluídos, vídeo em produção). O componente de modal é
 * montado numa etapa posterior; aqui mantemos apenas o estado.
 */
export type OnboardingBridge = "afterRadar" | "afterUploads" | "compliance" | null;

type OnboardingContextValue = OnboardingComputed & {
  /** Evita divergência de hidratação: só true após montar no cliente. */
  mounted: boolean;
  sidebarTarget: OnboardingSidebarTarget;
  bridge: OnboardingBridge;
  /** Modal de boas-vindas deve aparecer (ativo, montado e ainda não visto). */
  showWelcome: boolean;
  markStepDone: (step: OnboardingStepId) => void;
  markWelcomeSeen: () => void;
  showBridge: (bridge: Exclude<OnboardingBridge, null>) => void;
  closeBridge: () => void;
  dismiss: () => void;
  reset: () => void;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

function countRadarThemes(profileForm: ProfileFormState): number {
  const federal = profileForm.sentinelThemesFederal?.length ?? 0;
  const estadual = profileForm.sentinelThemesEstadual?.length ?? 0;
  const custom = (profileForm.customRadarThemes ?? []).filter((theme) => theme.trim()).length;
  return federal + estadual + custom;
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { profileForm, trainingAssets, contents, isGenerating, sessionUser } = useProductApp();

  /** Cadastro obrigatório ainda não é o produto — onboarding não compete com ele. */
  const onRegistrationPath = pathname.startsWith("/acesso-antecipado");

  const userKey = sessionUser?.id ?? sessionUser?.email ?? null;

  const [mounted, setMounted] = useState(false);
  const [persisted, setPersisted] = useState<OnboardingPersistedState>(EMPTY_ONBOARDING_STATE);
  const [bridge, setBridge] = useState<OnboardingBridge>(null);

  // Hidrata o estado persistido apenas no cliente, evitando mismatch de SSR.
  useEffect(() => {
    setPersisted(readOnboardingState(userKey));
    setMounted(true);
  }, [userKey]);

  const persist = useCallback(
    (next: OnboardingPersistedState) => {
      setPersisted(next);
      writeOnboardingState(userKey, next);
    },
    [userKey],
  );

  const signals = useMemo<OnboardingSignals>(
    () => ({
      hasRadarThemes: countRadarThemes(profileForm) > 0,
      hasAvatarImage: trainingAssets.some((asset) => asset.trainingRole === "avatar_image"),
      hasVoiceAudio: trainingAssets.some((asset) => asset.trainingRole === "voice_audio"),
      hasGeneratedContent: contents.length > 0,
    }),
    [profileForm, trainingAssets, contents],
  );

  const computed = useMemo(
    () => computeOnboarding({ signals, persisted }),
    [signals, persisted],
  );

  const markStepDone = useCallback(
    (step: OnboardingStepId) => {
      setPersisted((current) => {
        const localDone = new Set(current.localDone ?? []);
        if (localDone.has(step)) {
          return current;
        }
        localDone.add(step);
        const next = { ...current, localDone: Array.from(localDone) };
        writeOnboardingState(userKey, next);
        return next;
      });
    },
    [userKey],
  );

  const markWelcomeSeen = useCallback(() => {
    setPersisted((current) => {
      if (current.welcomeSeen) {
        return current;
      }
      const next = { ...current, welcomeSeen: true };
      writeOnboardingState(userKey, next);
      return next;
    });
  }, [userKey]);

  const showBridge = useCallback((next: Exclude<OnboardingBridge, null>) => {
    setBridge(next);
  }, []);
  const closeBridge = useCallback(() => setBridge(null), []);

  const dismiss = useCallback(() => {
    persist({ ...persisted, dismissed: true });
    setBridge(null);
  }, [persist, persisted]);

  const reset = useCallback(() => {
    persist(EMPTY_ONBOARDING_STATE);
    setBridge(null);
  }, [persist]);

  const isActive = computed.isActive && !onRegistrationPath;

  const sidebarTarget = useMemo(
    () => (isActive ? resolveSidebarTarget(computed.currentStepId, pathname) : null),
    [isActive, computed.currentStepId, pathname],
  );

  // Dispara as mensagens-ponte a partir das transições de estado real
  // (radar salvo, uploads concluídos, geração iniciada). O primeiro efeito
  // pós-hidratação apenas registra a linha de base, evitando disparo espúrio.
  const prevStepRef = useRef<OnboardingStepId | null>(null);
  const prevGeneratingRef = useRef(false);
  const baselineRef = useRef(false);
  useEffect(() => {
    if (!mounted) {
      return;
    }
    if (!baselineRef.current) {
      baselineRef.current = true;
      prevStepRef.current = computed.currentStepId;
      prevGeneratingRef.current = isGenerating;
      return;
    }

    const prevStep = prevStepRef.current;
    const wasGenerating = prevGeneratingRef.current;
    prevStepRef.current = computed.currentStepId;
    prevGeneratingRef.current = isGenerating;

    if (!isActive) {
      return;
    }

    if (prevStep === "temas" && computed.currentStepId === "avatar") {
      setBridge("afterRadar");
    } else if (prevStep === "avatar" && computed.currentStepId === "noticias") {
      setBridge("afterUploads");
    }

    if (!wasGenerating && isGenerating && computed.currentStepId === "gerar") {
      setBridge("compliance");
    }
  }, [computed.currentStepId, isActive, isGenerating, mounted]);

  // "Ver notícias dos temas" não tem rastro no backend: conclui quando o usuário
  // pauta (chega na tela de criação do criativo). Derivado da rota, sem tocar telas.
  useEffect(() => {
    if (!mounted || !isActive) {
      return;
    }
    if (computed.currentStepId === "noticias" && pathname.startsWith("/criativo/novo")) {
      markStepDone("noticias");
    }
  }, [mounted, isActive, computed.currentStepId, pathname, markStepDone]);

  const showWelcome = mounted && isActive && !persisted.welcomeSeen;

  const value: OnboardingContextValue = {
    ...computed,
    isActive,
    mounted,
    sidebarTarget,
    bridge: onRegistrationPath ? null : bridge,
    showWelcome,
    markStepDone,
    markWelcomeSeen,
    showBridge,
    closeBridge,
    dismiss,
    reset,
  };

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboarding deve ser usado dentro de OnboardingProvider.");
  }
  return context;
}
