"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  DISTRIBUTION_CHANNELS,
  type DistributionChannelId,
} from "@/lib/distribution/channels";
import {
  approveDemoPost,
  connectDemoAccounts,
  getDemoConnections,
  isDistributionDemoMode,
  listDemoPosts,
  rejectDemoPost,
  retryDemoPost,
  setDemoElectionDate,
  updateDemoPost,
  type DemoConnectionsSnapshot,
} from "@/lib/distribution/demo-store";
import type { DistributionPost } from "@/lib/distribution/types";

type TabId = "fila" | "contas" | "historico";

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  pending_approval: "Aguardando Go",
  approved: "Aprovado",
  publishing: "Publicando",
  scheduled: "Agendado",
  published: "Publicado",
  partial_failure: "Falha parcial",
  failed: "Falhou",
  rejected: "No-go",
  blocked_blackout: "Blackout",
};

function statusClass(status: string) {
  if (status === "published" || status === "scheduled") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }
  if (status === "failed" || status === "blocked_blackout") {
    return "border-red-500/30 bg-red-500/10 text-red-300";
  }
  if (status === "partial_failure" || status === "rejected") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  }
  if (status === "publishing" || status === "approved") {
    return "border-cyan-500/30 bg-cyan-500/10 text-cyan-200";
  }
  return "border-md-border bg-md-surface-inset text-md-text-muted";
}

function deliveryLabel(status: string | undefined) {
  switch (status) {
    case "published":
      return "Publicado";
    case "scheduled":
      return "Agendado";
    case "failed":
      return "Falhou";
    case "queued":
    case "publishing":
      return "Em andamento";
    case "skipped":
      return "Ignorado";
    default:
      return "Pendente";
  }
}

function isEditable(status: DistributionPost["status"]) {
  return status === "pending_approval" || status === "draft" || status === "rejected";
}

