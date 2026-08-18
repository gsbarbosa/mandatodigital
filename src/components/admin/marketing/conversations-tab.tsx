"use client";

import { useEffect, useState } from "react";

import { isWithinServiceWindow, type MarketingConversation } from "@/lib/outbound/types";

type Payload = {
  conversations: MarketingConversation[];
  whatsappReady: boolean;
  webhookConfigured: boolean;
  message?: string;
};

function formatTime(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function formatCountdown(autoSendAt: string, nowMs: number) {
  const remaining = Date.parse(autoSendAt) - nowMs;
  if (!Number.isFinite(remaining) || remaining <= 0) {
    return "enviando…";
  }
  const totalSeconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function messageLabel(role: MarketingConversation["messages"][number]["role"]) {
  if (role === "lead") return "Lead";
  if (role === "humano") return "Você";
  return "Marina (IA)";
}

export function ConversationsTab() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const conversations = data?.conversations ?? [];
  const hasPendingSuggestion = conversations.some((item) => item.suggestedReply.trim());

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/admin/marketing/conversations");
        const payload = (await response.json()) as Payload;
        if (!response.ok) {
          throw new Error(payload.message || "Falha ao carregar conversas.");
        }
        if (!cancelled) {
          setData(payload);
          setError(null);
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
  }, [reloadToken]);

  useEffect(() => {
    if (!hasPendingSuggestion) {
      return;
    }
    const tick = window.setInterval(() => setNowMs(Date.now()), 1000);
    const refresh = window.setInterval(() => setReloadToken((token) => token + 1), 15_000);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(refresh);
    };
  }, [hasPendingSuggestion]);

  async function togglePause(conversation: MarketingConversation) {
    try {
      const response = await fetch(
        `/api/admin/marketing/conversations/${encodeURIComponent(conversation.id)}/pause`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paused: !conversation.agentPaused }),
        },
      );
      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        throw new Error(payload.message || "Falha ao alterar o agente.");
      }
      if (!conversation.agentPaused) {
        if (openId !== conversation.id) {
          setDraft(conversation.suggestedReply);
        }
        setOpenId(conversation.id);
      }
      setReloadToken((token) => token + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro.");
    }
  }

  async function sendReply(conversation: MarketingConversation, text = draft) {
    const body = text.trim();
    if (!body || sendingId) {
      return;
    }

    setSendingId(conversation.id);
    try {
      const response = await fetch(
        `/api/admin/marketing/conversations/${encodeURIComponent(conversation.id)}/reply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: body }),
        },
      );
      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        throw new Error(payload.message || "Falha ao enviar.");
      }
      setDraft("");
      setReloadToken((token) => token + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro.");
    } finally {
      setSendingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      {data && !(data.whatsappReady && data.webhookConfigured) ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {!data.whatsappReady
            ? "WhatsApp sem credenciais (WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN) — não dá para enviar nem responder."
            : "Webhook incompleto (WHATSAPP_VERIFY_TOKEN / WHATSAPP_APP_SECRET) — as respostas dos leads não vão chegar."}
        </p>
      ) : null}

      <div className="flex items-center justify-between">
        <p className="text-sm text-md-text-soft">
          {conversations.length} {conversations.length === 1 ? "conversa" : "conversas"}
        </p>
        <button
          type="button"
          onClick={() => setReloadToken((token) => token + 1)}
          className="text-xs text-md-text-soft underline-offset-2 hover:text-md-text hover:underline"
        >
          Atualizar
        </button>
      </div>

      {conversations.length === 0 ? (
        <p className="rounded-2xl border border-md-border px-4 py-8 text-center text-sm text-md-text-soft">
          Nenhuma conversa ainda. Elas aparecem aqui quando um lead responde ao disparo.
        </p>
      ) : null}

      <div className="space-y-3">
        {conversations.map((conversation) => {
          const open = openId === conversation.id;
          const janelaAberta = isWithinServiceWindow(conversation.lastInboundAt);
          const suggestion = conversation.suggestedReply.trim();

          return (
            <div key={conversation.id} className="rounded-2xl border border-md-border bg-md-surface">
              <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-md-text">
                      {conversation.contactName || conversation.phoneE164}
                    </p>
                    <span className="text-xs text-md-text-soft">{conversation.phoneE164}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        janelaAberta
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-md-overlay-hover text-md-text-soft"
                      }`}
                    >
                      {janelaAberta ? "janela 24h aberta" : "janela fechada"}
                    </span>
                    {conversation.agentPaused ? (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                        IA só sugere
                      </span>
                    ) : null}
                    {suggestion ? (
                      <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] font-semibold text-cyan-200">
                        {conversation.agentPaused || !conversation.autoSendAt
                          ? "sugestão pendente"
                          : `IA envia em ${formatCountdown(conversation.autoSendAt, nowMs)}`}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-md-text-soft">
                    {conversation.messages.length} mensagens · última resposta do lead em{" "}
                    {formatTime(conversation.lastInboundAt)}
                  </p>
                  {conversation.lastError ? (
                    <p className="mt-1 text-xs text-rose-300">{conversation.lastError}</p>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const nextOpen = open ? null : conversation.id;
                      setOpenId(nextOpen);
                      setDraft(nextOpen ? conversation.suggestedReply : "");
                    }}
                    className="text-xs text-md-text-soft underline-offset-2 hover:text-md-text hover:underline"
                  >
                    {open ? "Fechar" : "Ver conversa"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void togglePause(conversation)}
                    className="rounded-xl bg-md-overlay-hover px-3 py-1.5 text-xs font-semibold text-md-text-muted transition hover:text-md-text"
                  >
                    {conversation.agentPaused ? "Religar IA" : "Assumir (IA só sugere)"}
                  </button>
                </div>
              </div>

              {open ? (
                <div className="space-y-3 border-t border-md-border px-4 py-4">
                  <div className="space-y-2">
                    {conversation.messages.map((message, index) => (
                      <div
                        key={`${message.providerMessageId}-${index}`}
                        className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                          message.role === "lead"
                            ? "bg-md-overlay-hover text-md-text-muted"
                            : message.role === "humano"
                              ? "ml-auto bg-amber-500/15 text-amber-100"
                              : "ml-auto bg-cyan-500/15 text-cyan-100"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{message.text || "(sem texto — mídia)"}</p>
                        <p className="mt-1 text-[10px] text-md-text-soft">
                          {messageLabel(message.role)} · {formatTime(message.at)}
                        </p>
                      </div>
                    ))}
                  </div>

                  {suggestion ? (
                    <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-200">
                          Sugestão da Marina
                        </p>
                        <p className="text-[11px] text-cyan-100/80">
                          {conversation.agentPaused || !conversation.autoSendAt
                            ? "IA assumida — não envia sozinha."
                            : `Envia sozinha em ${formatCountdown(conversation.autoSendAt, nowMs)} se ninguém mandar.`}
                        </p>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-md-text">{suggestion}</p>
                      <button
                        type="button"
                        disabled={!janelaAberta || sendingId === conversation.id}
                        onClick={() => void sendReply(conversation, suggestion)}
                        className="mt-3 rounded-xl bg-cyan-500/20 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/30 disabled:opacity-40"
                      >
                        {sendingId === conversation.id ? "Enviando…" : "Enviar esta sugestão"}
                      </button>
                    </div>
                  ) : null}

                  <form
                    className="space-y-2 pt-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void sendReply(conversation);
                    }}
                  >
                    <textarea
                      value={openId === conversation.id ? draft : ""}
                      onChange={(event) => setDraft(event.target.value)}
                      rows={3}
                      maxLength={4000}
                      disabled={!janelaAberta || sendingId === conversation.id}
                      placeholder={
                        janelaAberta
                          ? suggestion
                            ? "Edite a sugestão ou escreva a sua. Enviar cancela o disparo automático."
                            : "Escreva e envie pelo WhatsApp."
                          : "Janela de 24h fechada — só um template de campanha reabre a conversa."
                      }
                      className="w-full rounded-xl border border-md-border bg-md-surface px-3 py-2 text-sm text-md-text placeholder:text-md-text-soft disabled:opacity-60"
                    />
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[11px] text-md-text-soft">
                        Sai pela Cloud API. Vale só enquanto a janela de 24h estiver aberta.
                      </p>
                      <button
                        type="submit"
                        disabled={
                          !janelaAberta || sendingId === conversation.id || !draft.trim()
                        }
                        className="rounded-xl bg-cyan-500/20 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/30 disabled:opacity-40"
                      >
                        {sendingId === conversation.id ? "Enviando…" : "Enviar"}
                      </button>
                    </div>
                  </form>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
