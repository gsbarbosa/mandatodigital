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
      className="rounded-2xl border border-[var(--sentinela-border)] bg-gradient-to-b from-[var(--sentinela-soft)] to-md-surface px-5 py-6 shadow-sm"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Atualizando monitoramento de pautas"
    >
      <div className="flex items-start gap-4 mb-5">
        <span
          className="mt-0.5 h-10 w-10 shrink-0 animate-spin rounded-full border-2 border-md-border border-t-[var(--sentinela)] motion-reduce:animate-none"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-md-text tracking-tight">
            Estamos varrendo fontes e montando suas pautas. Isso pode levar cerca de 2 minutos
          </p>
        </div>
      </div>

      <div
        className="mb-5 h-1.5 overflow-hidden rounded-full bg-md-surface-inset border border-md-border/50"
        aria-hidden="true"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--sentinela)] to-[var(--curador)] transition-[width] duration-700 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <ol className="space-y-0">
        {SENTINEL_REFRESH_STEPS.map((label, index) => {
          const done = index < stepIndex;
          const current = index === stepIndex;
          return (
            <li
              key={label}
              className={`flex items-start gap-3 rounded-xl px-3 py-1 transition-colors duration-300 ${
                current
                  ? "bg-[var(--sentinela-soft)] border border-[var(--sentinela-border)]"
                  : done
                    ? "border border-transparent"
                    : "border border-transparent opacity-45"
              }`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  done
                    ? "bg-[var(--sentinela-soft)] text-[var(--sentinela-text)] border border-[var(--sentinela-border)]"
                    : current
                      ? "bg-[var(--sentinela-soft)] text-[var(--sentinela-text)] border border-[var(--sentinela-border)] animate-pulse motion-reduce:animate-none"
                      : "bg-md-slate-800 text-md-text-soft border border-md-border"
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
                  current
                    ? "text-md-text font-medium"
                    : done
                      ? "text-md-text-muted"
                      : "text-md-text-soft"
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
