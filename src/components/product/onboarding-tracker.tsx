"use client";

import { Fragment } from "react";

import { useOnboarding } from "./onboarding-provider";
import type { OnboardingStepId } from "@/lib/onboarding";

const HINTS: Record<OnboardingStepId, string> = {
  temas: "Etapa 1 de 4 — selecione seus temas de interesse para montar o radar.",
  avatar: "Etapa 2 de 4 — envie foto e voz para treinar seu avatar.",
  noticias: "Etapa 3 de 4 — veja as notícias dos seus temas e paute uma.",
  gerar: "Etapa 4 de 4 — gere seu primeiro vídeo a partir da pauta.",
};

function CheckIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
    </svg>
  );
}

export function OnboardingTracker() {
  const { mounted, isActive, steps, currentStepId, dismiss } = useOnboarding();

  if (!mounted || !isActive) {
    return null;
  }

  const hint = currentStepId ? HINTS[currentStepId] : null;

  return (
    <div className="sticky top-0 z-30 border-b border-slate-800 bg-[#0d1220]/95 backdrop-blur-sm shadow-[0_8px_20px_-12px_rgba(0,0,0,0.6)]">
      <div className="mx-auto max-w-5xl px-6 pt-3.5 pb-2.5">
        <ol className="flex min-w-0 items-start overflow-x-auto">
          {steps.map((step, index) => (
            <Fragment key={step.id}>
              <li className="flex min-w-[84px] flex-1 flex-col items-center gap-1.5 text-center">
                <span
                  className={[
                    "flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold tabular-nums transition-colors",
                    step.done
                      ? "border-emerald-500 bg-emerald-500 text-[#06251b]"
                      : step.current
                        ? "border-cyan-400 text-cyan-300 shadow-[0_0_0_4px_rgba(34,211,238,0.12)]"
                        : "border-slate-600 bg-[#0d1220] text-slate-500",
                  ].join(" ")}
                >
                  {step.done ? <CheckIcon /> : step.order}
                </span>
                <span
                  className={[
                    "max-w-[96px] text-[10.5px] font-semibold leading-tight",
                    step.done ? "text-emerald-300" : step.current ? "text-cyan-200" : "text-slate-500",
                  ].join(" ")}
                >
                  {step.label}
                </span>
              </li>
              {index < steps.length - 1 ? (
                <span
                  className={[
                    "mt-3.5 h-0.5 w-8 shrink-0",
                    step.done ? "bg-emerald-500" : "bg-slate-700",
                  ].join(" ")}
                  aria-hidden="true"
                />
              ) : null}
            </Fragment>
          ))}
        </ol>

        <div className="mt-2 flex items-center gap-3">
          {hint ? (
            <p className="flex min-w-0 flex-1 items-center gap-2 text-xs text-cyan-100/90">
              <SparkIcon />
              <span className="truncate">{hint}</span>
            </p>
          ) : (
            <span className="flex-1" />
          )}
          <button
            type="button"
            onClick={dismiss}
            className="shrink-0 text-[11px] font-medium text-slate-400 underline decoration-slate-600 underline-offset-2 transition-colors hover:text-slate-200"
          >
            Pular apresentação
          </button>
        </div>
      </div>
    </div>
  );
}
