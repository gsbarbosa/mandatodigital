"use client";

import { useCallback, useEffect, useState } from "react";

import type { SegmentWithCount } from "@/components/admin/marketing/segments-tab";
import {
  CAMPAIGN_CHANNEL_LABELS,
  CAMPAIGN_CHANNELS,
  CAMPAIGN_STATUS_LABELS,
  type CampaignChannel,
  type MarketingCampaign,
  type MarketingSend,
} from "@/lib/outbound/types";

type CampaignDetail = {
  campaign: MarketingCampaign;
  sends: MarketingSend[];
  audience: { total: number; skippedAlreadySent: number; sample: Array<{ name: string; destination: string }> } | null;
};

const STATUS_CLASS: Record<string, string> = {
  rascunho: "bg-md-overlay-hover text-md-text-soft",
  enviando: "bg-amber-500/15 text-amber-200",
  enviada: "bg-emerald-500/15 text-emerald-300",
  erro: "bg-rose-500/15 text-rose-300",
};

function formatDate(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value.slice(0, 10)
    : date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function CampaignsTab({ segments }: { segments: SegmentWithCount[] }) {
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [channel, setChannel] = useState<CampaignChannel>("email");
  const [segmentId, setSegmentId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateLanguage, setTemplateLanguage] = useState("pt_BR");
  const [templateParams, setTemplateParams] = useState("");

  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/admin/marketing/campaigns");
        const payload = (await response.json()) as {
          campaigns?: MarketingCampaign[];
          message?: string;
        };
        if (!response.ok) {
          throw new Error(payload.message || "Falha ao carregar campanhas.");
        }
        if (!cancelled) {
          setCampaigns(payload.campaigns ?? []);
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

  const load = useCallback(async () => {
    setReloadToken((token) => token + 1);
  }, []);

  async function openDetail(id: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/marketing/campaigns/${id}`);
      const payload = (await response.json()) as CampaignDetail & { message?: string };
      if (!response.ok) {
        throw new Error(payload.message || "Falha ao abrir campanha.");
      }
      setDetail(payload);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate() {
    if (name.trim().length < 2 || !segmentId) {
      setError("Informe nome e segmento.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/admin/marketing/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          channel,
          segmentId,
          subject,
          body,
          templateName,
          templateLanguage,
          templateParams: templateParams
            .split("|")
            .map((item) => item.trim())
            .filter(Boolean),
        }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message || "Falha ao criar campanha.");
      }
      setName("");
      setSubject("");
      setBody("");
      setTemplateName("");
      setTemplateParams("");
      setError(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSend(campaign: MarketingCampaign) {
    const confirmed = window.confirm(
      `Disparar "${campaign.name}" agora? Isso envia mensagem real para o público do segmento.`,
    );
    if (!confirmed) {
      return;
    }

    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/marketing/campaigns/${campaign.id}/send`, {
        method: "POST",
      });
      const payload = (await response.json()) as {
        message?: string;
        stats?: { sent: number; failed: number };
      };
      if (!response.ok) {
        throw new Error(payload.message || "Falha no disparo.");
      }
      setNotice(
        `Disparo concluído: ${payload.stats?.sent ?? 0} enviados, ${payload.stats?.failed ?? 0} falhas.`,
      );
      setError(null);
      await load();
      await openDetail(campaign.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/marketing/campaigns/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        throw new Error(payload.message || "Falha ao remover campanha.");
      }
      if (detail?.campaign.id === id) {
        setDetail(null);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {notice}
        </p>
      ) : null}

      <div className="rounded-2xl border border-md-border bg-md-surface/50 p-4">
        <h3 className="mb-4 text-sm font-semibold text-md-text">Nova campanha</h3>

        <div className="mb-3 grid gap-3 sm:grid-cols-3">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nome da campanha"
            className="rounded-xl border border-md-border bg-md-surface px-3 py-2 text-sm text-md-text placeholder:text-md-text-soft"
          />
          <select
            value={channel}
            onChange={(event) => setChannel(event.target.value as CampaignChannel)}
            className="rounded-xl border border-md-border bg-md-surface px-3 py-2 text-sm text-md-text"
          >
            {CAMPAIGN_CHANNELS.map((item) => (
              <option key={item} value={item}>
                {CAMPAIGN_CHANNEL_LABELS[item]}
              </option>
            ))}
          </select>
          <select
            value={segmentId}
            onChange={(event) => setSegmentId(event.target.value)}
            className="rounded-xl border border-md-border bg-md-surface px-3 py-2 text-sm text-md-text"
          >
            <option value="">Selecione o segmento…</option>
            {segments.map((segment) => (
              <option key={segment.id} value={segment.id}>
                {segment.name} ({segment.matched})
              </option>
            ))}
          </select>
        </div>

        {channel === "email" ? (
          <div className="space-y-3">
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Assunto"
              className="w-full rounded-xl border border-md-border bg-md-surface px-3 py-2 text-sm text-md-text placeholder:text-md-text-soft"
            />
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={6}
              placeholder={"Corpo do e-mail.\n\nVariáveis: {{nome}}, {{nome_completo}}, {{uf}}, {{partido}}, {{cargo}}, {{municipio}}"}
              className="w-full rounded-xl border border-md-border bg-md-surface px-3 py-2 text-sm text-md-text placeholder:text-md-text-soft"
            />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
                placeholder="Template aprovado (ex.: md_intro_vaga_sigla_v1)"
                className="rounded-xl border border-md-border bg-md-surface px-3 py-2 text-sm text-md-text placeholder:text-md-text-soft"
              />
              <input
                value={templateLanguage}
                onChange={(event) => setTemplateLanguage(event.target.value)}
                placeholder="Idioma do template (pt_BR)"
                className="rounded-xl border border-md-border bg-md-surface px-3 py-2 text-sm text-md-text placeholder:text-md-text-soft"
              />
            </div>
            <input
              value={templateParams}
              onChange={(event) => setTemplateParams(event.target.value)}
              placeholder="Parâmetros na ordem, separados por | — ex.: {{nome}} | {{uf}}"
              className="w-full rounded-xl border border-md-border bg-md-surface px-3 py-2 text-sm text-md-text placeholder:text-md-text-soft"
            />
            <p className="text-xs text-md-text-soft">
              O primeiro parâmetro preenche <code>{"{{1}}"}</code> do template, o segundo{" "}
              <code>{"{{2}}"}</code>, e assim por diante. Variáveis disponíveis:{" "}
              <code>{"{{nome}}"}</code>, <code>{"{{uf}}"}</code>, <code>{"{{partido}}"}</code>,{" "}
              <code>{"{{cargo}}"}</code>, <code>{"{{municipio}}"}</code>.
            </p>
          </div>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={() => void handleCreate()}
          className="mt-4 rounded-xl bg-cyan-500/20 px-4 py-2 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/30 disabled:opacity-50"
        >
          Criar campanha
        </button>
      </div>

      <div className="space-y-3">
        {campaigns.length === 0 ? (
          <p className="rounded-2xl border border-md-border px-4 py-8 text-center text-sm text-md-text-soft">
            Nenhuma campanha criada ainda.
          </p>
        ) : null}

        {campaigns.map((campaign) => {
          const segment = segments.find((item) => item.id === campaign.segmentId);
          const isOpen = detail?.campaign.id === campaign.id;

          return (
            <div key={campaign.id} className="rounded-2xl border border-md-border bg-md-surface">
              <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-md-text">{campaign.name}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        STATUS_CLASS[campaign.status] ?? ""
                      }`}
                    >
                      {CAMPAIGN_STATUS_LABELS[campaign.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-md-text-soft">
                    {CAMPAIGN_CHANNEL_LABELS[campaign.channel]} ·{" "}
                    {segment ? segment.name : "segmento removido"} · criada em{" "}
                    {formatDate(campaign.createdAt)}
                  </p>
                  {campaign.stats.total > 0 ? (
                    <p className="mt-1 text-xs text-md-text-soft">
                      {campaign.stats.sent} enviados · {campaign.stats.failed} falhas
                    </p>
                  ) : null}
                  {campaign.lastError ? (
                    <p className="mt-1 text-xs text-rose-300">{campaign.lastError}</p>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => (isOpen ? setDetail(null) : void openDetail(campaign.id))}
                    className="text-xs text-md-text-soft underline-offset-2 hover:text-md-text hover:underline disabled:opacity-50"
                  >
                    {isOpen ? "Fechar" : "Detalhes"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleSend(campaign)}
                    className="rounded-xl bg-cyan-500/20 px-3 py-1.5 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-500/30 disabled:opacity-40"
                  >
                    Disparar
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleDelete(campaign.id)}
                    className="text-xs text-rose-300 underline-offset-2 hover:underline disabled:opacity-50"
                  >
                    Remover
                  </button>
                </div>
              </div>

              {isOpen && detail ? (
                <div className="border-t border-md-border px-4 py-4">
                  {detail.audience ? (
                    <div className="mb-4 rounded-xl bg-md-overlay-hover px-3 py-2 text-xs text-md-text-muted">
                      <p>
                        Público atual: <strong className="text-md-text">{detail.audience.total}</strong>{" "}
                        contatos
                        {detail.audience.skippedAlreadySent > 0
                          ? ` (${detail.audience.skippedAlreadySent} já receberam e serão pulados)`
                          : ""}
                      </p>
                      {detail.audience.sample.length > 0 ? (
                        <p className="mt-1 text-md-text-soft">
                          Ex.: {detail.audience.sample.map((item) => item.destination).join(", ")}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mb-4 text-xs text-amber-200">
                      Não foi possível resolver o público (segmento removido?).
                    </p>
                  )}

                  {detail.campaign.subject ? (
                    <p className="mb-2 text-sm text-md-text">
                      <span className="text-md-text-soft">Assunto:</span> {detail.campaign.subject}
                    </p>
                  ) : null}
                  {detail.campaign.body ? (
                    <pre className="mb-4 whitespace-pre-wrap rounded-xl bg-md-overlay-hover px-3 py-2 text-xs text-md-text-muted">
                      {detail.campaign.body}
                    </pre>
                  ) : null}

                  {detail.sends.length > 0 ? (
                    <div className="overflow-x-auto rounded-xl border border-md-border">
                      <table className="min-w-full text-left text-xs">
                        <thead className="bg-md-surface/80 uppercase tracking-wider text-md-text-soft">
                          <tr>
                            <th className="px-3 py-2 font-semibold">Contato</th>
                            <th className="px-3 py-2 font-semibold">Destino</th>
                            <th className="px-3 py-2 font-semibold">Status</th>
                            <th className="px-3 py-2 font-semibold">Quando</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.sends.map((send) => (
                            <tr key={send.id} className="border-t border-md-border text-md-text-muted">
                              <td className="px-3 py-2">{send.contactName}</td>
                              <td className="px-3 py-2">{send.destination}</td>
                              <td className="px-3 py-2">
                                <span
                                  className={
                                    send.status === "enviado" ? "text-emerald-300" : "text-rose-300"
                                  }
                                >
                                  {send.status}
                                </span>
                                {send.error ? (
                                  <span className="ml-2 text-md-text-soft">{send.error}</span>
                                ) : null}
                              </td>
                              <td className="px-3 py-2">{formatDate(send.createdAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-md-text-soft">Nenhum envio registrado ainda.</p>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
