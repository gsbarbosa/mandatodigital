"use client";

import { useState } from "react";

import {
  EXPORT_COMPLIANCE_MESSAGE,
} from "@/lib/creative-ai-metadata";

type ExportComplianceModalProps = {
  open: boolean;
  mediaId: string;
  mediaUrl: string;
  projectId?: string;
  onClose: () => void;
  onConfirmed: (mediaUrl: string) => void;
};

export function ExportComplianceModal({
  open,
  mediaId,
  mediaUrl,
  projectId,
  onClose,
  onConfirmed,
}: ExportComplianceModalProps) {
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return null;
  }

  async function handleConfirm() {
    if (!accepted) {
      setError("Marque o checkbox para continuar.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/compliance/export-accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaId,
          mediaUrl,
          projectId,
          liabilityAccepted: true,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message || "Nao foi possivel registrar o aceite.");
      }
      onConfirmed(mediaUrl);
      setAccepted(false);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao confirmar.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-compliance-title"
        className="relative w-full max-w-lg rounded-2xl border border-slate-700 bg-[#0F1623] p-6 shadow-2xl"
      >
        <h2 id="export-compliance-title" className="text-lg font-bold text-white">
          Aviso de Conformidade - Justiça Eleitoral
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">
          {EXPORT_COMPLIANCE_MESSAGE}
        </p>

        <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm text-slate-200">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-slate-600"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
          />
          <span>Estou ciente e assumo a responsabilidade pela publicação manual.</span>
        </label>

        {error ? (
          <p className="mt-3 text-sm text-red-400" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!accepted || submitting}
            onClick={() => void handleConfirm()}
            className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Registrando…" : "Confirmar e Baixar"}
          </button>
        </div>
      </div>
    </div>
  );
}
