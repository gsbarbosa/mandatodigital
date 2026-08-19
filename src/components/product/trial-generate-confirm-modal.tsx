"use client";

import {
  TRIAL_GENERATE_AVATAR_BODY,
  TRIAL_GENERATE_AVATAR_CANCEL,
  TRIAL_GENERATE_AVATAR_CTA,
  TRIAL_GENERATE_AVATAR_TITLE,
} from "@/lib/trial-fixed-script";

type TrialGenerateConfirmModalProps = {
  open: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Confirmação de geração de vídeo no trial — o avatar lê o roteiro padrão. */
export function TrialGenerateConfirmModal({
  open,
  busy = false,
  onConfirm,
  onCancel,
}: TrialGenerateConfirmModalProps) {
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
        aria-labelledby="trial-generate-title"
        data-testid="trial-generate-confirm-modal"
        className="relative w-full max-w-md rounded-2xl border border-[var(--curador-border)] bg-md-surface p-6 shadow-2xl"
      >
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--curador-border)] bg-[var(--curador-soft)] px-3 py-1 text-xs font-semibold text-[var(--curador-text)]">
          Trial
        </div>
        <h2 id="trial-generate-title" className="text-lg font-bold text-md-text">
          {TRIAL_GENERATE_AVATAR_TITLE}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-md-text-muted">
          {TRIAL_GENERATE_AVATAR_BODY}
        </p>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            data-testid="trial-generate-cancel"
            disabled={busy}
            onClick={onCancel}
            className="rounded-lg border border-md-border px-4 py-2.5 text-sm font-medium text-md-text transition hover:bg-md-overlay-hover disabled:opacity-60"
          >
            {TRIAL_GENERATE_AVATAR_CANCEL}
          </button>
          <button
            type="button"
            data-testid="trial-generate-confirm"
            disabled={busy}
            onClick={onConfirm}
            className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-60"
          >
            {busy ? "Iniciando…" : TRIAL_GENERATE_AVATAR_CTA}
          </button>
        </div>
      </div>
    </div>
  );
}
