"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { useOnboarding } from "./onboarding-provider";
import {
  getStepDef,
  ONBOARDING_GUIDE_COPY,
  ONBOARDING_PHASES,
  ONBOARDING_STEPS,
  type OnboardingStepId,
  type OnboardingTipPlacement,
} from "@/lib/onboarding";
import { placeOnboardingTip, type TipBox } from "@/lib/onboarding-tip-position";

type AnchorRect = { top: number; left: number; width: number; height: number };

const TIP_WIDTH = 320;
const TIP_HEIGHT_EST = 220;

function readAnchorRect(anchorId: string | null): AnchorRect | null {
  if (!anchorId || typeof document === "undefined") {
    return null;
  }
  const el = document.querySelector<HTMLElement>(`[data-onboarding-anchor="${anchorId}"]`);
  if (!el) {
    return null;
  }
  const rect = el.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

/**
 * Painéis fixos que o tip não deve cobrir (ex.: nota de limites do plano).
 * Marcados na página com `data-onboarding-avoid`.
 */
function readObstacles(): TipBox[] {
  if (typeof document === "undefined") {
    return [];
  }
  return Array.from(document.querySelectorAll<HTMLElement>("[data-onboarding-avoid]"))
    .map((el) => el.getBoundingClientRect())
    .filter((rect) => rect.width > 0 && rect.height > 0)
    .map((rect) => ({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    }));
}

function placeTip(
  rect: AnchorRect | null,
  placement: OnboardingTipPlacement,
  tipHeight: number,
): { top: number; left: number } {
  if (typeof window === "undefined") {
    return { top: 96, left: 280 };
  }
  return placeOnboardingTip({
    rect,
    placement,
    tipWidth: TIP_WIDTH,
    tipHeight,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    obstacles: readObstacles(),
  });
}

export function OnboardingCoachmark() {
  const router = useRouter();
  const {
    mounted,
    isActive,
    guideOpen,
    guideStepId,
    steps,
    phaseStepCount,
    temasPhaseReady,
    selectedThemeCount,
    hasVoiceAudio,
    radarSaved,
    closeGuide,
    dismiss,
    startGuide,
    markStepDone,
  } = useOnboarding();

  const [rect, setRect] = useState<AnchorRect | null>(null);
  const [gateHint, setGateHint] = useState<"temas" | "audio" | "salvar" | null>(null);
  const [tipHeight, setTipHeight] = useState(TIP_HEIGHT_EST);
  const tipRef = useRef<HTMLDivElement | null>(null);

  const stepId = guideStepId;
  const stepMeta = useMemo(() => getStepDef(stepId), [stepId]);
  const copy = stepId ? ONBOARDING_GUIDE_COPY[stepId] : null;
  const phaseLabel = stepMeta
    ? ONBOARDING_PHASES.find((phase) => phase.id === stepMeta.phase)?.label
    : null;
  const stepNumber = stepMeta?.phaseOrder ?? 0;
  const anchorId = stepMeta?.anchor ?? null;
  const placement = stepMeta?.placement ?? "auto";
  const isLastTemasStep = stepMeta?.phase === "temas" && stepNumber >= phaseStepCount;
  const isAudioStep = stepId === "avatar-audio";
  const isSaveStep = stepId === "temas-salvar";
  const isFinalStep = !steps.some((step) => step.id !== stepId && !step.done);

  const measureTip = useCallback(() => {
    const height = tipRef.current?.offsetHeight;
    if (height && Math.abs(height - tipHeight) > 1) {
      setTipHeight(height);
    }
  }, [tipHeight]);

  useLayoutEffect(() => {
    if (!mounted || !isActive || !guideOpen || !anchorId) {
      setRect(null);
      return;
    }
    const el = document.querySelector<HTMLElement>(`[data-onboarding-anchor="${anchorId}"]`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    setRect(readAnchorRect(anchorId));
  }, [mounted, isActive, guideOpen, anchorId, stepId]);

  useEffect(() => {
    if (!guideOpen || !anchorId) {
      return;
    }
    const update = () => {
      setRect(readAnchorRect(anchorId));
      measureTip();
    };
    update();
    const t1 = window.setTimeout(update, 120);
    const t2 = window.setTimeout(update, 450);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const timer = window.setInterval(update, 500);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.clearInterval(timer);
    };
  }, [guideOpen, anchorId, measureTip]);

  useEffect(() => {
    if (temasPhaseReady && gateHint === "temas") {
      setGateHint(null);
    }
    if (hasVoiceAudio && gateHint === "audio") {
      setGateHint(null);
    }
    if (radarSaved && gateHint === "salvar") {
      setGateHint(null);
    }
  }, [temasPhaseReady, hasVoiceAudio, radarSaved, gateHint]);

  if (!mounted || !isActive || !guideOpen || !stepId || !copy || !stepMeta) {
    return null;
  }

  function navigateToStepRoute(route: string) {
    const hashIndex = route.indexOf("#");
    const path = hashIndex === -1 ? route : route.slice(0, hashIndex);
    const hash = hashIndex === -1 ? "" : route.slice(hashIndex);

    if (typeof window !== "undefined") {
      const currentPath = window.location.pathname;
      const sameCriativo =
        path.startsWith("/criativo/novo") && currentPath.startsWith("/criativo/novo");
      if (currentPath === path || sameCriativo) {
        window.history.replaceState(
          null,
          "",
          `${currentPath}${window.location.search}${hash}`,
        );
        // Link âncora de verdade: leva a tela até a seção do próximo passo.
        if (hash) {
          document
            .getElementById(hash.slice(1))
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        return;
      }
    }

    router.push(route as Route);
  }

  function goNext() {
    if (isLastTemasStep && !temasPhaseReady) {
      setGateHint("temas");
      return;
    }
    if (isSaveStep && !radarSaved) {
      setGateHint("salvar");
      return;
    }
    if (isAudioStep && !hasVoiceAudio) {
      setGateHint("audio");
      return;
    }

    markStepDone(stepId!);

    const remaining = steps.filter((step) => step.id !== stepId && !step.done);
    const nextInPhase = remaining.find((step) => step.phase === stepMeta!.phase);
    const next = nextInPhase ?? remaining[0] ?? null;

    if (!next) {
      closeGuide();
      return;
    }
    startGuide(next.id as OnboardingStepId);
    navigateToStepRoute(next.route);
  }

  const tipPos = placeTip(rect, placement, tipHeight);
  const nextBlocked = isSaveStep && !radarSaved;
  const highlightNext = isSaveStep && radarSaved;

  return (
    <>
      {/* Só um anel — sem overlay escuro que bloqueia o conteúdo */}
      {rect ? (
        <div
          className="pointer-events-none fixed z-[45] rounded-xl ring-2 ring-cyan-400/70 shadow-[0_0_0_4px_rgba(34,211,238,0.12)] transition-all"
          style={{
            top: rect.top - 4,
            left: rect.left - 4,
            width: rect.width + 8,
            height: rect.height + 8,
          }}
          aria-hidden="true"
        />
      ) : null}

      <div
        ref={tipRef}
        className="fixed z-[50] w-[min(320px,calc(100vw-2rem))] rounded-2xl border border-md-onboarding-border bg-md-onboarding-surface p-4 text-md-text shadow-[0_24px_60px_rgba(15,23,42,0.14)]"
        style={{ top: tipPos.top, left: tipPos.left }}
        role="dialog"
        aria-modal="false"
        aria-labelledby="onboarding-coach-title"
      >
        {phaseLabel ? (
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-md-text-soft">
            {phaseLabel}
          </p>
        ) : null}
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--curador-text)]">
          Passo {stepNumber} de {phaseStepCount}
        </p>
        <div className="mt-2 mb-3 flex gap-1.5" aria-hidden="true">
          {ONBOARDING_STEPS.filter((step) => step.phase === stepMeta.phase).map((step) => (
            <span
              key={step.id}
              className={[
                "h-1.5 rounded-full transition-all",
                step.phaseOrder <= stepNumber ? "w-4 bg-cyan-400" : "w-1.5 bg-slate-600",
              ].join(" ")}
            />
          ))}
        </div>
        <h3 id="onboarding-coach-title" className="text-[15px] font-bold leading-snug text-md-text">
          {copy.title}
        </h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-md-text-soft">{copy.body}</p>

        {gateHint === "temas" && isLastTemasStep && !temasPhaseReady ? (
          <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-[12px] leading-snug text-[var(--distribuidor-text)]" role="alert">
            Selecione pelo menos 5 temas ou 1 rede social para continuar.{" "}
            <span className="tabular-nums text-md-text-muted">
              ({selectedThemeCount}/5 temas)
            </span>
          </p>
        ) : null}

        {gateHint === "salvar" && nextBlocked ? (
          <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-[12px] leading-snug text-[var(--distribuidor-text)]" role="alert">
            Clique em Salvar radar para gravar a configuração antes de continuar.
          </p>
        ) : null}

        {gateHint === "audio" && isAudioStep && !hasVoiceAudio ? (
          <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-[12px] leading-snug text-[var(--distribuidor-text)]" role="alert">
            Envie o áudio de voz antes de continuar. Sem áudio não dá para produzir o vídeo.
          </p>
        ) : null}

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={dismiss}
            className="text-[13px] font-medium text-md-text-soft transition hover:text-md-text-muted"
          >
            Pular
          </button>
          <span className="relative inline-flex">
            {highlightNext ? (
              <span
                aria-hidden="true"
                className="absolute inset-0 rounded-lg bg-cyan-400 opacity-75 animate-ping motion-reduce:hidden"
              />
            ) : null}
            <button
              type="button"
              onClick={goNext}
              aria-disabled={nextBlocked}
              title={nextBlocked ? "Clique em Salvar radar antes de continuar." : undefined}
              className={`relative rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-[13px] font-bold text-md-text shadow-[0_0_18px_rgba(6,182,212,0.25)] transition ${
                nextBlocked
                  ? "cursor-not-allowed opacity-50"
                  : "hover:from-cyan-400 hover:to-blue-500"
              } ${highlightNext ? "ring-2 ring-cyan-300" : ""}`}
            >
              {isFinalStep ? "Concluir" : "Próximo →"}
            </button>
          </span>
        </div>
      </div>
    </>
  );
}
