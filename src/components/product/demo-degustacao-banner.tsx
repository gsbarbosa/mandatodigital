"use client";

import { useEffect, useState } from "react";

import {
  DEMO_DEGUSTACAO_BODY,
  DEMO_DEGUSTACAO_TITLE,
  hasSeenDemoDegustacao,
  isDemoModeActiveForEmail,
  markDemoDegustacaoSeen,
} from "@/lib/demo-mode";
import { useProductApp } from "./provider";

/** Modal de boas-vindas da degustação — só aparece 1x por navegador, em DEMO efetivo. */
export function DemoDegustacaoBanner() {
  const { sessionUser } = useProductApp();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isDemoModeActiveForEmail(sessionUser?.email) && !hasSeenDemoDegustacao()) {
      setOpen(true);
    }
  }, [sessionUser?.email]);

  if (!open) {
    return null;
  }

  function handleDismiss() {
    markDemoDegustacaoSeen();
    setOpen(false);
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 bg-md-bg/80 backdrop-blur-sm"
        onClick={handleDismiss}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="demo-degustacao-title"
        data-testid="demo-degustacao-banner"
        className="relative w-full max-w-md rounded-2xl border border-[var(--curador-border)] bg-md-surface p-6 shadow-2xl"
      >
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--curador-border)] bg-[var(--curador-soft)] px-3 py-1 text-xs font-semibold text-[var(--curador-text)]">
          Modo Degustação
        </div>
        <h2 id="demo-degustacao-title" className="text-lg font-bold text-md-text">
          {DEMO_DEGUSTACAO_TITLE}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-md-text-muted">{DEMO_DEGUSTACAO_BODY}</p>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            data-testid="demo-degustacao-dismiss"
            onClick={handleDismiss}
            className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-md-text"
          >
            Vamos explorar
          </button>
        </div>
      </div>
    </div>
  );
}
