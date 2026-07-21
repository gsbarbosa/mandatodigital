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

import { usePathname, useRouter } from "next/navigation";

import { useProductApp } from "./provider";
import { parseTextarea, type ProfileFormState } from "./shared";
import {
  computeOnboarding,
  EMPTY_ONBOARDING_STATE,
  getStepDef,
  ONBOARDING_STEPS,
  readOnboardingState,
  resolveSidebarTarget,
  writeOnboardingState,
  type OnboardingComputed,
  type OnboardingPersistedState,
  type OnboardingSidebarTarget,
  type OnboardingSignals,
  type OnboardingStepId,
} from "@/lib/onboarding";

export type OnboardingBridge =
  | "afterThemes"
  | "afterAvatar"
  | "afterPautas"
  | "afterRoteiro"
  | "afterUploads"
  | "compliance"
  | null;

type OnboardingContextValue = OnboardingComputed & {
  mounted: boolean;
  sidebarTarget: OnboardingSidebarTarget;
  bridge: OnboardingBridge;
  showWelcome: boolean;
  guideOpen: boolean;
  guideStepId: OnboardingStepId | null;
  markStepDone: (step: OnboardingStepId) => void;
  markWelcomeSeen: () => void;
  startGuide: (step?: OnboardingStepId) => void;
  closeGuide: () => void;
  showBridge: (bridge: Exclude<OnboardingBridge, null>) => void;
  closeBridge: () => void;
  dismiss: () => void;
  restartOnboarding: () => void;
  reset: () => void;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

function buildSignals(
  profileForm: ProfileFormState,
  trainingAssets: { trainingRole?: string | null }[],
): OnboardingSignals {
  const federalCount = profileForm.sentinelThemesFederal?.length ?? 0;
  const estadualCount = profileForm.sentinelThemesEstadual?.length ?? 0;
  const hasInterestSocial = (profileForm.interestProfiles ?? []).some((row) =>
    row.handle?.trim(),
  );
  const hasOppositionSocial = (profileForm.oppositionProfiles ?? []).some((row) =>
    row.handle?.trim(),
  );
  const hasMunicipalSignal =
    (profileForm.customRadarThemes ?? []).some((theme) => theme.trim()) ||
    (profileForm.interestSites ?? []).some((site) => site.trim()) ||
    hasInterestSocial;

  return {
    hasFederalThemes: federalCount > 0,
    hasEstadualThemes: estadualCount > 0,
    hasMunicipalSignal,
    hasOppositionSignal: hasOppositionSocial,
    hasAvatarImage: trainingAssets.some((asset) => asset.trainingRole === "avatar_image"),
    hasVoiceAudio: trainingAssets.some((asset) => asset.trainingRole === "voice_audio"),
    hasPersonaSpectrum: Boolean(profileForm.spectrum?.trim()),
    hasGlossary: parseTextarea(profileForm.glossaryTerms ?? "").length > 0,
    selectedThemeCount: federalCount + estadualCount,
    hasSocialProfile: hasInterestSocial || hasOppositionSocial,
  };
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profileForm, trainingAssets, sessionUser, saveProfile } = useProductApp();
  const saveProfileRef = useRef(saveProfile);
  saveProfileRef.current = saveProfile;

  const onRegistrationPath = pathname.startsWith("/acesso-antecipado");
  const userKey = sessionUser?.id ?? sessionUser?.email ?? null;

  const [mounted, setMounted] = useState(false);
  const [persisted, setPersisted] = useState<OnboardingPersistedState>(EMPTY_ONBOARDING_STATE);
  const [bridge, setBridge] = useState<OnboardingBridge>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideStepId, setGuideStepId] = useState<OnboardingStepId | null>(null);

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

  const signals = useMemo(
    () => buildSignals(profileForm, trainingAssets),
    [profileForm, trainingAssets],
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
    setGuideOpen(false);
    setBridge(next);
  }, []);
  const closeBridge = useCallback(() => setBridge(null), []);
  const closeGuide = useCallback(() => setGuideOpen(false), []);

  const startGuide = useCallback(
    (step?: OnboardingStepId) => {
      const target = step ?? computed.currentStepId;
      if (!target) {
        setGuideOpen(false);
        setGuideStepId(null);
        return;
      }
      setGuideStepId(target);
      setGuideOpen(true);
      setBridge(null);
    },
    [computed.currentStepId],
  );

  const dismiss = useCallback(() => {
    persist({
      ...persisted,
      dismissed: true,
      replayRequested: false,
      tourFromScratch: false,
    });
    setBridge(null);
    setGuideOpen(false);
    setGuideStepId(null);
  }, [persist, persisted]);

  const restartOnboarding = useCallback(() => {
    const next: OnboardingPersistedState = {
      dismissed: false,
      welcomeSeen: false,
      replayRequested: true,
      tourFromScratch: true,
      localDone: [],
    };
    persist(next);
    setBridge(null);
    setGuideStepId("temas-federal");
    setGuideOpen(false);
  }, [persist]);

  const reset = useCallback(() => {
    persist(EMPTY_ONBOARDING_STATE);
    setBridge(null);
    setGuideOpen(false);
    setGuideStepId(null);
  }, [persist]);

  // Tour do zero concluído → sai do modo scratch (dados reais voltam a valer).
  useEffect(() => {
    if (!mounted || !persisted.tourFromScratch || !computed.isComplete) {
      return;
    }
    persist({
      ...persisted,
      tourFromScratch: false,
      replayRequested: false,
      welcomeSeen: true,
    });
    setGuideOpen(false);
    setGuideStepId(null);
  }, [mounted, persisted, computed.isComplete, persist]);

  const isActive = computed.isActive && !onRegistrationPath;

  const sidebarTarget = useMemo(
    () =>
      isActive
        ? resolveSidebarTarget(
            guideOpen && guideStepId ? guideStepId : computed.currentStepId,
            pathname,
          )
        : null,
    [isActive, guideOpen, guideStepId, computed.currentStepId, pathname],
  );

  // Ponte ao concluir a fase de temas → avatar
  const prevPhaseRef = useRef<string | null>(null);
  const baselineRef = useRef(false);
  useEffect(() => {
    if (!mounted) {
      return;
    }
    if (!baselineRef.current) {
      baselineRef.current = true;
      prevPhaseRef.current = computed.currentPhaseId;
      return;
    }

    const prevPhase = prevPhaseRef.current;
    prevPhaseRef.current = computed.currentPhaseId;

    if (!isActive) {
      return;
    }

    if (prevPhase === "temas" && computed.currentPhaseId === "avatar") {
      setGuideOpen(false);
      setBridge("afterThemes");
      // Persiste o radar e dispara busca de pautas em background (via /api/profile)
      // enquanto o usuário segue para foto/áudio.
      void saveProfileRef.current({
        allowDraftDefaults: true,
        silent: true,
        sentinelRefreshPolicy: "onboarding",
      });
    }

    if (prevPhase === "avatar" && computed.currentPhaseId === "pautas") {
      setGuideOpen(false);
      setBridge("afterAvatar");
    }

    if (prevPhase === "pautas" && computed.currentPhaseId === "roteiro") {
      setGuideOpen(false);
      setBridge("afterPautas");
    }

    if (prevPhase === "roteiro" && computed.currentPhaseId === "video") {
      setGuideOpen(false);
      setBridge("afterRoteiro");
    }
  }, [computed.currentPhaseId, isActive, mounted]);

  // Ao concluir a etapa guiada, avança o tooltip
  useEffect(() => {
    if (!guideOpen || !guideStepId) {
      return;
    }
    const guided = computed.steps.find((step) => step.id === guideStepId);
    if (guided?.done && computed.currentStepId) {
      setGuideStepId(computed.currentStepId);
    } else if (guided?.done && !computed.currentStepId) {
      setGuideOpen(false);
      setGuideStepId(null);
    }
  }, [guideOpen, guideStepId, computed.steps, computed.currentStepId]);

  // Se o progresso foi rebobinado (ex.: falta áudio), traz o tip de volta e leva à rota certa.
  useEffect(() => {
    if (!mounted || !isActive || !guideOpen || !guideStepId || !computed.currentStepId) {
      return;
    }
    const order = ONBOARDING_STEPS.map((step) => step.id);
    const guideIdx = order.indexOf(guideStepId);
    const currentIdx = order.indexOf(computed.currentStepId);
    if (guideIdx < 0 || currentIdx < 0 || guideIdx <= currentIdx) {
      return;
    }

    const target = computed.currentStepId;
    setGuideStepId(target);
    const route = getStepDef(target)?.route;
    if (!route) {
      return;
    }
    const path = route.includes("#") ? route.slice(0, route.indexOf("#")) : route;
    if (pathname !== path && !pathname.startsWith(`${path}/`)) {
      router.push(route as Parameters<typeof router.push>[0]);
    }
  }, [
    mounted,
    isActive,
    guideOpen,
    guideStepId,
    computed.currentStepId,
    pathname,
    router,
  ]);

  const showWelcome = mounted && isActive && !persisted.welcomeSeen;

  const value: OnboardingContextValue = {
    ...computed,
    isActive,
    mounted,
    sidebarTarget,
    bridge: onRegistrationPath ? null : bridge,
    showWelcome,
    guideOpen: isActive && !showWelcome && guideOpen,
    guideStepId,
    markStepDone,
    markWelcomeSeen,
    startGuide,
    closeGuide,
    showBridge,
    closeBridge,
    dismiss,
    restartOnboarding,
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

export { getStepDef };
