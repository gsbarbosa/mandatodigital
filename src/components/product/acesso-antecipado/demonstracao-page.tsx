"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { APP_HOME_PATH } from "@/lib/app-home";
import {
  DEMO_ACCESS_BODY,
  DEMO_ACCESS_CTA,
  DEMO_ACCESS_TITLE,
  isDemoMode,
  markDemoDegustacaoSeen,
} from "@/lib/demo-mode";
import { useEarlyAccess, type EarlyAccessReservation } from "@/lib/early-access";
import { PLAN_SELECTION_PATH } from "@/lib/registration-gate";

/**
 * Informativo pós-cadastro em DEMO_MODE.
 * CTA principal libera o produto (plano essencial sob o capô) sem forçar a tela de planos.
 */
export function AcessoDemonstracaoPage() {
  const router = useRouter();
  const [, updateEarlyAccess] = useEarlyAccess();
  const [isStarting, setIsStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const demoActive = isDemoMode();

  useEffect(() => {
    if (!demoActive) {
      router.replace(PLAN_SELECTION_PATH as Route);
    }
  }, [demoActive, router]);

  if (!demoActive) {
    return null;
  }

  async function handleStartDemo() {
    setIsStarting(true);
    setErrorMessage(null);
    try {
      // Conclui o cadastro com o patamar essencial — a degustação (DEMO_MODE) limita o uso.
      const response = await fetch("/api/user/registration", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: "essencial" }),
      });
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
        reservation?: EarlyAccessReservation | null;
      } | null;

      if (!response.ok) {
        throw new Error(payload?.message || "Não foi possível liberar o acesso de demonstração.");
      }

      if (payload?.reservation) {
        updateEarlyAccess({ reservation: payload.reservation });
      }

      markDemoDegustacaoSeen();
      router.replace(APP_HOME_PATH);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível liberar o acesso de demonstração.",
      );
      setIsStarting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-1 py-8">
      <div
        className="rounded-2xl border border-[var(--curador-border)] bg-md-surface p-6 shadow-sm sm:p-8"
        data-testid="demo-access-page"
      >
        <div className="mb-6 flex justify-center">
          <BrandLogo width={180} priority />
        </div>

        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--curador-border)] bg-[var(--curador-soft)] px-3 py-1 text-xs font-semibold text-[var(--curador-text)]">
          Lançamento · Degustação
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-md-text">{DEMO_ACCESS_TITLE}</h1>
        <p className="mt-3 text-sm leading-relaxed text-md-text-muted">{DEMO_ACCESS_BODY}</p>

        {errorMessage ? (
          <p
            className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300"
            role="alert"
          >
            {errorMessage}
          </p>
        ) : null}

        <div className="mt-8">
          <button
            type="button"
            data-testid="demo-access-cta"
            disabled={isStarting}
            onClick={() => void handleStartDemo()}
            className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isStarting ? "Liberando acesso…" : DEMO_ACCESS_CTA}
          </button>
        </div>
      </div>
    </div>
  );
}
