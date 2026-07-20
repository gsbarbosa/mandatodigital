"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useOnboarding } from "./onboarding-provider";
import { ONBOARDING_PHASES } from "@/lib/onboarding";

/** Grid compartilhado: checkbox | rótulo | progresso | ação */
const PANEL_ROW =
  "grid grid-cols-[16px_minmax(0,1fr)_28px_48px] items-center gap-x-2.5 px-3";

function CheckIcon() {
  return (  
    <svg
      className="h-2.5 w-2.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      className="h-3 w-3"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

/** Flutuante só com as fases (ex.: Selecionar Temas 0/4). Subpassos ficam no tip. */
export function OnboardingChecklist() {
  const router = useRouter();
  const {
    mounted,
    isActive,
    steps,
    currentPhaseId,
    temasPhaseReady,
    hasVoiceAudio,
    startGuide,
    showBridge,
    showWelcome,
    dismiss,
  } = useOnboarding();
  const [minimized, setMinimized] = useState(true);

  if (!mounted || !isActive || showWelcome) {
    return null;
  }

  const phasesDone = ONBOARDING_PHASES.filter((phase) => {
    const phaseSteps = steps.filter((step) => step.phase === phase.id);
    const allDone = phaseSteps.length > 0 && phaseSteps.every((step) => step.done);
    if (!allDone) {
      return false;
    }
    if (phase.id === "temas") {
      return temasPhaseReady;
    }
    if (phase.id === "avatar") {
      return hasVoiceAudio;
    }
    return true;
  }).length;
  const phasesTotal = ONBOARDING_PHASES.length;

  if (minimized) {
    return (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        className="fixed bottom-5 right-5 z-40 rounded-xl border border-cyan-500/35 bg-gradient-to-r from-cyan-500 to-blue-600 px-3.5 py-2 text-[13px] font-semibold text-white shadow-[0_8px_28px_rgba(6,182,212,0.35)] transition hover:from-cyan-400 hover:to-blue-500"
        aria-label={`Reabrir onboarding ${phasesDone} de ${phasesTotal}`}
      >
        Onboarding {phasesDone}/{phasesTotal}
      </button>
    );
  }

  function handleStartPhase(phaseId: (typeof ONBOARDING_PHASES)[number]["id"]) {
    // Sem áudio real, não abre fases posteriores (evita preso em Nova pauta).
    if (
      !hasVoiceAudio &&
      (phaseId === "pautas" || phaseId === "roteiro" || phaseId === "video")
    ) {
      startGuide("avatar-audio");
      router.push("/avatares/foto-real/treinar#audio" as Route);
      return;
    }
    if (phaseId === "pautas") {
      showBridge("afterAvatar");
      return;
    }
    if (phaseId === "roteiro") {
      showBridge("afterPautas");
      return;
    }
    if (phaseId === "video") {
      showBridge("afterRoteiro");
      return;
    }
    const phaseSteps = steps.filter((step) => step.phase === phaseId);
    const next = phaseSteps.find((step) => !step.done) ?? phaseSteps[0];
    if (!next) {
      return;
    }
    startGuide(next.id);
    router.push(next.route as Route);
  }

  return (
    <div
      className="fixed bottom-5 right-5 z-40 w-[min(300px,calc(100vw-2.5rem))] overflow-hidden rounded-xl border border-slate-700 bg-[#0F1623] text-slate-200 shadow-[0_16px_40px_rgba(0,0,0,0.5)]"
      role="complementary"
      aria-label="Checklist de onboarding"
    >
      <div
        className={`${PANEL_ROW} border-b border-slate-800 bg-slate-900/80 py-2`}
      >
        <p className="col-span-2 text-[13px] font-bold leading-none text-white">
          Onboarding {phasesDone}/{phasesTotal}
        </p>
        <span aria-hidden="true" />
        <button
          type="button"
          onClick={() => setMinimized(true)}
          className="flex h-6 w-6 items-center justify-center justify-self-end rounded-md border border-slate-700 bg-slate-800/60 text-slate-400 transition hover:border-slate-600 hover:text-white"
          aria-label="Minimizar onboarding"
        >
          <CloseIcon />
        </button>
      </div>

      <ul className="m-0 list-none divide-y divide-slate-800/70 p-0">
        {ONBOARDING_PHASES.map((phase) => {
          const phaseSteps = steps.filter((step) => step.phase === phase.id);
          const phaseDone = phaseSteps.filter((step) => step.done).length;
          const phaseTotal = phaseSteps.length;
          const complete =
            phaseDone >= phaseTotal &&
            phaseTotal > 0 &&
            (phase.id !== "temas" || temasPhaseReady) &&
            (phase.id !== "avatar" || hasVoiceAudio);
          const isCurrent = currentPhaseId === phase.id && !complete;

          return (
            <li
              key={phase.id}
              className={[
                PANEL_ROW,
                "py-2 transition-colors",
                isCurrent ? "bg-cyan-500/5" : "bg-transparent",
              ].join(" ")}
            >
              <span
                className={[
                  "flex h-4 w-4 items-center justify-center rounded-[3px] border",
                  complete
                    ? "border-emerald-500 bg-emerald-500 text-[#06251b]"
                    : isCurrent
                      ? "border-cyan-400 bg-cyan-400/10"
                      : "border-slate-600 bg-[#0B0F19]",
                ].join(" ")}
                aria-hidden="true"
              >
                {complete ? <CheckIcon /> : null}
              </span>

              <span
                className={[
                  "truncate text-[12.5px] font-semibold leading-none",
                  complete
                    ? "text-slate-500"
                    : isCurrent
                      ? "text-cyan-100"
                      : "text-slate-300",
                ].join(" ")}
              >
                {phase.order}. {phase.label}
              </span>

              <span className="text-right text-[11px] tabular-nums leading-none text-slate-500">
                {phaseDone}/{phaseTotal}
              </span>

              {complete ? (
                <span className="text-right text-[10px] font-semibold uppercase tracking-wide text-emerald-400/90">
                  Feito
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleStartPhase(phase.id)}
                  className="text-right text-[12px] font-bold leading-none text-cyan-400 transition hover:text-cyan-300"
                >
                  Iniciar
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <div
        className={`${PANEL_ROW} border-t border-slate-800 bg-[#0B0F19]/60 py-1.5`}
      >
        <button
          type="button"
          onClick={dismiss}
          className="col-span-2 text-left text-[11px] font-medium text-slate-500 underline decoration-slate-700 underline-offset-2 transition hover:text-slate-300"
        >
          Pular onboarding
        </button>
      </div>
    </div>
  );
}
