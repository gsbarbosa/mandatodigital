"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import type {
  SupportMessage,
  SupportThreadStatus,
  SupportThreadWithMessages,
} from "@/lib/support/types";

type ThreadPayload = { thread?: SupportThreadWithMessages; message?: string };

type LocalMessage = SupportMessage & { pending?: boolean };

function CloseIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function statusHeader(status: SupportThreadStatus | null | undefined): {
  label: string;
  className: string;
} {
  if (status === "waiting_human") {
    return { label: "Aguardando atendimento", className: "text-[var(--distribuidor-text)]" };
  }
  if (status === "human") {
    return { label: "Em atendimento", className: "text-emerald-300" };
  }
  if (status === "closed") {
    return { label: "Encerrado", className: "text-md-text-soft" };
  }
  return { label: "Online", className: "text-[var(--curador-text)]" };
}

function statusBanner(status: SupportThreadStatus): string | null {
  if (status === "waiting_human") {
    return "Um momento — estamos aprofundando seu caso…";
  }
  if (status === "human") {
    return "Continuamos por aqui com você";
  }
  if (status === "closed") {
    return "Atendimento encerrado";
  }
  return null;
}

function bubbleClass(role: SupportMessage["role"]) {
  if (role === "user") {
    return "ml-8 bg-cyan-600/25 text-cyan-50 border border-cyan-500/30 rounded-2xl rounded-br-md";
  }
  if (role === "system") {
    return "mx-2 bg-md-surface-inset text-md-text-soft border border-md-border text-center text-[12px] rounded-xl";
  }
  return "mr-8 bg-md-surface-inset text-md-text border border-md-border rounded-2xl rounded-bl-md";
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 px-1 py-0.5" aria-label="Digitando">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:300ms]" />
    </span>
  );
}

const WELCOME_BODY =
  "Olá! Como podemos ajudar com o Mandato Digital? Pode perguntar sobre monitoramento, avatares, criativos ou compliance.";

