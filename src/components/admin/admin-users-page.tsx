"use client";

import { useEffect, useMemo, useState } from "react";

import {
  BILLING_STATUS_LABELS,
  NFS_BUCKET_LABELS,
  PLAN_LABELS,
  classifyNfsStatus,
  type AdminUserRow,
  type NfsBucket,
} from "@/lib/admin/billing-dashboard";
import type { BillingStatus } from "@/lib/billing/plan-pricing";

type Filter = "all" | BillingStatus | `nfs_${NfsBucket}`;

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
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function billingClass(status: BillingStatus) {
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

function nfsBucketOf(user: AdminUserRow): NfsBucket {
  if (user.lastNfsPdfUrl) {
    return "authorized";
  }
  return classifyNfsStatus(user.lastNfsStatus);
}

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "active", label: "Pagos" },
  { id: "pending_payment", label: "Aguardando pagamento" },
  { id: "trial", label: "Trial" },
  { id: "past_due", label: "Inadimplente" },
  { id: "nfs_authorized", label: "NFS ok" },
  { id: "nfs_error", label: "NFS erro" },
];

export function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/admin/users");
        const payload = (await response.json()) as { users?: AdminUserRow[]; message?: string };
        if (!response.ok) {
          throw new Error(payload.message || "Falha ao listar usuários.");
        }
        if (!cancelled) {
          setUsers(payload.users ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erro.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((user) => {
      if (filter === "active" || filter === "pending_payment" || filter === "trial" || filter === "past_due") {
        if (user.billingStatus !== filter) {
          return false;
        }
      } else if (filter.startsWith("nfs_")) {
        const bucket = filter.replace("nfs_", "") as NfsBucket;
        if (nfsBucketOf(user) !== bucket) {
          return false;
        }
      }
      if (!q) {
        return true;
      }
      return [user.fullName, user.email, user.party, user.uf, user.planId]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [users, filter, query]);

  return (
    <div>
      <header className="mb-6">
        <h2 className="text-2xl font-bold text-md-text">Usuários</h2>
        <p className="mt-1 text-sm text-md-text-soft">
          Cadastro, plano, pagamento e NFS-e (somente leitura).
        </p>
      </header>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                filter === item.id
                  ? "bg-cyan-500/20 text-cyan-300"
                  : "bg-md-surface text-md-text-soft hover:text-md-text"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar nome, e-mail, partido…"
          className="w-full rounded-xl border border-md-border bg-md-surface px-3 py-2 text-sm text-md-text placeholder:text-md-text-soft sm:max-w-xs"
        />
      </div>

      {error ? (
        <p className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-md-border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-md-surface/80 text-[11px] uppercase tracking-wider text-md-text-soft">
            <tr>
              <th className="px-4 py-3 font-semibold">Cliente</th>
              <th className="px-4 py-3 font-semibold">Partido / UF</th>
              <th className="px-4 py-3 font-semibold">Plano</th>
              <th className="px-4 py-3 font-semibold">Pagamento</th>
              <th className="px-4 py-3 font-semibold">NFS-e</th>
              <th className="px-4 py-3 font-semibold">Cadastro</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && !error ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-md-text-soft">
                  Nenhum usuário ou ainda carregando…
                </td>
              </tr>
            ) : null}
            {visible.map((user) => {
              const nfs = nfsBucketOf(user);
              return (
                <tr key={user.ownerUserId} className="border-t border-md-border text-md-text-muted">
                  <td className="px-4 py-3">
                    <p className="text-md-text">{user.fullName || "—"}</p>
                    <p className="text-xs text-md-text-soft">{user.email || "—"}</p>
                  </td>
                  <td className="px-4 py-3">
                    {[user.party, user.uf].filter(Boolean).join(" / ") || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {PLAN_LABELS[
                      user.planId === "essencial" ||
                      user.planId === "avancado" ||
                      user.planId === "elite"
                        ? user.planId
                        : "none"
                    ]}
                  </td>
                  <td className={`px-4 py-3 ${billingClass(user.billingStatus)}`}>
                    <p>
                      {BILLING_STATUS_LABELS[user.billingStatus]}
                      {user.billingMethod ? ` · ${user.billingMethod.toUpperCase()}` : ""}
                    </p>
                    {user.paidInstallments > 0 ? (
                      <p className="text-xs text-md-text-soft">{user.paidInstallments} parcela(s)</p>
                    ) : null}
                    {user.lastPaidAt ? (
                      <p className="text-xs text-md-text-soft">pago {formatDate(user.lastPaidAt)}</p>
                    ) : null}
                    {user.billingFirstDueDate ? (
                      <p className="text-xs text-md-text-soft">
                        3x a partir de {user.billingFirstDueDate.split("-").reverse().join("/")}
                      </p>
                    ) : null}
                    {user.pendingBoletoDueDate &&
                    (user.billingStatus === "pending_payment" || user.billingStatus === "past_due") ? (
                      <p className="text-xs text-md-text-soft">vence {user.pendingBoletoDueDate}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <p
                      className={
                        nfs === "authorized"
                          ? "text-emerald-300"
                          : nfs === "error"
                            ? "text-rose-300"
                            : nfs === "pending"
                              ? "text-amber-200"
                              : "text-md-text-soft"
                      }
                    >
                      {user.lastNfsNumber ? `#${user.lastNfsNumber}` : NFS_BUCKET_LABELS[nfs]}
                    </p>
                    {user.lastNfsPdfUrl ? (
                      <a
                        href={user.lastNfsPdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-cyan-400 hover:underline"
                      >
                        PDF
                      </a>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <p>{user.status === "complete" ? "completo" : user.status}</p>
                    <p className="text-md-text-soft">{formatDate(user.createdAt)}</p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
