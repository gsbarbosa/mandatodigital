"use client";

import type { Route } from "next";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { APP_HOME_PATH } from "@/lib/app-home";
import { PLAN_SELECTION_PATH } from "@/lib/registration-gate";

type BillingStatusPayload = {
  billingStatus?: string;
  planId?: string | null;
  paidInstallments?: number;
  installmentCount?: number;
  boleto?: {
    url?: string | null;
    linhaDigitavel?: string | null;
    dueDate?: string | null;
    value?: number | null;
    valueLabel?: string | null;
  } | null;
  nfs?: {
    status?: string | null;
    number?: string | null;
    pdfUrl?: string | null;
    xmlUrl?: string | null;
  } | null;
  message?: string;
};

export function AcessoPagamentoPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BillingStatusPayload | null>(null);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/billing/status", { credentials: "same-origin" });
      const payload = (await response.json().catch(() => null)) as BillingStatusPayload | null;
      if (!response.ok) {
        throw new Error(payload?.message || "Não foi possível carregar a cobrança.");
      }
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar cobrança.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 20000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function copyLinha() {
    const linha = data?.boleto?.linhaDigitavel?.trim();
    if (!linha) {
      return;
    }
    try {
      await navigator.clipboard.writeText(linha);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const active = data?.billingStatus === "active";
  const pending = data?.billingStatus === "pending_payment" || data?.billingStatus === "past_due";

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-1 py-8">
      <div className="rounded-2xl border border-[var(--curador-border)] bg-md-surface p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex justify-center">
          <BrandLogo markSize={24} fontSize={22} priority />
        </div>

        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--curador-border)] bg-[var(--curador-soft)] px-3 py-1 text-xs font-semibold text-[var(--curador-text)]">
          Pagamento · Boleto
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-md-text">Cobrança do pacote</h1>
        <p className="mt-3 text-sm leading-relaxed text-md-text-muted">
          Por conformidade TSE, neste momento aceitamos apenas boleto bancário. Após a compensação
          do primeiro boleto, o plano pago é liberado automaticamente.
        </p>

        {loading ? (
          <p className="mt-6 text-sm text-md-text-muted">Carregando status…</p>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        {active ? (
          <div className="mt-6 space-y-4">
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
              Pagamento confirmado. Seu plano {data?.planId ? `(${data.planId})` : ""} está ativo.
              {typeof data?.paidInstallments === "number"
                ? ` Parcelas quitadas: ${data.paidInstallments}/${data.installmentCount ?? 3}.`
                : null}
            </p>
            {data?.nfs?.pdfUrl ? (
              <a
                href={data.nfs.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center rounded-xl border border-md-border px-4 py-3 text-sm font-semibold text-md-text hover:bg-md-overlay-hover"
              >
                Baixar nota fiscal
                {data.nfs.number ? ` nº ${data.nfs.number}` : ""}
              </a>
            ) : null}
            <Link
              href={APP_HOME_PATH as Route}
              className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-sm font-semibold text-white"
            >
              Ir para o produto
            </Link>
          </div>
        ) : null}

        {pending && data?.boleto ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-md-text">
              Status: <strong>aguardando compensação</strong>
              {data.planId ? ` · plano ${data.planId}` : null}
            </p>
            {data.boleto.valueLabel ? (
              <p className="text-sm text-md-text-muted">
                Valor: <strong className="text-md-text">{data.boleto.valueLabel}</strong>
                {data.boleto.dueDate ? ` · vencimento ${data.boleto.dueDate}` : null}
              </p>
            ) : null}

            {data.boleto.linhaDigitavel ? (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-md-text-soft">
                  Linha digitável
                </p>
                <p className="break-all rounded-lg border border-md-border bg-md-surface-inset px-3 py-2 font-mono text-xs text-md-text">
                  {data.boleto.linhaDigitavel}
                </p>
                <button
                  type="button"
                  onClick={() => void copyLinha()}
                  className="mt-2 text-sm font-semibold text-cyan-600 hover:underline"
                >
                  {copied ? "Copiado" : "Copiar linha digitável"}
                </button>
              </div>
            ) : null}

            {data.boleto.url ? (
              <a
                href={data.boleto.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-sm font-semibold text-white"
              >
                Abrir boleto (PDF)
              </a>
            ) : null}

            <button
              type="button"
              onClick={() => {
                setLoading(true);
                void refresh();
              }}
              className="w-full rounded-xl border border-md-border px-4 py-2.5 text-sm font-medium text-md-text-muted hover:bg-md-overlay-hover"
            >
              Atualizar status
            </button>
          </div>
        ) : null}

        {!loading && !active && !data?.boleto ? (
          <div className="mt-6 space-y-3">
            <p className="text-sm text-md-text-muted">
              Nenhum boleto pendente. Escolha um plano para gerar a cobrança.
            </p>
            <Link
              href={PLAN_SELECTION_PATH as Route}
              className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-sm font-semibold text-white"
            >
              Ver planos
            </Link>
          </div>
        ) : null}

        <p className="mt-6 text-center text-xs text-md-text-soft">
          <Link href={PLAN_SELECTION_PATH as Route} className="underline-offset-2 hover:underline">
            Voltar aos planos
          </Link>
        </p>
      </div>
    </div>
  );
}