export function SupportWidget({ onClose }: { onClose: () => void }) {
  const [thread, setThread] = useState<SupportThreadWithMessages | null>(null);
  const [optimistic, setOptimistic] = useState<LocalMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const dismissedClosedIdRef = useRef<string | null>(null);

  const applyThread = useCallback((next: SupportThreadWithMessages | null) => {
    if (
      next?.status === "closed" &&
      next.id === dismissedClosedIdRef.current
    ) {
      setThread(null);
      setOptimistic([]);
      return;
    }
    if (next && next.status !== "closed") {
      dismissedClosedIdRef.current = null;
    }
    setThread(next);
    setOptimistic([]);
  }, []);

  const loadThread = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/support/thread");
      const payload = (await response.json()) as ThreadPayload;
      if (!response.ok) {
        throw new Error(payload.message || "Falha ao abrir suporte.");
      }
      applyThread(payload.thread ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar suporte.");
    } finally {
      setLoading(false);
    }
  }, [applyThread]);

  useEffect(() => {
    void loadThread();
  }, [loadThread]);

  useEffect(() => {
    const status = thread?.status;
    const shouldPoll =
      status === "ai" ||
      status === "waiting_human" ||
      status === "human" ||
      status === "closed" ||
      Boolean(thread);
    if (!shouldPoll && !thread) {
      return;
    }
    const id = window.setInterval(() => {
      void (async () => {
        try {
          const response = await fetch("/api/support/thread");
          const payload = (await response.json()) as ThreadPayload;
          if (!response.ok || sending) {
            return;
          }
          applyThread(payload.thread ?? null);
        } catch {
          /* ignore poll errors */
        }
      })();
    }, 4500);
    return () => window.clearInterval(id);
  }, [thread, thread?.status, applyThread, sending]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useLayoutEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.messages.length, optimistic.length, sending]);

  function resizeTextarea(el: HTMLTextAreaElement | null) {
    if (!el) {
      return;
    }
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  async function handleSend(event?: React.FormEvent) {
    event?.preventDefault();
    const body = draft.trim();
    if (!body || sending) {
      return;
    }
    const tempId = `local-${Date.now()}`;
    const optimisticUser: LocalMessage = {
      id: tempId,
      role: "user",
      body,
      authorLabel: "Você",
      createdAt: new Date().toISOString(),
      pending: true,
    };
    setOptimistic((current) => [...current, optimisticUser]);
    setSending(true);
    setError(null);
    setDraft("");
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
    try {
      const response = await fetch("/api/support/thread/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const payload = (await response.json()) as ThreadPayload;
      if (!response.ok) {
        throw new Error(payload.message || "Falha ao enviar mensagem.");
      }
      applyThread(payload.thread ?? null);
    } catch (err) {
      setOptimistic((current) => current.filter((m) => m.id !== tempId));
      setDraft(body);
      setError(err instanceof Error ? err.message : "Erro ao enviar.");
    } finally {
      setSending(false);
    }
  }

  async function handleEscalate() {
    if (escalating) {
      return;
    }
    setEscalating(true);
    setError(null);
    try {
      const response = await fetch("/api/support/thread/escalate", {
        method: "POST",
      });
      const payload = (await response.json()) as ThreadPayload;
      if (!response.ok) {
        throw new Error(payload.message || "Falha ao encaminhar.");
      }
      applyThread(payload.thread ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao encaminhar.");
    } finally {
      setEscalating(false);
    }
  }

  const serverMessages = thread?.messages ?? [];
  const messages: LocalMessage[] = [...serverMessages, ...optimistic];
  const hasAssistant = messages.some((m) => m.role === "assistant");
  const escalated =
    thread?.status === "waiting_human" || thread?.status === "human";
  const closed = thread?.status === "closed";
  const banner = thread ? statusBanner(thread.status) : null;
  const header = statusHeader(thread?.status);
  const showWelcome = !loading && messages.length === 0 && !sending;

  return (
    <div
      className="fixed bottom-6 right-6 z-40 flex h-[min(520px,calc(100vh-6rem))] w-[min(360px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-md-border bg-md-surface text-md-text shadow-[0_16px_40px_rgba(0,0,0,0.55)]"
      role="dialog"
      aria-label="Suporte Mandato Digital"
    >
      <div className="flex items-center justify-between border-b border-md-border bg-md-surface/80 px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-[13px] font-bold leading-none text-md-text">
            Suporte
          </p>
          <p className={`mt-1.5 text-[11px] font-medium ${header.className}`}>
            <span
              className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${
                closed ? "bg-slate-500" : "bg-current"
              }`}
              aria-hidden="true"
            />
            {header.label}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-md-border bg-md-surface-inset text-md-text-soft transition hover:border-md-border-hover hover:text-md-text"
          aria-label="Fechar suporte"
        >
          <CloseIcon />
        </button>
      </div>

      {banner ? (
        <div className="border-b border-[var(--distribuidor-border)] bg-[var(--distribuidor-soft)] px-3 py-2 text-[12px] text-[var(--distribuidor-text)]">
          {banner}
        </div>
      ) : null}

      <div className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        {loading && !thread && messages.length === 0 ? (
          <p className="text-center text-[12px] text-md-text-soft">Carregando…</p>
        ) : null}

        {showWelcome ? (
          <div className={`${bubbleClass("assistant")} px-3 py-2 text-[13px] leading-relaxed`}>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-md-text-soft">
              Suporte
            </p>
            <p className="whitespace-pre-wrap">{WELCOME_BODY}</p>
          </div>
        ) : null}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`px-3 py-2 text-[13px] leading-relaxed ${bubbleClass(message.role)} ${
              message.pending ? "opacity-80" : ""
            }`}
          >
            {message.role !== "system" && message.role !== "user" ? (
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-md-text-soft">
                Suporte
              </p>
            ) : null}
            <p className="whitespace-pre-wrap">{message.body}</p>
          </div>
        ))}

        {sending ? (
          <div className={`${bubbleClass("assistant")} px-3 py-2.5 text-[13px]`}>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-md-text-soft">
              Suporte
            </p>
            <TypingDots />
          </div>
        ) : null}

        <div ref={bottomRef} />
      </div>

      {error ? (
        <p className="border-t border-[var(--auditor-border)] bg-[var(--auditor-soft)] px-3 py-2 text-[12px] text-[var(--auditor-text)]">
          {error}
        </p>
      ) : null}

      {!closed && hasAssistant && !escalated ? (
        <div className="border-t border-md-border px-3 py-1.5">
          <button
            type="button"
            onClick={() => void handleEscalate()}
            disabled={escalating || sending}
            className="text-[11px] text-md-text-soft underline-offset-2 transition hover:text-[var(--distribuidor-text)] hover:underline disabled:opacity-50"
          >
            {escalating
              ? "Encaminhando…"
              : "Não consegui resolver — falar com um humano"}
          </button>
        </div>
      ) : null}

      {!closed ? (
        <form
          onSubmit={(event) => void handleSend(event)}
          className="border-t border-md-border p-2.5"
        >
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={draft}
              rows={1}
              onChange={(event) => {
                setDraft(event.target.value);
                resizeTextarea(event.target);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void handleSend();
                }
              }}
              placeholder="Digite sua dúvida…"
              disabled={sending}
              className="max-h-[120px] min-h-[40px] min-w-0 flex-1 resize-none rounded-xl border border-md-border bg-md-bg/80 px-3 py-2.5 text-[13px] text-md-text outline-none placeholder:text-md-text-soft focus:border-cyan-500/50"
              maxLength={4000}
              aria-label="Mensagem de suporte"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              className="shrink-0 rounded-xl bg-cyan-600 px-3 py-2.5 text-[13px] font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-50"
            >
              {sending ? "…" : "Enviar"}
            </button>
          </div>
          <p className="mt-1.5 px-0.5 text-[10px] text-md-text-soft">
            Enter envia · Shift+Enter nova linha
          </p>
        </form>
      ) : (
        <div className="border-t border-md-border p-3">
          <button
            type="button"
            onClick={() => {
              if (thread?.status === "closed") {
                dismissedClosedIdRef.current = thread.id;
              }
              setThread(null);
              setOptimistic([]);
              setError(null);
            }}
            className="w-full rounded-xl bg-cyan-600 px-3 py-2 text-[13px] font-semibold text-white hover:bg-cyan-500"
          >
            Abrir novo atendimento
          </button>
        </div>
      )}
    </div>
  );
}
