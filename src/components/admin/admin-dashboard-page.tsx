"use client";

import type { Route } from "next";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  BILLING_STATUS_LABELS,
  NFS_BUCKET_LABELS,
  PLAN_LABELS,
  classifyNfsStatus,
  type AdminBillingSummary,
  type AdminUserRow,
} from "@/lib/admin/billing-dashboard";

type Stats = {
  users: { total: number; complete: number; incomplete: number; newLast7d: number };
  billing: AdminBillingSummary;
  recentUsers: AdminUserRow[];
  roadmap: { todo: number; inprogress: number; done: number; total: number };
  providers: { total: number; configured: number; missing: number };
};

function Card({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  href?: Route;
}) {
  const inner = (
    <div className="rounded-2xl border border-md-border bg-md-surface/40 px-5 py-5 transition hover:border-md-border">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-md-text-soft">{label}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums text-md-text">{value}</p>
      {hint ? <p className="mt-1 text-xs text-md-text-soft">{hint}</p> : null}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function formatDate(value: string) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function billingClass(status: AdminUserRow["billingStatus"]) {
  if (status === "active") {
    return "text-emerald-300";
  }
  if (status === "pending_payment" || status === "past_due") {
    return "text-amber-200";
  }
  if (status === "canceled") {
    return "text-rose-300";
  }
  return "text-md-text-soft";
}

function nfsClass(status: string | null, pdfUrl: string | null) {
  const bucket = pdfUrl ? "authorized" : classifyNfsStatus(status);
  if (bucket === "authorized") {
    return "text-emerald-300";
  }
  if (bucket === "error") {
    return "text-rose-300";
  }
  if (bucket === "pending") {
    return "text-amber-200";
  }
  return "text-md-text-soft";
}

export function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/admin/stats");
        const payload = (await response.json()) as Stats & { message?: string };
        if (!response.ok) {
          throw new Error(payload.message || "Falha ao carregar dashboard.");
        }
        if (!cancelled) {
          setStats(payload);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erro ao carregar.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <header className="mb-8">
        <h2 className="text-2xl font-bold text-md-text">Dashboard</h2>
        <p className="mt-1 text-sm text-md-text-soft">
          Cadastros, pagamentos e NFS-e. Lista completa em Usuários.
        </p>
      </header>

      {error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      {!stats && !error ? <p className="text-sm text-md-text-soft">Carregando…</p> : null}

      {stats ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card
              label="Novos (7 dias)"
              value={stats.billing.newLast7d}
              hint={`${stats.users.total} cadastros no total`}
              href={"/admin/usuarios" as Route}
            />
            <Card
              label="Cadastro completo"
              value={stats.users.complete}
              hint={`${stats.users.incomplete} incompletos`}
              href={"/admin/usuarios" as Route}
            />
            <Card
              label="Pagaram / ativos"
              value={stats.billing.paid}
              hint={`${stats.billing.pendingPayment} aguardando boleto · ${stats.billing.trial} trial`}
              href={"/admin/usuarios" as Route}
            />
            <Card
              label="NFS autorizada"
              value={stats.billing.nfsAuthorized}
              hint={
                stats.billing.nfsError > 0
                  ? `${stats.billing.nfsError} com erro · ${stats.billing.nfsPending} pendente`
                  : `${stats.billing.nfsPending} pendente`
              }
              href={"/admin/usuarios" as Route}
            />
          </div>

          <section className="mt-8">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-md-text-soft">
              Planos
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {(["essencial", "avancado", "elite", "none"] as const).map((plan) => (
                <div
                  key={plan}
                  className="rounded-2xl border border-md-border bg-md-surface/30 px-4 py-4"
                >
                  <p className="text-sm font-medium text-md-text">{PLAN_LABELS[plan]}</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-md-text">
                    {stats.billing.byPlan[plan].paid}
                    <span className="ml-1 text-sm font-normal text-md-text-soft">
                      pagos / {stats.billing.byPlan[plan].total}
                    </span>
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-8">
            <div className="mb-3 flex items-end justify-between gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-md-text-soft">
                Cadastros recentes
              </h3>
              <Link
                href={"/admin/usuarios" as Route}
                className="text-xs font-medium text-cyan-400 hover:underline"
              >
                Ver todos
              </Link>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-md-border">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-md-surface/80 text-[11px] uppercase tracking-wider text-md-text-soft">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Cliente</th>
                    <th className="px-4 py-3 font-semibold">Plano</th>
                    <th className="px-4 py-3 font-semibold">Pagamento</th>
                    <th className="px-4 py-3 font-semibold">NFS-e</th>
                    <th className="px-4 py-3 font-semibold">Atualizado</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-md-text-soft">
                        Nenhum cadastro ainda.
                      </td>
                    </tr>
                  ) : null}
                  {stats.recentUsers.map((user) => {
                    const nfsBucket = user.lastNfsPdfUrl
                      ? "authorized"
                      : classifyNfsStatus(user.lastNfsStatus);
                    return (
                      <tr
                        key={user.ownerUserId}
                        className="border-t border-md-border text-md-text-muted"
                      >
                        <td className="px-4 py-3">
                          <p className="text-md-text">{user.fullName || "—"}</p>
                          <p className="text-xs text-md-text-soft">{user.email || "—"}</p>
                        </td>
                        <td className="px-4 py-3 capitalize">
                          {PLAN_LABELS[
                            user.planId === "essencial" ||
                            user.planId === "avancado" ||
                            user.planId === "elite"
                              ? user.planId
                              : "none"
                          ]}
                        </td>
                        <td className={`px-4 py-3 ${billingClass(user.billingStatus)}`}>
                          {BILLING_STATUS_LABELS[user.billingStatus]}
                          {user.billingMethod ? ` · ${user.billingMethod.toUpperCase()}` : ""}
                          {user.paidInstallments > 0
                            ? ` · ${user.paidInstallments}x`
                            : ""}
                        </td>
                        <td className={`px-4 py-3 ${nfsClass(user.lastNfsStatus, user.lastNfsPdfUrl)}`}>
                          {user.lastNfsNumber
                            ? `#${user.lastNfsNumber}`
                            : NFS_BUCKET_LABELS[nfsBucket]}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {formatDate(user.updatedAt || user.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Card
              label="Roadmap — a fazer"
              value={stats.roadmap.todo}
              hint={`${stats.roadmap.inprogress} em andamento · ${stats.roadmap.done} feitos`}
              href={"/admin/roadmap" as Route}
            />
            <Card
              label="Provedores ok"
              value={`${stats.providers.configured}/${stats.providers.total}`}
              hint={
                stats.providers.missing > 0
                  ? `${stats.providers.missing} obrigatório(s) sem chave`
                  : "Todos os obrigatórios configurados"
              }
              href={"/admin/provedores" as Route}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
