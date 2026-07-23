"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useOnboarding } from "./onboarding-provider";
import type {
  SupportMessage,
  SupportThreadStatus,
  SupportThreadWithMessages,
} from "@/lib/support/types";

type ThreadPayload = { thread?: SupportThreadWithMessages; message?: string };

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

function ChatIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
    </svg>
  );
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
    return "ml-8 bg-cyan-600/25 text-cyan-50 border border-cyan-500/30";
  }
  if (role === "system") {
    return "mx-2 bg-slate-800/80 text-slate-400 border border-slate-700 text-center text-[12px]";
  }
  // assistant e human: mesma aparência (usuário não distingue quem respondeu)
  return "mr-8 bg-slate-800/90 text-slate-200 border border-slate-700";
}

function displayAuthorLabel(role: SupportMessage["role"], label: string) {
  if (role === "user" || role === "system") {
    return label;
  }
  return "Suporte";
}

export function SupportWidget() {
  const { mounted, isActive, showWelcome } = useOnboarding();
  const onboardingFabVisible = mounted && isActive && !showWelcome;

  const [open, setOpen] = useState(false);
  const [thread, setThread] = useState<SupportThreadWithMessages | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const dismissedClosedIdRef = useRef<string | null>(null);

  const applyThread = useCallback((next: SupportThreadWithMessages | null) => {
    if (
      next?.status === "closed" &&
      next.id === dismissedClosedIdRef.current
    ) {
      setThread(null);
      return;
    }
    if (next && next.status !== "closed") {
      dismissedClosedIdRef.current = null;
    }
    setThread(next);
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
    if (!open) {
      return;
    }
    void loadThread();
  }, [open, loadThread]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const shouldPoll =
      thread?.status === "waiting_human" ||
      thread?.status === "human" ||
      thread?.status === "closed";
    if (!shouldPoll) {
      return;
    }
    const id = window.setInterval(() => {
      void (async () => {
        try {
          const response = await fetch("/api/support/thread");
          const payload = (await response.json()) as ThreadPayload;
          if (!response.ok) {
            return;
          }
          applyThread(payload.thread ?? null);
        } catch {
          /* ignore poll errors */
        }
      })();
    }, 4500);
    return () => window.clearInterval(id);
  }, [open, thread?.status, applyThread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.messages.length, open]);

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending) {
      return;
    }
    setSending(true);
    setError(null);
    setDraft("");
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

  const messages = thread?.messages ?? [];
  const hasAssistant = messages.some((m) => m.role === "assistant");
  const escalated =
    thread?.status === "waiting_human" || thread?.status === "human";
  const closed = thread?.status === "closed";
  const banner = thread ? statusBanner(thread.status) : null;
  const positionClass = onboardingFabVisible
    ? "bottom-20 right-5"
    : "bottom-5 right-5";

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`fixed ${positionClass} z-40 flex items-center gap-2 rounded-xl border border-slate-600/60 bg-slate-900/95 px-3.5 py-2.5 text-[13px] font-semibold text-white shadow-[0_8px_28px_rgba(0,0,0,0.45)] transition hover:border-cyan-500/40 hover:bg-slate-800`}
        aria-label="Abrir suporte"
      >
        <ChatIcon />
        Suporte
      </button>
    );
  }

  return (
    <div
      className={`fixed ${positionClass} z-40 flex h-[min(520px,calc(100vh-6rem))] w-[min(360px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-xl border border-slate-700 bg-[#0F1623] text-slate-200 shadow-[0_16px_40px_rgba(0,0,0,0.55)]`}
      role="dialog"
      aria-label="Suporte Mandato Digital"
    >
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-3 py-2.5">
        <div>
          <p className="text-[13px] font-bold leading-none text-white">
            Suporte
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Estamos aqui para ajudar
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-700 bg-slate-800/60 text-slate-400 transition hover:border-slate-600 hover:text-white"
          aria-label="Fechar suporte"
        >
          <CloseIcon />
        </button>
      </div>

      {banner ? (
        <div className="border-b border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-100">
          {banner}
        </div>
      ) : null}

      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {loading && !thread ? (
          <p className="text-center text-[12px] text-slate-500">Carregando…</p>
        ) : null}
        {!loading && messages.length === 0 ? (
          <p className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-[13px] text-slate-400">
            Olá! Como podemos ajudar com o Mandato Digital? Pode perguntar
            sobre monitoramento, avatares, criativos ou compliance.
          </p>
        ) : null}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`rounded-lg px-3 py-2 text-[13px] leading-relaxed ${bubbleClass(message.role)}`}
          >
            {message.role !== "system" && message.role !== "user" ? (
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {displayAuthorLabel(message.role, message.authorLabel)}
              </p>
            ) : null}
            <p className="whitespace-pre-wrap">{message.body}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {error ? (
        <p className="border-t border-rose-500/20 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-200">
          {error}
        </p>
      ) : null}

      {!closed && hasAssistant && !escalated ? (
        <div className="border-t border-slate-800 px-3 py-2">
          <button
            type="button"
            onClick={() => void handleEscalate()}
            disabled={escalating || sending}
            className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-2 py-1.5 text-[12px] text-slate-300 transition hover:border-amber-500/40 hover:text-amber-100 disabled:opacity-50"
          >
            {escalating
              ? "Encaminhando…"
              : "Não consegui resolver meu problema"}
          </button>
        </div>
      ) : null}

      {!closed ? (
        <form
          onSubmit={(event) => void handleSend(event)}
          className="border-t border-slate-800 p-2.5"
        >
          <div className="flex gap-2">
            <input
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Digite sua dúvida…"
              disabled={sending}
              className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-[13px] text-white outline-none placeholder:text-slate-600 focus:border-cyan-500/50"
              maxLength={4000}
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              className="shrink-0 rounded-lg bg-cyan-600 px-3 py-2 text-[13px] font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-50"
            >
              {sending ? "…" : "Enviar"}
            </button>
          </div>
        </form>
      ) : (
        <div className="border-t border-slate-800 p-3">
          <button
            type="button"
            onClick={() => {
              if (thread?.status === "closed") {
                dismissedClosedIdRef.current = thread.id;
              }
              setThread(null);
              setError(null);
            }}
            className="w-full rounded-lg bg-cyan-600 px-3 py-2 text-[13px] font-semibold text-white hover:bg-cyan-500"
          >
            Abrir novo atendimento
          </button>
        </div>
      )}
    </div>
  );
}
