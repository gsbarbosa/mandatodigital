"use client";

import type { Route } from "next";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

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

export type CheckoutContractConfirmPayload = {
  cnpjDigits: string | null;
  financialResponsible?: string;
  campaignName?: string;
  campaignAddress?: string;
};

type CnpjLookupPayload = {
  ok?: boolean;
  cnpj?: string;
  eligible?: boolean;
  naturezaJuridica?: string | null;
  razaoSocial?: string | null;
  address?: string | null;
  message?: string | null;
};

type PreviewPayload = {
  contractTitle?: string;
  contractText?: string;
  dossierTitle?: string;
  dossierText?: string;
  message?: string;
};

type CheckoutContractModalProps = {
  planId: EarlyAccessPlanId;
  method: "pix" | "boleto";
  reservation: EarlyAccessReservation | null;
  contractPlanId: EarlyAccessPlanId | null;
  contractCnpj: string | null;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (payload: CheckoutContractConfirmPayload) => void;
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
  const [campaignNameInput, setCampaignNameInput] = useState(reservation?.fullName ?? "");
  const [campaignAddressInput, setCampaignAddressInput] = useState(
    reservation?.address ?? "",
  );
  const [financialResponsible, setFinancialResponsible] = useState(
    reservation?.fullName ?? "",
  );
  const [lockedName, setLockedName] = useState<string | null>(null);
  const [lockedAddress, setLockedAddress] = useState<string | null>(null);
  const [lookupEligible, setLookupEligible] = useState(false);
  const [lookupPending, setLookupPending] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTab, setPreviewTab] = useState<"contract" | "dossier">("contract");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewPayload | null>(null);

  const lookupSeq = useRef(0);

  useEffect(() => {
    setCnpjInput(contractCnpj ?? "");
    setCampaignNameInput(reservation?.fullName ?? "");
    setCampaignAddressInput(reservation?.address ?? "");
    setFinancialResponsible(reservation?.fullName ?? "");
    setLockedName(null);
    setLockedAddress(null);
    setLookupEligible(false);
    setLookupPending(false);
    setLookupError(null);
    setAccepted(false);
    setLocalError(null);
    setPreviewOpen(false);
    setPreview(null);
    setPreviewTab("contract");
  }, [planId, contractCnpj, reservation?.fullName, reservation?.address]);

  useEffect(() => {
    if (contractAlreadyAccepted) {
      return;
    }
    const digits = cnpjInput.replace(/\D/g, "");
    if (digits.length !== 14) {
      setLockedName(null);
      setLockedAddress(null);
      setLookupEligible(false);
      setLookupPending(false);
      setLookupError(null);
      setPreviewOpen(false);
      setPreview(null);
      return;
    }

    const seq = ++lookupSeq.current;
    setLookupPending(true);
    setLookupError(null);

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch(
            `/api/legal/cnpj-lookup?cnpj=${encodeURIComponent(digits)}`,
            { credentials: "same-origin" },
          );
          const payload = (await response.json().catch(() => null)) as CnpjLookupPayload | null;
          if (seq !== lookupSeq.current) {
            return;
          }
          if (!response.ok) {
            setLockedName(null);
            setLockedAddress(null);
            setLookupEligible(false);
            setLookupError(payload?.message || "Falha ao consultar CNPJ.");
            setPreviewOpen(false);
            setPreview(null);
            return;
          }
          if (!payload?.eligible) {
            setLockedName(null);
            setLockedAddress(null);
            setLookupEligible(false);
            setLookupError(payload?.message || "CNPJ nao elegivel.");
            setPreviewOpen(false);
            setPreview(null);
            return;
          }
          setLookupEligible(true);
          setLookupError(null);
          setLockedName(payload.razaoSocial?.trim() || null);
          setLockedAddress(payload.address?.trim() || null);
          setPreviewOpen(false);
          setPreview(null);
        } catch {
          if (seq !== lookupSeq.current) {
            return;
          }
          setLockedName(null);
          setLockedAddress(null);
          setLookupEligible(false);
          setLookupError("Falha ao consultar CNPJ.");
          setPreviewOpen(false);
          setPreview(null);
        } finally {
          if (seq === lookupSeq.current) {
            setLookupPending(false);
          }
        }
      })();
    }, 400);

    return () => {
      window.clearTimeout(timer);
    };
  }, [cnpjInput, contractAlreadyAccepted]);

  useEffect(() => {
    setPreviewOpen(false);
    setPreview(null);
  }, [campaignNameInput, campaignAddressInput, financialResponsible, lockedName, lockedAddress]);

  async function handlePreview() {
    setLocalError(null);
    const digits = cnpjInput.replace(/\D/g, "");
    if (digits.length !== 14 || !lookupEligible || lookupPending) {
      setLocalError("Consulte um CNPJ elegivel antes de ver o contrato.");
      return;
    }
    const nameFallback = lockedName ? undefined : campaignNameInput.trim();
    const addressFallback = lockedAddress ? undefined : campaignAddressInput.trim();
    if (!lockedName && !nameFallback) {
      setLocalError("Informe o nome da campanha.");
      return;
    }
    if (!lockedAddress && !addressFallback) {
      setLocalError("Informe o endereco da campanha.");
      return;
    }
    if (financialResponsible.trim().length < 2) {
      setLocalError("Informe o responsavel financeiro.");
      return;
    }

    setPreviewLoading(true);
    try {
      const response = await fetch("/api/legal/contract-preview", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          cnpj: digits,
          financialResponsible: financialResponsible.trim(),
          ...(nameFallback ? { campaignName: nameFallback } : {}),
          ...(addressFallback ? { campaignAddress: addressFallback } : {}),
          ...(reservation?.party ? { party: reservation.party } : {}),
        }),
      });
      const payload = (await response.json().catch(() => null)) as PreviewPayload | null;
      if (!response.ok || !payload?.contractText) {
        throw new Error(payload?.message || "Nao foi possivel gerar o preview.");
      }
      setPreview(payload);
      setPreviewOpen(true);
      setPreviewTab("contract");
    } catch (previewError) {
      setLocalError(
        previewError instanceof Error
          ? previewError.message
          : "Nao foi possivel gerar o preview.",
      );
    } finally {
      setPreviewLoading(false);
    }
  }

  function handleSubmit() {
    setLocalError(null);
    if (!contractAlreadyAccepted) {
      const digits = cnpjInput.replace(/\D/g, "");
      if (digits.length !== 14) {
        setLocalError("Informe o CNPJ de campanha com 14 digitos.");
        return;
      }
      if (lookupPending) {
        setLocalError("Aguarde a consulta do CNPJ na Receita Federal.");
        return;
      }
      if (!lookupEligible) {
        setLocalError(lookupError || "CNPJ nao elegivel para adesao.");
        return;
      }
      if (!lockedName && campaignNameInput.trim().length < 2) {
        setLocalError("Informe o nome da campanha.");
        return;
      }
      if (!lockedAddress && campaignAddressInput.trim().length < 5) {
        setLocalError("Informe o endereco da campanha.");
        return;
      }
      if (financialResponsible.trim().length < 2) {
        setLocalError("Informe o responsavel financeiro.");
        return;
      }
      if (!accepted) {
        setLocalError("Marque o aceite do Contrato e do Dossiê para continuar.");
        return;
      }
      onConfirm({
        cnpjDigits: digits,
        financialResponsible: financialResponsible.trim(),
        ...(lockedName ? {} : { campaignName: campaignNameInput.trim() }),
        ...(lockedAddress ? {} : { campaignAddress: campaignAddressInput.trim() }),
      });
      return;
    }
    onConfirm({ cnpjDigits: null });
  }

  const methodLabel = method === "pix" ? "PIX" : "boleto bancário";
  const displayError = localError || error || lookupError;
  const canPreview = lookupEligible && !lookupPending && !submitting;
  const canSubmit =
    !submitting &&
    (contractAlreadyAccepted ||
      (lookupEligible &&
        !lookupPending &&
        financialResponsible.trim().length >= 2 &&
        (Boolean(lockedName) || campaignNameInput.trim().length >= 2) &&
        (Boolean(lockedAddress) || campaignAddressInput.trim().length >= 5) &&
        accepted));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-md-app-bg/80 backdrop-blur-[2px] px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-contract-title"
    >
      <div className="flex max-h-[min(92vh,820px)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-md-border bg-md-surface shadow-2xl">
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
                Informe o CNPJ de campanha. Nome e endereço vêm da Receita Federal quando
                disponíveis (travados). Responsável financeiro é sempre editável. Leia o contrato
                e o dossiê nominais antes de aceitar — o PDF oficial segue após o aceite; a NFS-e,
                após o pagamento.
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
                {lookupPending ? (
                  <p className="mt-2 text-xs text-md-text-soft">Consultando Receita Federal…</p>
                ) : null}
              </div>

              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-md-text-soft">
                  Nome da campanha / candidato
                </label>
                {lockedName ? (
                  <div className="rounded-xl border border-md-border/60 bg-md-overlay-subtle px-3.5 py-3 text-sm text-md-text">
                    {lockedName}
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--sentinela-text)]">
                      Confirmado via Receita Federal
                    </p>
                  </div>
                ) : (
                  <input
                    value={campaignNameInput}
                    onChange={(event) => setCampaignNameInput(event.target.value)}
                    disabled={lookupPending}
                    className="w-full rounded-xl border border-md-border bg-md-surface-inset p-3.5 text-sm text-md-text outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:opacity-60"
                  />
                )}
              </div>

              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-md-text-soft">
                  Endereço da campanha
                </label>
                {lockedAddress ? (
                  <div className="rounded-xl border border-md-border/60 bg-md-overlay-subtle px-3.5 py-3 text-sm text-md-text">
                    {lockedAddress}
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--sentinela-text)]">
                      Confirmado via Receita Federal
                    </p>
                  </div>
                ) : (
                  <textarea
                    value={campaignAddressInput}
                    onChange={(event) => setCampaignAddressInput(event.target.value)}
                    disabled={lookupPending}
                    rows={2}
                    className="w-full rounded-xl border border-md-border bg-md-surface-inset p-3.5 text-sm text-md-text outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:opacity-60"
                  />
                )}
              </div>

              <div>
                <label
                  htmlFor="checkout-financial-responsible"
                  className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-md-text-soft"
                >
                  Responsável financeiro / administrador
                </label>
                <input
                  id="checkout-financial-responsible"
                  value={financialResponsible}
                  onChange={(event) => setFinancialResponsible(event.target.value)}
                  className="w-full rounded-xl border border-md-border bg-md-surface-inset p-3.5 text-sm text-md-text outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs">
                <button
                  type="button"
                  disabled={!canPreview || previewLoading}
                  onClick={() => void handlePreview()}
                  className="rounded-lg border border-md-border px-3 py-1.5 font-semibold text-[var(--curador-text)] hover:bg-md-overlay-hover disabled:opacity-50"
                >
                  {previewLoading ? "Gerando preview…" : "Ver contrato completo"}
                </button>
                <Link
                  href={"/compliance" as Route}
                  className="font-semibold text-md-text-soft underline underline-offset-2"
                  target="_blank"
                >
                  Ver dossiê jurídico (página)
                </Link>
              </div>

              {previewOpen && preview?.contractText ? (
                <div className="rounded-xl border border-md-border bg-md-surface-inset">
                  <div className="flex border-b border-md-border">
                    <button
                      type="button"
                      onClick={() => setPreviewTab("contract")}
                      className={`flex-1 px-3 py-2 text-xs font-semibold ${
                        previewTab === "contract"
                          ? "bg-md-overlay-subtle text-md-text"
                          : "text-md-text-soft"
                      }`}
                    >
                      Contrato
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewTab("dossier")}
                      className={`flex-1 px-3 py-2 text-xs font-semibold ${
                        previewTab === "dossier"
                          ? "bg-md-overlay-subtle text-md-text"
                          : "text-md-text-soft"
                      }`}
                    >
                      Dossiê
                    </button>
                  </div>
                  <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap px-3 py-3 text-[11px] leading-relaxed text-md-text-soft">
                    {previewTab === "contract"
                      ? preview.contractText
                      : (preview.dossierText ?? "")}
                  </pre>
                </div>
              ) : null}

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
            <p
              className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400"
              role="alert"
            >
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
            disabled={!canSubmit}
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
