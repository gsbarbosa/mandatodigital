"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";

import { useOnboarding } from "./onboarding-provider";
import {
  getStepDef,
  ONBOARDING_GUIDE_COPY,
  ONBOARDING_PHASES,
  ONBOARDING_STEPS,
  type OnboardingStepId,
} from "@/lib/onboarding";

type AnchorRect = { top: number; left: number; width: number; height: number };

const TIP_WIDTH = 320;
const TIP_HEIGHT_EST = 220;
const GAP = 12;

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
 * Posiciona o tip fora do retângulo do alvo (abaixo → acima → direita → esquerda),
 * com fallback no canto inferior esquerdo da área de conteúdo.
 */
function placeTipAwayFromTarget(rect: AnchorRect | null): {
  top: number;
  left: number;
} {
  if (typeof window === "undefined") {
    return { top: 96, left: 280 };
  }

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const contentLeft = 16 * 16; // ~sidebar w-64
  const safeLeft = Math.max(16, contentLeft + 16);
  const safeRight = vw - 16;
  const safeBottom = vh - 16;
  // Reserva o checklist (canto inferior direito)
  const checklistReserve = 380;

  const dockFallback = {
    top: Math.max(16, vh - TIP_HEIGHT_EST - 24),
    left: Math.min(safeLeft, safeRight - TIP_WIDTH),
  };

  if (!rect) {
    return dockFallback;
  }

  const candidates: Array<{ top: number; left: number; score: number }> = [];

  // Abaixo do alvo
  candidates.push({
    top: rect.top + rect.height + GAP,
    left: Math.min(Math.max(rect.left, safeLeft), safeRight - TIP_WIDTH),
    score: 4,
  });
  // Acima do alvo
  candidates.push({
    top: rect.top - TIP_HEIGHT_EST - GAP,
    left: Math.min(Math.max(rect.left, safeLeft), safeRight - TIP_WIDTH),
    score: 3,
  });
  // À direita
  candidates.push({
    top: Math.min(Math.max(rect.top, 16), vh - TIP_HEIGHT_EST - 16),
    left: rect.left + rect.width + GAP,
    score: 2,
  });
  // À esquerda
  candidates.push({
    top: Math.min(Math.max(rect.top, 16), vh - TIP_HEIGHT_EST - 16),
    left: rect.left - TIP_WIDTH - GAP,
    score: 1,
  });

  const fits = candidates
    .map((c) => ({
      ...c,
      top: Math.min(Math.max(c.top, 16), safeBottom - TIP_HEIGHT_EST),
      left: Math.min(Math.max(c.left, safeLeft), safeRight - TIP_WIDTH),
    }))
    .filter((c) => {
      const tipRight = c.left + TIP_WIDTH;
      const tipBottom = c.top + TIP_HEIGHT_EST;
      // Cabe na viewport
      if (c.top < 8 || tipBottom > vh - 8 || c.left < 8 || tipRight > vw - 8) {
        return false;
      }
      // Não sobrepõe o centro do alvo
      const overlapX = !(tipRight < rect.left || c.left > rect.left + rect.width);
      const overlapY = !(tipBottom < rect.top || c.top > rect.top + rect.height);
      if (overlapX && overlapY) {
        return false;
      }
      // Evita esmagar o checklist no canto direito
      if (c.left > vw - checklistReserve && c.top > vh - 280) {
        return false;
      }
      return true;
    })
    .sort((a, b) => b.score - a.score);

  return fits[0] ?? dockFallback;
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
    closeGuide,
    dismiss,
    startGuide,
    markStepDone,
  } = useOnboarding();

  const [rect, setRect] = useState<AnchorRect | null>(null);
  const [gateHint, setGateHint] = useState<"temas" | "audio" | null>(null);

  const stepId = guideStepId;
  const stepMeta = useMemo(() => getStepDef(stepId), [stepId]);
  const copy = stepId ? ONBOARDING_GUIDE_COPY[stepId] : null;
  const phaseLabel = stepMeta
    ? ONBOARDING_PHASES.find((phase) => phase.id === stepMeta.phase)?.label
    : null;
  const stepNumber = stepMeta?.phaseOrder ?? 0;
  const anchorId = stepMeta?.anchor ?? null;
  const isLastTemasStep = stepMeta?.phase === "temas" && stepNumber >= phaseStepCount;
  const isAudioStep = stepId === "avatar-audio";
  const isFinalStep = !steps.some((step) => step.id !== stepId && !step.done);

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
    const update = () => setRect(readAnchorRect(anchorId));
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
  }, [guideOpen, anchorId]);

  useEffect(() => {
    if (temasPhaseReady && gateHint === "temas") {
      setGateHint(null);
    }
    if (hasVoiceAudio && gateHint === "audio") {
      setGateHint(null);
    }
  }, [temasPhaseReady, hasVoiceAudio, gateHint]);

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

  const tipPos = placeTipAwayFromTarget(rect);

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
        className="fixed z-[50] w-[min(320px,calc(100vw-2rem))] rounded-2xl border border-slate-700 bg-[#0F1623] p-4 text-slate-200 shadow-[0_24px_60px_rgba(0,0,0,0.55)]"
        style={{ top: tipPos.top, left: tipPos.left }}
        role="dialog"
        aria-modal="false"
        aria-labelledby="onboarding-coach-title"
      >
        {phaseLabel ? (
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {phaseLabel}
          </p>
        ) : null}
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-cyan-400">
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
        <h3 id="onboarding-coach-title" className="text-[15px] font-bold leading-snug text-white">
          {copy.title}
        </h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-slate-400">{copy.body}</p>

        {gateHint === "temas" && isLastTemasStep && !temasPhaseReady ? (
          <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-[12px] leading-snug text-amber-200/90" role="alert">
            Selecione pelo menos 5 temas ou 1 rede social para continuar.{" "}
            <span className="tabular-nums text-amber-100/80">
              ({selectedThemeCount}/5 temas)
            </span>
          </p>
        ) : null}

        {gateHint === "audio" && isAudioStep && !hasVoiceAudio ? (
          <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-[12px] leading-snug text-amber-200/90" role="alert">
            Envie o áudio de voz antes de continuar. Sem áudio não dá para produzir o vídeo.
          </p>
        ) : null}

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={dismiss}
            className="text-[13px] font-medium text-slate-500 transition hover:text-slate-300"
          >
            Pular
          </button>
          <button
            type="button"
            onClick={goNext}
            className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-[13px] font-bold text-white shadow-[0_0_18px_rgba(6,182,212,0.25)] transition hover:from-cyan-400 hover:to-blue-500"
          >
            {isFinalStep ? "Concluir" : "Próximo →"}
          </button>
        </div>
      </div>
    </>
  );
}
