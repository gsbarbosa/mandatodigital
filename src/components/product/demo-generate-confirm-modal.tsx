"use client";

import {
  DEMO_GENERATE_AVATAR_BODY,
  DEMO_GENERATE_AVATAR_CANCEL,
  DEMO_GENERATE_AVATAR_CTA,
  DEMO_GENERATE_AVATAR_TITLE,
} from "@/lib/demo-mode";

type DemoGenerateConfirmModalProps = {
  open: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Confirmação de geração de vídeo no modo degustação — substitui window.confirm. */
export function DemoGenerateConfirmModal({
  open,
  busy = false,
  onConfirm,
  onCancel,
}: DemoGenerateConfirmModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 bg-md-bg/80 backdrop-blur-sm"
        disabled={busy}
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="demo-generate-title"
        data-testid="demo-generate-confirm-modal"
        className="relative w-full max-w-md rounded-2xl border border-[var(--curador-border)] bg-md-surface p-6 shadow-2xl"
      >
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--curador-border)] bg-[var(--curador-soft)] px-3 py-1 text-xs font-semibold text-[var(--curador-text)]">
          Modo Degustação
        </div>
        <h2 id="demo-generate-title" className="text-lg font-bold text-md-text">
          {DEMO_GENERATE_AVATAR_TITLE}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-md-text-muted">
          {DEMO_GENERATE_AVATAR_BODY}
        </p>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            data-testid="demo-generate-cancel"
            disabled={busy}
            onClick={onCancel}
            className="rounded-lg border border-md-border px-4 py-2.5 text-sm font-medium text-md-text transition hover:bg-md-overlay-hover disabled:opacity-60"
          >
            {DEMO_GENERATE_AVATAR_CANCEL}
          </button>
          <button
            type="button"
            data-testid="demo-generate-confirm"
            disabled={busy}
            onClick={onConfirm}
            className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-60"
          >
            {busy ? "Iniciando…" : DEMO_GENERATE_AVATAR_CTA}
          </button>
        </div>
      </div>
    </div>
  );
}
