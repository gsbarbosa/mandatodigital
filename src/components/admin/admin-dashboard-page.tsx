"use client";

import type { Route } from "next";
import Link from "next/link";
import { useEffect, useState } from "react";

type Stats = {
  users: { total: number; complete: number; incomplete: number };
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
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 px-5 py-5 transition hover:border-slate-700">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
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
        <h2 className="text-2xl font-bold text-white">Dashboard</h2>
        <p className="mt-1 text-sm text-slate-400">
          Visão rápida da operação. Use o Roadmap para acompanhar entregas com o Thiago.
        </p>
      </header>

      {error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      {!stats && !error ? (
        <p className="text-sm text-slate-500">Carregando…</p>
      ) : null}

      {stats ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card
            label="Usuários cadastrados"
            value={stats.users.total}
            hint={`${stats.users.complete} completos · ${stats.users.incomplete} incompletos`}
            href={"/admin/usuarios" as Route}
          />
          <Card
            label="Roadmap — a fazer"
            value={stats.roadmap.todo}
            hint={`${stats.roadmap.inprogress} em andamento · ${stats.roadmap.done} feitos`}
            href={"/admin/roadmap" as Route}
          />
          <Card
            label="Roadmap — total"
            value={stats.roadmap.total}
            hint="Tasks no board compartilhado"
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
      ) : null}
    </div>
  );
}
