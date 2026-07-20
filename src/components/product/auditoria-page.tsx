"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  AUDIT_ACTIONS,
  auditActionLabel,
  type AuditEvent,
  type AuditSummary,
} from "@/lib/audit/client";
import { parseJsonOrText } from "@/components/product/persona-shared";

type TabId = "acessos" | "volumes" | "agentes" | "logs";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "acessos", label: "Acessos" },
  { id: "volumes", label: "Volumes" },
  { id: "agentes", label: "Agentes" },
  { id: "logs", label: "Logs" },
];

function truncateId(value: string) {
  if (value.length <= 12) {
    return value;
  }
  return `${value.slice(0, 8)}…`;
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-white tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

function DayBars({
  items,
  emptyLabel,
}: {
  items: Array<{ day: string; count: number }>;
  emptyLabel: string;
}) {
  const max = Math.max(1, ...items.map((item) => item.count));

  if (items.length === 0) {
    return <p className="text-sm text-slate-500">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-2">
      {items.slice(-14).map((item) => (
        <div key={item.day} className="flex items-center gap-3">
          <span className="w-24 shrink-0 text-xs tabular-nums text-slate-400">
            {item.day}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-cyan-500/80"
              style={{ width: `${Math.max(8, (item.count / max) * 100)}%` }}
            />
          </div>
          <span className="w-8 text-right text-xs tabular-nums text-slate-300">
            {item.count}
          </span>
        </div>
      ))}
    </div>
  );
}

export function AuditoriaPage() {
  const [tab, setTab] = useState<TabId>("acessos");
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [logs, setLogs] = useState<AuditEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState("");
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    setIsLoadingSummary(true);
    setError(null);
    try {
      const response = await fetch("/api/audit/summary");
      const payload = await parseJsonOrText<{
        summary?: AuditSummary;
        message?: string;
      }>(response);
      if (!response.ok) {
        throw new Error(payload.message || "Nao foi possivel carregar o resumo.");
      }
      setSummary(payload.summary ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar auditoria.");
      setSummary(null);
    } finally {
      setIsLoadingSummary(false);
    }
  }, []);

  const loadLogs = useCallback(
    async (opts?: { append?: boolean; cursor?: string | null }) => {
      setIsLoadingLogs(true);
      setError(null);
      try {
        const params = new URLSearchParams({ limit: "40" });
        if (actionFilter) {
          params.set("action", actionFilter);
        }
        if (opts?.cursor) {
          params.set("cursor", opts.cursor);
        }
        const response = await fetch(`/api/audit/logs?${params.toString()}`);
        const payload = await parseJsonOrText<{
          items?: AuditEvent[];
          nextCursor?: string | null;
          message?: string;
        }>(response);
        if (!response.ok) {
          throw new Error(payload.message || "Nao foi possivel carregar os logs.");
        }
        const items = payload.items ?? [];
        setLogs((current) => (opts?.append ? [...current, ...items] : items));
        setNextCursor(payload.nextCursor ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao carregar logs.");
        if (!opts?.append) {
          setLogs([]);
        }
      } finally {
        setIsLoadingLogs(false);
      }
    },
    [actionFilter],
  );

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (tab === "logs") {
      void loadLogs();
    }
  }, [tab, loadLogs]);

  const periodHint = useMemo(() => {
    if (!summary) {
      return "Ultimos 30 dias";
    }
    try {
      const from = new Intl.DateTimeFormat("pt-BR", {
        timeZone: summary.timezone,
        dateStyle: "short",
      }).format(new Date(summary.from));
      const to = new Intl.DateTimeFormat("pt-BR", {
        timeZone: summary.timezone,
        dateStyle: "short",
      }).format(new Date(summary.to));
      return `${from} — ${to} (${summary.timezone})`;
    } catch {
      return summary.timezone;
    }
  }, [summary]);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-[51px] md:px-6 md:pt-[77px] lg:px-8">
      <header className="mb-8 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400/90">
          Conta
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
          Auditoria
        </h1>
        <p className="max-w-2xl text-sm text-slate-400">
          Relatorios da sua conta: acessos, volumes de conteudo, operacao dos agentes e
          trilha de acoes com User ID, IP e horario em America/Sao_Paulo.
        </p>
        <p className="text-xs text-slate-500">{periodHint}</p>
      </header>

      <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {TABS.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                active
                  ? "bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/40"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {error ? (
        <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      {tab === "acessos" ? (
        <section className="space-y-6">
          {isLoadingSummary ? (
            <p className="text-sm text-slate-500">Carregando acessos…</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <MetricCard
                  label="Logins no periodo"
                  value={summary?.access.loginCount ?? 0}
                />
                <MetricCard
                  label="Dias ativos"
                  value={summary?.access.activeDays ?? 0}
                />
                <MetricCard
                  label="Ultima sessao"
                  value={
                    summary?.access.lastLogin
                      ? summary.access.lastLogin.timestampLocal
                      : "—"
                  }
                  hint={
                    summary?.access.lastLogin
                      ? `IP ${summary.access.lastLogin.ip}`
                      : undefined
                  }
                />
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-800/80 bg-slate-900/30 p-4">
                  <h2 className="mb-3 text-sm font-semibold text-white">
                    Logins por dia
                  </h2>
                  <DayBars
                    items={summary?.access.loginsByDay ?? []}
                    emptyLabel="Nenhum login registrado no periodo."
                  />
                </div>
                <div className="rounded-2xl border border-slate-800/80 bg-slate-900/30 p-4">
                  <h2 className="mb-3 text-sm font-semibold text-white">
                    Acoes por dia
                  </h2>
                  <DayBars
                    items={summary?.access.actionEventsByDay ?? []}
                    emptyLabel="Nenhuma acao registrada no periodo."
                  />
                </div>
              </div>
            </>
          )}
        </section>
      ) : null}

      {tab === "volumes" ? (
        <section className="space-y-4">
          {isLoadingSummary ? (
            <p className="text-sm text-slate-500">Carregando volumes…</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <MetricCard
                label="Pautas (content requests)"
                value={summary?.volumes.contentRequests ?? 0}
              />
              <MetricCard
                label="Textos gerados"
                value={summary?.volumes.generatedContents ?? 0}
              />
              <MetricCard
                label="Projetos criativos"
                value={summary?.volumes.creativeProjects ?? 0}
              />
              <MetricCard
                label="Criativos com video"
                value={summary?.volumes.creativeProjectsWithVideo ?? 0}
              />
              <MetricCard
                label="Eventos de geracao"
                value={summary?.volumes.contentGenerateEvents ?? 0}
              />
              <MetricCard
                label="Eventos de video"
                value={summary?.volumes.videoGenerateEvents ?? 0}
              />
            </div>
          )}
        </section>
      ) : null}

      {tab === "agentes" ? (
        <section className="space-y-6">
          {isLoadingSummary ? (
            <p className="text-sm text-slate-500">Carregando metricas…</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard label="Jobs totais" value={summary?.agents.jobsTotal ?? 0} />
                <MetricCard
                  label="Jobs ok"
                  value={summary?.agents.jobsSucceeded ?? 0}
                />
                <MetricCard
                  label="Jobs falhos"
                  value={summary?.agents.jobsFailed ?? 0}
                />
                <MetricCard
                  label="Fact-checks"
                  value={summary?.agents.factChecks ?? 0}
                  hint={
                    summary
                      ? `${summary.agents.factCheckBypasses} bypass (prompt livre)`
                      : undefined
                  }
                />
              </div>
              <div className="overflow-x-auto rounded-2xl border border-slate-800/80">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-900/80 text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Tipo</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Qtd</th>
                      <th className="px-4 py-3 font-semibold">Latencia media</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {(summary?.agents.jobsByTypeStatus ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-slate-500">
                          Nenhum job no periodo.
                        </td>
                      </tr>
                    ) : (
                      summary?.agents.jobsByTypeStatus.map((row) => (
                        <tr key={`${row.type}-${row.status}`} className="text-slate-300">
                          <td className="px-4 py-3 font-medium text-white">{row.type}</td>
                          <td className="px-4 py-3">{row.status}</td>
                          <td className="px-4 py-3 tabular-nums">{row.count}</td>
                          <td className="px-4 py-3 tabular-nums">
                            {row.avgLatencyMs == null
                              ? "—"
                              : `${Math.round(row.avgLatencyMs / 1000)}s`}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      ) : null}

      {tab === "logs" ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-slate-400">
              Acao
              <select
                className="ml-2 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-200"
                value={actionFilter}
                onChange={(event) => setActionFilter(event.target.value)}
              >
                <option value="">Todas</option>
                {AUDIT_ACTIONS.map((action) => (
                  <option key={action} value={action}>
                    {auditActionLabel(action)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => void loadLogs()}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300"
            >
              Atualizar
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800/80">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-900/80 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Data / hora</th>
                  <th className="px-4 py-3 font-semibold">Acao</th>
                  <th className="px-4 py-3 font-semibold">IP</th>
                  <th className="px-4 py-3 font-semibold">User ID</th>
                  <th className="px-4 py-3 font-semibold">Detalhe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {logs.length === 0 && !isLoadingLogs ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-slate-500">
                      Nenhum log encontrado.
                    </td>
                  </tr>
                ) : (
                  logs.map((row) => (
                    <tr key={row.id} className="align-top text-slate-300">
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-400">
                        {row.timestampLocal}
                      </td>
                      <td className="px-4 py-3 font-medium text-white">
                        {auditActionLabel(row.action || row.eventType)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{row.ip}</td>
                      <td
                        className="px-4 py-3 font-mono text-xs"
                        title={row.ownerUserId}
                      >
                        {truncateId(row.ownerUserId)}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        <pre className="max-w-xs overflow-x-auto whitespace-pre-wrap break-all">
                          {JSON.stringify(row.payload)}
                        </pre>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {nextCursor ? (
            <button
              type="button"
              disabled={isLoadingLogs}
              onClick={() => void loadLogs({ append: true, cursor: nextCursor })}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-cyan-500/40 disabled:opacity-50"
            >
              {isLoadingLogs ? "Carregando…" : "Carregar mais"}
            </button>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
