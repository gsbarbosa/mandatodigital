"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type {
  SupportMessage,
  SupportThread,
  SupportThreadStatus,
  SupportThreadWithMessages,
} from "@/lib/support/types";

type ThreadPayload = { thread?: SupportThreadWithMessages; message?: string };
type ListPayload = { threads?: SupportThread[]; message?: string };

function statusLabel(status: SupportThreadStatus) {
  switch (status) {
    case "waiting_human":
      return "Aguardando";
    case "human":
      return "Em atendimento";
    case "ai":
      return "Com IA";
    case "closed":
      return "Encerrado";
    default:
      return status;
  }
}

function statusClass(status: SupportThreadStatus) {
  if (status === "waiting_human") {
    return "text-amber-300";
  }
  if (status === "human") {
    return "text-emerald-300";
  }
  return "text-slate-400";
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function bubbleClass(role: SupportMessage["role"]) {
  if (role === "user") {
    return "bg-cyan-600/20 border-cyan-500/30 text-cyan-50";
  }
  if (role === "human") {
    return "bg-emerald-600/15 border-emerald-500/30 text-emerald-50";
  }
  if (role === "system") {
    return "bg-slate-800/70 border-slate-700 text-slate-400 text-center text-xs";
  }
  return "bg-slate-800/80 border-slate-700 text-slate-200";
}

export function AdminSupportPage() {
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SupportThreadWithMessages | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const loadList = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/support");
      const payload = (await response.json()) as ListPayload;
      if (!response.ok) {
        throw new Error(payload.message || "Falha ao listar suporte.");
      }
      setThreads(payload.threads ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao listar.");
    } finally {
      setLoadingList(false);
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setLoadingDetail(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/support/${id}`);
      const payload = (await response.json()) as ThreadPayload;
      if (!response.ok) {
        throw new Error(payload.message || "Falha ao abrir atendimento.");
      }
      setDetail(payload.thread ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao abrir.");
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
    const id = window.setInterval(() => {
      void loadList();
    }, 8000);
    return () => window.clearInterval(id);
  }, [loadList]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    void loadDetail(selectedId);
    const id = window.setInterval(() => {
      void loadDetail(selectedId);
    }, 5000);
    return () => window.clearInterval(id);
  }, [selectedId, loadDetail]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [detail?.messages.length]);

  async function handleReply(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedId || !draft.trim() || sending) {
      return;
    }
    const body = draft.trim();
    setSending(true);
    setError(null);
    setDraft("");
    try {
      const response = await fetch(`/api/admin/support/${selectedId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const payload = (await response.json()) as ThreadPayload;
      if (!response.ok) {
        throw new Error(payload.message || "Falha ao responder.");
      }
      setDetail(payload.thread ?? null);
      await loadList();
    } catch (err) {
      setDraft(body);
      setError(err instanceof Error ? err.message : "Erro ao responder.");
    } finally {
      setSending(false);
    }
  }

  async function handleClose() {
    if (!selectedId || closing) {
      return;
    }
    setClosing(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/support/${selectedId}/close`, {
        method: "POST",
      });
      const payload = (await response.json()) as ThreadPayload;
      if (!response.ok) {
        throw new Error(payload.message || "Falha ao encerrar.");
      }
      setDetail(payload.thread ?? null);
      setSelectedId(null);
      await loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao encerrar.");
    } finally {
      setClosing(false);
    }
  }

  return (
    <div>
      <header className="mb-8">
        <h2 className="text-2xl font-bold text-white">Suporte</h2>
        <p className="mt-1 text-sm text-slate-400">
          Fila N2 — responda no mesmo chat do produto.
        </p>
      </header>

      {error ? (
        <p className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-2xl border border-slate-800/80">
          <div className="border-b border-slate-800 bg-slate-900/80 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Fila ({threads.length})
          </div>
          <ul className="max-h-[70vh] divide-y divide-slate-800/80 overflow-y-auto">
            {loadingList && threads.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-slate-500">
                Carregando…
              </li>
            ) : null}
            {!loadingList && threads.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-slate-500">
                Nenhum atendimento na fila.
              </li>
            ) : null}
            {threads.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`w-full px-4 py-3 text-left transition hover:bg-slate-900/70 ${
                    selectedId === item.id ? "bg-cyan-500/10" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-white">
                      {item.userEmail || item.ownerUserId}
                    </p>
                    <span
                      className={`shrink-0 text-[11px] font-semibold ${statusClass(item.status)}`}
                    >
                      {statusLabel(item.status)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {item.lastMessagePreview || item.escalationSummary || "—"}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-600">
                    {formatWhen(item.lastMessageAt)}
                    {item.escalationReason
                      ? ` · via ${item.escalationReason === "user" ? "usuário" : "IA"}`
                      : ""}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex min-h-[420px] flex-col overflow-hidden rounded-2xl border border-slate-800/80">
          {!selectedId ? (
            <div className="flex flex-1 items-center justify-center px-6 text-sm text-slate-500">
              Selecione um atendimento na fila.
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3 border-b border-slate-800 bg-slate-900/80 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    {detail?.userEmail || "Atendimento"}
                  </p>
                  {detail?.escalationSummary ? (
                    <p className="mt-1 text-xs text-slate-400">
                      {detail.escalationSummary}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => void handleClose()}
                  disabled={closing || detail?.status === "closed"}
                  className="shrink-0 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:border-rose-500/40 hover:text-rose-200 disabled:opacity-50"
                >
                  {closing ? "Encerrando…" : "Encerrar"}
                </button>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
                {loadingDetail && !detail ? (
                  <p className="text-center text-sm text-slate-500">
                    Carregando conversa…
                  </p>
                ) : null}
                {detail?.messages.map((message) => (
                  <div
                    key={message.id}
                    className={`rounded-lg border px-3 py-2 text-sm leading-relaxed ${bubbleClass(message.role)}`}
                  >
                    {message.role !== "system" ? (
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        {message.authorLabel || message.role}
                      </p>
                    ) : null}
                    <p className="whitespace-pre-wrap">{message.body}</p>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {detail && detail.status !== "closed" ? (
                <form
                  onSubmit={(event) => void handleReply(event)}
                  className="border-t border-slate-800 p-3"
                >
                  <div className="flex gap-2">
                    <textarea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      rows={2}
                      placeholder="Responder ao usuário…"
                      disabled={sending}
                      className="min-w-0 flex-1 resize-none rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-500/50"
                      maxLength={4000}
                    />
                    <button
                      type="submit"
                      disabled={sending || !draft.trim()}
                      className="shrink-0 self-end rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-50"
                    >
                      {sending ? "…" : "Enviar"}
                    </button>
                  </div>
                </form>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
