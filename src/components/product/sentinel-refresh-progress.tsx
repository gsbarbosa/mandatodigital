"use client";

import { useEffect, useState } from "react";

import {
  SENTINEL_REFRESH_STEP_MS,
  SENTINEL_REFRESH_STEPS,
} from "@/lib/sentinel-refresh-steps";

type SentinelRefreshProgressProps = {
  active: boolean;
};

export function SentinelRefreshProgress({ active }: SentinelRefreshProgressProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const lastIndex = SENTINEL_REFRESH_STEPS.length - 1;

  useEffect(() => {
    if (!active) {
      setStepIndex(0);
      return;
    }

    setStepIndex(0);
    const id = window.setInterval(() => {
      setStepIndex((current) => (current >= lastIndex ? current : current + 1));
    }, SENTINEL_REFRESH_STEP_MS);

    return () => window.clearInterval(id);
  }, [active, lastIndex]);

  if (!active) {
    return null;
  }

  const progressPct = ((stepIndex + 1) / SENTINEL_REFRESH_STEPS.length) * 100;

  return (
    <div
      className="rounded-2xl border border-cyan-500/25 bg-gradient-to-b from-cyan-950/40 to-slate-950/60 px-5 py-6 shadow-[0_0_40px_rgba(6,182,212,0.08)]"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Atualizando monitoramento de pautas"
    >
      <div className="flex items-start gap-4 mb-5">
        <span
          className="mt-0.5 h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-400 motion-reduce:animate-none"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white tracking-tight">
            Sentinela em ação
          </p>
          <p className="mt-1 text-xs text-slate-400 leading-relaxed">
            Estamos varrendo fontes e montando suas pautas. Isso pode levar até cerca de 2
            minutos na primeira busca.
          </p>
        </div>
      </div>

      <div
        className="mb-5 h-1.5 overflow-hidden rounded-full bg-slate-800/80 border border-slate-700/50"
        aria-hidden="true"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-[width] duration-700 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <ol className="space-y-2.5">
        {SENTINEL_REFRESH_STEPS.map((label, index) => {
          const done = index < stepIndex;
          const current = index === stepIndex;
          return (
            <li
              key={label}
              className={`flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors duration-300 ${
                current
                  ? "bg-cyan-500/10 border border-cyan-500/25"
                  : done
                    ? "border border-transparent"
                    : "border border-transparent opacity-45"
              }`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  done
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : current
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse motion-reduce:animate-none"
                      : "bg-slate-800 text-slate-500 border border-slate-700"
                }`}
                aria-hidden="true"
              >
                {done ? (
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  index + 1
                )}
              </span>
              <span
                className={`text-sm leading-snug ${
                  current ? "text-cyan-100 font-medium" : done ? "text-slate-300" : "text-slate-500"
                }`}
              >
                {label}
                {current ? <span className="sr-only"> (em andamento)</span> : null}
                {done ? <span className="sr-only"> (concluído)</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