export function DistribuidorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusPostId = searchParams.get("post");
  const demoMode = isDistributionDemoMode();

  const [tab, setTab] = useState<TabId>("fila");
  const [posts, setPosts] = useState<DistributionPost[]>([]);
  const [connections, setConnections] = useState<DemoConnectionsSnapshot | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(focusPostId);
  const [captionDraft, setCaptionDraft] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [electionDate, setElectionDate] = useState("");
  const [selectedChannels, setSelectedChannels] = useState<DistributionChannelId[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const selected = useMemo(
    () => posts.find((post) => post.id === selectedId) ?? null,
    [posts, selectedId],
  );

  const queue = useMemo(
    () =>
      posts.filter((post) =>
        [
          "draft",
          "pending_approval",
          "approved",
          "publishing",
          "rejected",
          "blocked_blackout",
        ].includes(post.status),
      ),
    [posts],
  );

  const history = useMemo(
    () =>
      posts.filter((post) =>
        ["published", "scheduled", "partial_failure", "failed"].includes(post.status),
      ),
    [posts],
  );

  const connectedCount = useMemo(
    () => connections?.channels.filter((channel) => channel.connected).length ?? 0,
    [connections],
  );

  const loadAll = useCallback((opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setIsLoading(true);
    }
    setError(null);
    try {
      const nextPosts = listDemoPosts();
      const nextConnections = getDemoConnections();
      setPosts(nextPosts);
      setConnections(nextConnections);
      setElectionDate(nextConnections.electionDate ?? "");
      setSelectedId((current) => {
        if (focusPostId && nextPosts.some((post) => post.id === focusPostId)) {
          return focusPostId;
        }
        if (current && nextPosts.some((post) => post.id === current)) {
          return current;
        }
        return nextPosts[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar Distribuidor.");
    } finally {
      if (!opts?.silent) {
        setIsLoading(false);
      }
    }
  }, [focusPostId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (focusPostId) {
      setSelectedId(focusPostId);
      setTab("fila");
    }
  }, [focusPostId]);

  useEffect(() => {
    if (!selected) {
      return;
    }
    setCaptionDraft(selected.captionBase);
    setScheduledAt(selected.scheduledAt ? selected.scheduledAt.slice(0, 16) : "");
    setSelectedChannels(selected.channels);
  }, [selected]);

  function runAction(action: () => void, successMessage: string, nextTab?: TabId) {
    setBusy(true);
    setError(null);
    try {
      action();
      setNotice(successMessage);
      loadAll({ silent: true });
      if (nextTab) {
        setTab(nextTab);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel concluir a acao.");
    } finally {
      setBusy(false);
    }
  }

  function connectAccounts() {
    runAction(
      () => {
        connectDemoAccounts();
      },
      "Contas de demonstração conectadas nas sete redes.",
      "contas",
    );
  }

  function saveElectionDate() {
    runAction(() => {
      setDemoElectionDate(electionDate.trim() ? electionDate.trim() : null);
    }, "Data da eleição salva (blackout 72h antes / 24h depois).");
  }

  function saveDraft() {
    if (!selected) {
      return;
    }
    runAction(() => {
      updateDemoPost(selected.id, {
        captionBase: captionDraft,
        channels: selectedChannels,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      });
    }, "Pacote atualizado.");
  }

  function approve() {
    if (!selected) {
      return;
    }
    runAction(
      () => {
        updateDemoPost(selected.id, {
          captionBase: captionDraft,
          channels: selectedChannels,
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        });
        approveDemoPost(selected.id);
      },
      "Go confirmado. Publicação simulada nas redes selecionadas.",
      "historico",
    );
  }

  function reject() {
    if (!selected) {
      return;
    }
    const reason = window.prompt("Motivo do No-go (opcional):") ?? "";
    runAction(() => {
      rejectDemoPost(selected.id, reason);
    }, "No-go registrado.");
  }

  function retry(postId: string) {
    runAction(() => {
      retryDemoPost(postId);
    }, "Retry simulado — canais atualizados.");
  }

  function toggleChannel(id: DistributionChannelId) {
    setSelectedChannels((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  const list = tab === "historico" ? history : queue;

  return (
    <div className="min-h-full relative pb-20">
      <div className="pointer-events-none absolute top-[-10%] left-[-12%] h-[42%] w-[52%] rounded-full bg-amber-500/10 blur-[140px]" />
      <div className="pointer-events-none absolute top-[28%] right-[-10%] h-[38%] w-[42%] rounded-full bg-orange-600/10 blur-[120px]" />

      <div className="relative z-10 mx-auto max-w-6xl px-4 pt-10 sm:px-6 lg:px-8">
        <header className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--distribuidor-text)]">
            Agente 05
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-md-text">Distribuidor</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-md-text-soft">
            Revise o vídeo selado, escolha as redes, confirme Go/No-go e acompanhe o disparo
            coordenado — com janela de horário e blackout eleitoral.
          </p>
        </header>

        {demoMode ? (
          <div className="mb-6 rounded-xl border border-[var(--distribuidor-border)] bg-[var(--distribuidor-soft)] px-5 py-4">
            <p className="text-sm leading-relaxed text-[var(--distribuidor-text)]">
              Pré-visualização do fluxo. A publicação real nas redes fica desligada por enquanto —
              tudo aqui roda no navegador para você validar Go/No-go, contas e histórico.
            </p>
          </div>
        ) : null}

        <div className="mb-8 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-md-border bg-md-surface/40 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-md-text-soft">
              Na fila
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-md-text">{queue.length}</p>
          </div>
          <div className="rounded-2xl border border-md-border bg-md-surface/40 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-md-text-soft">
              Redes conectadas
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-md-text">
              {connectedCount}
              <span className="text-sm font-medium text-md-text-soft"> / 7</span>
            </p>
          </div>
          <div className="rounded-2xl border border-md-border bg-md-surface/40 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-md-text-soft">
              No histórico
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-md-text">{history.length}</p>
          </div>
        </div>

        {notice ? (
          <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {notice}
          </div>
        ) : null}
        {error ? (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="mb-6 flex flex-wrap items-center gap-2">
          {(
            [
              ["fila", "Fila", queue.length],
              ["contas", "Contas", connectedCount],
              ["historico", "Histórico", history.length],
            ] as const
          ).map(([id, label, count]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-full border px-4 py-1.5 text-sm transition ${
                tab === id
                  ? "border-[var(--distribuidor-border)] bg-[var(--distribuidor-soft)] text-[var(--distribuidor-text)]"
                  : "border-md-border text-md-text-soft hover:border-md-border-strong"
              }`}
            >
              {label}
              <span className="ml-1.5 tabular-nums text-xs opacity-70">{count}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => loadAll()}
            className="ml-auto rounded-full border border-md-border px-3 py-1.5 text-xs text-md-text-soft transition hover:border-md-border-strong hover:text-md-text"
          >
            Atualizar
          </button>
        </div>

        {isLoading ? (
          <div
            className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-[var(--distribuidor-soft)] px-5 py-4"
            role="status"
          >
            <span
              className="mt-0.5 h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-md-border border-t-[var(--distribuidor)]"
              aria-hidden="true"
            />
            <p className="text-sm text-md-text-muted">Carregando Distribuidor…</p>
          </div>
        ) : tab === "contas" ? (
          <section className="space-y-6">
            <div className="rounded-[1.75rem] border border-md-border bg-gradient-to-b from-md-surface/50 to-md-slate-900/20 p-5 shadow-xl backdrop-blur-xl md:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-md-text">Redes conectadas</h2>
                  <p className="mt-1 max-w-xl text-sm text-md-text-soft">
                    Conecte as sete redes do mandato. Nesta pré-visualização, o botão simula o
                    vínculo OAuth sem sair do app.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={connectAccounts}
                  className="rounded-xl bg-[var(--distribuidor)] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-[var(--distribuidor-hover)] disabled:opacity-50"
                >
                  {connectedCount === 7 ? "Reconectar contas" : "Conectar redes"}
                </button>
              </div>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                {(connections?.channels ?? []).map((channel) => (
                  <li
                    key={channel.id}
                    className="flex items-center justify-between rounded-xl border border-md-border bg-md-surface-inset/60 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-md-text">{channel.label}</p>
                      {channel.displayName ? (
                        <p className="mt-0.5 text-xs text-md-text-soft">{channel.displayName}</p>
                      ) : (
                        <p className="mt-0.5 text-xs text-md-text-muted">Aguardando conexão</p>
                      )}
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                        channel.connected
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                          : "border-md-border text-md-text-muted"
                      }`}
                    >
                      {channel.connected ? "Conectada" : "Pendente"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-[1.75rem] border border-md-border bg-md-surface/40 p-5 md:p-6">
              <h2 className="text-lg font-semibold text-md-text">Blackout eleitoral</h2>
              <p className="mt-1 text-sm text-md-text-soft">
                Informe a data da eleição. Publicações ficam bloqueadas 72h antes e 24h depois.
              </p>
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <label className="text-sm text-md-text-soft">
                  Data
                  <input
                    type="date"
                    value={electionDate}
                    onChange={(event) => setElectionDate(event.target.value)}
                    className="mt-1 block rounded-lg border border-md-border bg-md-surface-inset px-3 py-2 text-md-text"
                  />
                </label>
                <button
                  type="button"
                  disabled={busy}
                  onClick={saveElectionDate}
                  className="rounded-xl border border-md-border px-4 py-2 text-sm text-md-text transition hover:border-md-border-strong disabled:opacity-50"
                >
                  Salvar
                </button>
              </div>
            </div>
          </section>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_1.25fr]">
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-md-text-soft">
                {tab === "historico" ? "Histórico" : "Fila de aprovação"}
              </h2>
              {list.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-md-border bg-md-surface/20 px-5 py-10 text-center">
                  <p className="text-sm text-md-text-soft">
                    {tab === "historico"
                      ? "Nenhuma publicação concluída ainda."
                      : "Nenhum pacote na fila."}
                  </p>
                  {tab !== "historico" ? (
                    <Link
                      href="/criativo"
                      className="mt-4 inline-flex rounded-xl border border-[var(--distribuidor-border)] bg-[var(--distribuidor-soft)] px-4 py-2 text-sm font-semibold text-[var(--distribuidor-text)] transition hover:brightness-110"
                    >
                      Ir para Meus criativos
                    </Link>
                  ) : null}
                </div>
              ) : (
                list.map((post) => (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(post.id);
                      router.replace(`/distribuidor?post=${post.id}`);
                    }}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                      selectedId === post.id
                        ? "border-[var(--distribuidor-border)] bg-[var(--distribuidor-soft)]"
                        : "border-md-border bg-md-surface/30 hover:border-md-border-strong"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-md-text">
                        {post.captionBase.slice(0, 80) ||
                          `Criativo ${post.creativeProjectId.slice(0, 8)}`}
                      </p>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusClass(post.status)}`}
                      >
                        {STATUS_LABEL[post.status] ?? post.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-md-text-soft">
                      {post.channels.length} canais ·{" "}
                      {new Date(post.createdAt).toLocaleString("pt-BR")}
                    </p>
                  </button>
                ))
              )}
            </section>

            <section className="rounded-[1.75rem] border border-md-border bg-gradient-to-b from-md-surface/50 to-md-slate-900/20 p-5 shadow-xl backdrop-blur-xl md:p-6">
              {!selected ? (
                <div className="flex min-h-[280px] flex-col items-center justify-center text-center">
                  <p className="text-sm text-md-text-soft">
                    Selecione um pacote na fila para revisar caption, redes e dar Go ou No-go.
                  </p>
                  <Link
                    href="/criativo"
                    className="mt-4 text-sm font-medium text-[var(--distribuidor-text)] underline-offset-2 hover:underline"
                  >
                    Enviar um criativo selado
                  </Link>
                </div>
              ) : (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-lg font-semibold text-md-text">Revisão Go / No-go</h2>
                    <p className="mt-1 text-xs text-md-text-soft">
                      Status: {STATUS_LABEL[selected.status] ?? selected.status}
                      {selected.lastError ? ` — ${selected.lastError}` : ""}
                    </p>
                  </div>

                  {selected.videoUrl ? (
                    <video
                      src={selected.videoUrl}
                      controls
                      className="aspect-video w-full rounded-xl border border-md-border bg-black"
                    />
                  ) : (
                    <div className="flex aspect-video items-center justify-center rounded-xl border border-dashed border-md-border bg-md-surface-inset/50 text-sm text-md-text-soft">
                      Sem prévia de vídeo neste pacote
                    </div>
                  )}

                  <label className="block text-sm text-md-text-soft">
                    Caption base
                    <textarea
                      value={captionDraft}
                      onChange={(event) => setCaptionDraft(event.target.value)}
                      rows={4}
                      disabled={!isEditable(selected.status)}
                      className="mt-1 w-full rounded-lg border border-md-border bg-md-surface-inset px-3 py-2 text-sm text-md-text disabled:opacity-60"
                    />
                  </label>

                  <div>
                    <p className="text-sm text-md-text-soft">Canais</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {DISTRIBUTION_CHANNELS.map((channel) => {
                        const active = selectedChannels.includes(channel.id);
                        const connected = connections?.channels.find(
                          (row) => row.id === channel.id,
                        )?.connected;
                        return (
                          <button
                            key={channel.id}
                            type="button"
                            disabled={!isEditable(selected.status)}
                            onClick={() => toggleChannel(channel.id)}
                            className={`rounded-full border px-3 py-1 text-xs transition disabled:opacity-50 ${
                              active
                                ? "border-[var(--distribuidor-border)] bg-[var(--distribuidor-soft)] text-[var(--distribuidor-text)]"
                                : "border-md-border text-md-text-muted"
                            }`}
                          >
                            {channel.label}
                            {!connected ? " · off" : ""}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <label className="block text-sm text-md-text-soft">
                    Agendar (opcional)
                    <input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(event) => setScheduledAt(event.target.value)}
                      disabled={!isEditable(selected.status)}
                      className="mt-1 block rounded-lg border border-md-border bg-md-surface-inset px-3 py-2 text-md-text disabled:opacity-60"
                    />
                  </label>

                  <div className="space-y-2">
                    <p className="text-sm text-md-text-soft">Status por rede</p>
                    {selected.channels.map((channel) => {
                      const state = selected.perChannelStatus[channel];
                      const label =
                        DISTRIBUTION_CHANNELS.find((item) => item.id === channel)?.label ??
                        channel;
                      return (
                        <div
                          key={channel}
                          className="flex items-center justify-between rounded-lg border border-md-border px-3 py-2 text-xs"
                        >
                          <span className="text-md-text">{label}</span>
                          <span className="text-md-text-soft">
                            {deliveryLabel(state?.status)}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap gap-2 border-t border-md-border pt-4">
                    {isEditable(selected.status) ? (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={saveDraft}
                          className="rounded-xl border border-md-border px-4 py-2 text-sm text-md-text transition hover:border-md-border-strong disabled:opacity-50"
                        >
                          Salvar
                        </button>
                        <button
                          type="button"
                          disabled={busy || selectedChannels.length === 0}
                          onClick={approve}
                          className="rounded-xl bg-[var(--distribuidor)] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-[var(--distribuidor-hover)] disabled:opacity-50"
                        >
                          Go — publicar
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={reject}
                          className="rounded-xl border border-red-500/40 px-4 py-2 text-sm text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
                        >
                          No-go
                        </button>
                      </>
                    ) : null}
                    {(selected.status === "partial_failure" || selected.status === "failed") && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => retry(selected.id)}
                        className="rounded-xl bg-[var(--distribuidor)] px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
                      >
                        Retry canais falhos
                      </button>
                    )}
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
