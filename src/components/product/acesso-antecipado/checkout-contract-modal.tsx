"use client";

import type { Route } from "next";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  earlyAccessPlans,
  type EarlyAccessPlanId,
  type EarlyAccessReservation,
} from "@/lib/early-access";

function formatCnpjInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

type CheckoutContractModalProps = {
  planId: EarlyAccessPlanId;
  method: "pix" | "boleto";
  reservation: EarlyAccessReservation | null;
  contractPlanId: EarlyAccessPlanId | null;
  contractCnpj: string | null;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (cnpjDigits: string | null) => void;
};

export function CheckoutContractModal({
  planId,
  method,
  reservation,
  contractPlanId,
  contractCnpj,
  submitting,
  error,
  onClose,
  onConfirm,
}: CheckoutContractModalProps) {
  const plan = earlyAccessPlans.find((item) => item.id === planId);
  const contractAlreadyAccepted = contractPlanId === planId && Boolean(contractCnpj);
  const [cnpjInput, setCnpjInput] = useState(contractCnpj ?? "");
  const [accepted, setAccepted] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setCnpjInput(contractCnpj ?? "");
    setAccepted(false);
    setLocalError(null);
  }, [planId, contractCnpj]);

  function handleSubmit() {
    setLocalError(null);
    if (!contractAlreadyAccepted) {
      const digits = cnpjInput.replace(/\D/g, "");
      if (digits.length !== 14) {
        setLocalError("Informe o CNPJ de campanha com 14 dígitos.");
        return;
      }
      if (!accepted) {
        setLocalError("Marque o aceite do Contrato e do Dossiê para continuar.");
        return;
      }
      if (!reservation?.address?.trim()) {
        setLocalError("Endereço da campanha ausente. Complete em Dados Pessoais.");
        return;
      }
      onConfirm(digits);
      return;
    }
    onConfirm(null);
  }

  const methodLabel = method === "pix" ? "PIX" : "boleto bancário";
  const displayError = localError || error;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-md-app-bg/80 backdrop-blur-[2px] px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-contract-title"
    >
      <div className="flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-md-border bg-md-surface shadow-2xl">
        <div className="border-b border-md-border px-6 py-5">
          <h2 id="checkout-contract-title" className="text-lg font-semibold text-md-text">
            {contractAlreadyAccepted ? "Confirmar cobrança" : "Contrato de adesão"}
          </h2>
          <p className="mt-1 text-sm text-md-text-soft">
            Plano <strong className="text-md-text">{plan?.name ?? planId}</strong> · pagamento via{" "}
            {methodLabel}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {contractAlreadyAccepted ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
              Contrato já aceito para este plano
              {contractCnpj ? (
                <>
                  {" "}
                  (<span className="font-mono">{contractCnpj}</span>)
                </>
              ) : null}
              . Ao confirmar, geramos a cobrança.
            </div>
          ) : (
            <>
              <p className="text-sm leading-relaxed text-md-text-soft">
                Informe o CNPJ de campanha registrado no TSE e aceite o Contrato de Prestação de
                Serviços Eleitorais e o Dossiê de Transparência. O aceite registra IP, timestamp,
                User-Agent e hash do documento — o PDF é enviado ao seu e-mail.
              </p>

              <div>
                <label
                  htmlFor="checkout-cnpj"
                  className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-md-text-soft"
                >
                  CNPJ da campanha
                </label>
                <input
                  id="checkout-cnpj"
                  value={cnpjInput}
                  onChange={(event) => setCnpjInput(formatCnpjInput(event.target.value))}
                  placeholder="00.000.000/0000-00"
                  inputMode="numeric"
                  autoComplete="off"
                  className="w-full rounded-xl border border-md-border bg-md-surface-inset p-3.5 text-center font-mono text-md-text outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div className="rounded-xl border border-md-border/60 bg-md-overlay-subtle p-4 text-xs leading-relaxed text-md-text-soft">
                O contrato identifica a campanha ({reservation?.fullName ?? "—"}), o plano{" "}
                {plan?.name ?? planId} e as obrigações de compliance TSE (Res. 23.610/19 e
                23.755/26). A NFS-e será emitida contra o CNPJ informado após a confirmação do
                pagamento.{" "}
                <Link
                  href={"/compliance" as Route}
                  className="font-semibold text-[var(--curador-text)] underline underline-offset-2"
                  target="_blank"
                >
                  Ver dossiê jurídico
                </Link>
              </div>

              <label className="flex cursor-pointer items-start gap-3 text-sm text-md-text">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-md-border-hover"
                  checked={accepted}
                  onChange={(event) => setAccepted(event.target.checked)}
                />
                <span>
                  Li e aceito o Contrato de Prestação de Serviços Eleitorais e o Dossiê de
                  Transparência (Res. TSE 23.610/19 e 23.755/26).
                </span>
              </label>
            </>
          )}

          {displayError ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400" role="alert">
              {displayError}
            </p>
          ) : null}
        </div>

        <div className="flex gap-3 border-t border-md-border px-6 py-4">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="flex-1 rounded-xl border border-md-border px-4 py-2.5 text-sm font-medium text-md-text-soft hover:bg-md-overlay-hover disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            className="flex-1 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-md-text disabled:opacity-60"
          >
            {submitting
              ? "Processando…"
              : contractAlreadyAccepted
                ? `Gerar cobrança (${methodLabel})`
                : `Aceitar contrato e pagar (${methodLabel})`}
          </button>
        </div>
      </div>
    </div>
  );
}
