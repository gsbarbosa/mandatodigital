"use client";

import type { Route } from "next";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { APP_HOME_PATH } from "@/lib/app-home";
import { useEarlyAccess } from "@/lib/early-access";
import { PLAN_SELECTION_PATH } from "@/lib/registration-gate";

type InstallmentRow = {
  number: number;
  dueDate: string;
  status: "paid" | "pending" | "overdue" | "scheduled";
};

type BillingStatusPayload = {
  billingStatus?: string;
  billingMethod?: "pix" | "boleto" | null;
  planId?: string | null;
  paidInstallments?: number;
  lastPaidAt?: string | null;
  installments?: InstallmentRow[];
  installmentCount?: number;
  hasRemainingInstallments?: boolean;
  boleto?: {
    url?: string | null;
    linhaDigitavel?: string | null;
    dueDate?: string | null;
    value?: number | null;
    valueLabel?: string | null;
  } | null;
  pix?: {
    payload?: string | null;
    qrImage?: string | null;
    expiration?: string | null;
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

function pixImageSrc(qrImage: string) {
  if (qrImage.startsWith("data:")) {
    return qrImage;
  }
  return `data:image/png;base64,${qrImage}`;
}

function formatDueDate(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) {
    return value;
  }
  return `${day}/${month}/${year}`;
}

function installmentStatusLabel(status: InstallmentRow["status"]) {
  if (status === "paid") {
    return "Paga";
  }
  if (status === "overdue") {
    return "Em atraso";
  }
  if (status === "pending") {
    return "Em aberto";
  }
  return "Agendada";
}

export function AcessoPagamentoPage() {
  const [earlyAccess] = useEarlyAccess();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BillingStatusPayload | null>(null);
  const [copied, setCopied] = useState(false);
  const cnpjSigned = Boolean(earlyAccess.cnpj);

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
    const timer = window.setInterval(() => void refresh(), 12000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const active = data?.billingStatus === "active";
  const pastDue = data?.billingStatus === "past_due";
  const showPayUi = Boolean(data?.pix || data?.boleto);
  const isPix = data?.billingMethod === "pix" || Boolean(data?.pix);
  const copyTarget = isPix ? data?.pix?.payload?.trim() : data?.boleto?.linhaDigitavel?.trim();
  const installmentList = data?.installments?.length ? data.installments : null;

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-1 py-8">
      <div className="rounded-2xl border border-[var(--curador-border)] bg-md-surface p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex justify-center">
          <BrandLogo markSize={24} fontSize={22} priority />
        </div>

        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--curador-border)] bg-[var(--curador-soft)] px-3 py-1 text-xs font-semibold text-[var(--curador-text)]">
          Meus pagamentos · {isPix ? "PIX" : "Boleto"}
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-md-text">Meus pagamentos</h1>
        <p className="mt-3 text-sm leading-relaxed text-md-text-muted">
          {isPix
            ? "Pacote único em 3 PIX (hoje, +1 mês e +2 meses). A 1ª parcela libera o plano; se atrasar qualquer uma — inclusive a última — a conta fica inadimplente."
            : "Pacote único em 3 boletos. A 1ª parcela libera o plano; se atrasar qualquer uma — inclusive a última — a conta fica inadimplente."}
        </p>

        {!cnpjSigned ? (
          <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
            Para emitir sua nota fiscal e o contrato de prestação de serviços, é preciso informar
            o CNPJ da campanha.{" "}
            <Link href={"/acesso-antecipado/cnpj" as Route} className="font-semibold underline underline-offset-2">
              Informar CNPJ
            </Link>
          </p>
        ) : null}

        {loading ? <p className="mt-6 text-sm text-md-text-muted">Carregando status…</p> : null}

        {error ? (
          <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        {active || pastDue || installmentList || showPayUi ? (
          <div className="mt-6 space-y-4">
            {active ? (
              <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
                Plano {data?.planId ? `(${data.planId})` : ""} ativo.
                {typeof data?.paidInstallments === "number"
                  ? ` Parcelas quitadas: ${data.paidInstallments}/${data.installmentCount ?? 3}.`
                  : null}
                {data?.hasRemainingInstallments
                  ? " Pague as parcelas restantes para não ficar inadimplente."
                  : null}
              </p>
            ) : null}
            {pastDue ? (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
                Conta inadimplente. Quite a parcela em atraso para regularizar o acesso.
              </p>
            ) : null}
            {installmentList ? (
              <ul className="space-y-2 rounded-xl border border-md-border bg-md-surface-inset px-3 py-3 text-sm">
                {installmentList.map((item) => (
                  <li key={item.number} className="flex items-center justify-between gap-3">
                    <span className="text-md-text">
                      Parcela {item.number}/{data?.installmentCount ?? 3}
                    </span>
                    <span className="text-md-text-muted">{formatDueDate(item.dueDate)}</span>
                    <span className="text-xs font-medium text-md-text-soft">
                      {installmentStatusLabel(item.status)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
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
            {active && !showPayUi ? (
              <Link
                href={APP_HOME_PATH as Route}
                className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-sm font-semibold text-white"
              >
                Ir para o produto
              </Link>
            ) : null}
          </div>
        ) : null}

        {showPayUi ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-md-text">
              Status:{" "}
              <strong>
                {pastDue ? "parcela em atraso" : active ? "próxima parcela" : "aguardando pagamento"}
              </strong>
              {data?.planId ? ` · plano ${data.planId}` : null}
            </p>
            {(data?.pix?.valueLabel || data?.boleto?.valueLabel) ? (
              <p className="text-sm text-md-text-muted">
                Valor:{" "}
                <strong className="text-md-text">
                  {data?.pix?.valueLabel || data?.boleto?.valueLabel}
                </strong>
                {data?.pix?.expiration
                  ? ` · QR válido até ${data.pix.expiration}`
                  : data?.boleto?.dueDate
                    ? ` · vencimento ${data.boleto.dueDate}`
                    : null}
              </p>
            ) : null}

            {data?.pix?.qrImage ? (
              <div className="flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pixImageSrc(data.pix.qrImage)}
                  alt="QR Code PIX"
                  className="h-52 w-52 rounded-xl border border-md-border bg-white p-2"
                />
              </div>
            ) : null}

            {copyTarget ? (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-md-text-soft">
                  {isPix ? "PIX copia e cola" : "Linha digitável"}
                </p>
                <p className="break-all rounded-lg border border-md-border bg-md-surface-inset px-3 py-2 font-mono text-xs text-md-text">
                  {copyTarget}
                </p>
                <button
                  type="button"
                  onClick={() => void copyText(copyTarget)}
                  className="mt-2 text-sm font-semibold text-cyan-600 hover:underline"
                >
                  {copied ? "Copiado" : isPix ? "Copiar código PIX" : "Copiar linha digitável"}
                </button>
              </div>
            ) : null}

            {data?.boleto?.url ? (
              <a
                href={data.boleto.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-sm font-semibold text-white"
              >
                Abrir boleto (PDF)
              </a>
            ) : null}

            {active ? (
              <Link
                href={APP_HOME_PATH as Route}
                className="inline-flex w-full items-center justify-center rounded-xl border border-md-border px-4 py-3 text-sm font-semibold text-md-text hover:bg-md-overlay-hover"
              >
                Continuar no produto
              </Link>
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

        {!loading && !active && !pastDue && !showPayUi ? (
          <div className="mt-6 space-y-3">
            <p className="text-sm text-md-text-muted">
              Nenhuma cobrança pendente. Escolha um plano para gerar o PIX ou o boleto.
            </p>
            <Link
              href={PLAN_SELECTION_PATH as Route}
              className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-sm font-semibold text-white"
            >
              Ver planos
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
