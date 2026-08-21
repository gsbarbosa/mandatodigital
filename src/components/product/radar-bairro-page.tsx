"use client";

import { useCallback, useEffect, useState } from "react";

import { MonitorSignalCard, SignalEvidenceDrawer } from "@/components/product/monitor-signal-card";
import { ProductPageHeader } from "@/components/product/product-page-header";
import { RefreshPautasButton } from "@/components/product/refresh-pautas-button";
import { toRadarBairroSuggestion } from "@/lib/radar-bairro-suggestion";
import type { MockSentinelSuggestion } from "@/lib/sentinel-mock-suggestions";
import type { RadarBairroLocality, RadarBairroSignal } from "@/lib/radar-bairro-types";

type RadarMeta = {
  generatedAt: string;
  city: string;
  uf: string;
  localities: string[];
  emptyLocalities: string[];
  postsCollected: number;
  postsKept: number;
} | null;

type RadarPayload = {
  enabled?: boolean;
  message?: string;
  signals?: RadarBairroSignal[];
  meta?: RadarMeta;
  localities?: RadarBairroLocality[];
  registry?: { city: string; uf: string; mode: "cidade" | "bairro"; updatedAt: string | null };
  quota?: { used: number; max: number };
  needsCuration?: boolean;
};

const STATUS_LABELS: Record<RadarBairroLocality["status"], string> = {
  ativo: "Monitorando",
  "sem-grupo": "Sem grupo encontrado",
  reprovado: "Grupo pouco ativo",
};

const STATUS_CLASSES: Record<RadarBairroLocality["status"], string> = {
  ativo: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  "sem-grupo": "bg-md-surface text-md-text-soft border-md-border",
  reprovado: "bg-amber-500/10 text-amber-600 border-amber-500/30",
};

export function RadarBairroPage() {
  const [signals, setSignals] = useState<RadarBairroSignal[]>([]);
  const [meta, setMeta] = useState<RadarMeta>(null);
  const [localities, setLocalities] = useState<RadarBairroLocality[]>([]);
  const [quota, setQuota] = useState<{ used: number; max: number }>({ used: 0, max: 0 });
  const [enabled, setEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState<null | "refresh" | "curadoria" | "add">(null);
  const [message, setMessage] = useState<string | null>(null);
  const [newLocality, setNewLocality] = useState("");
  const [evidence, setEvidence] = useState<MockSentinelSuggestion | null>(null);

  const applyPayload = useCallback((payload: RadarPayload) => {
    if (payload.signals) {
      setSignals(payload.signals);
    }
    if (payload.meta !== undefined) {
      setMeta(payload.meta);
    }
    if (payload.localities) {
      setLocalities(payload.localities);
    }
    if (payload.quota) {
      setQuota((current) => ({ ...current, ...payload.quota }));
    }
  }, []);

  // Não liga o loading aqui: o estado já nasce true. Ligar de forma síncrona
  // dentro do efeito dispara render em cascata (react-hooks/set-state-in-effect).
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/radar-bairro", { cache: "no-store" });
      const payload = (await response.json()) as RadarPayload;
      if (payload.enabled === false) {
        setEnabled(false);
        return;
      }
      applyPayload(payload);
      setMessage(payload.message ?? null);
    } catch {
      setMessage("Não foi possível carregar o Radar de Bairro agora.");
    } finally {
      setIsLoading(false);
    }
  }, [applyPayload]);

  useEffect(() => {
    void load();
  }, [load]);

  const post = useCallback(
    async (url: string, body?: unknown, method: "POST" | "DELETE" = "POST") => {
      const response = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const payload = (await response.json().catch(() => ({}))) as RadarPayload;
      setMessage(payload.message ?? null);
      applyPayload(payload);
      return { ok: response.ok, payload };
    },
    [applyPayload],
  );

  const handleRefresh = useCallback(async () => {
    setBusy("refresh");
    try {
      await post("/api/radar-bairro/refresh");
    } finally {
      setBusy(null);
    }
  }, [post]);

  const handleCuradoria = useCallback(async () => {
    setBusy("curadoria");
    try {
      await post("/api/radar-bairro/curadoria");
    } finally {
      setBusy(null);
    }
  }, [post]);

  const handleAdd = useCallback(async () => {
    const name = newLocality.trim();
    if (!name) {
      return;
    }
    setBusy("add");
    try {
      const { ok } = await post("/api/radar-bairro/localidades", { name });
      if (ok) {
        setNewLocality("");
      }
    } finally {
      setBusy(null);
    }
  }, [newLocality, post]);

  const handleRemove = useCallback(
    async (name: string) => {
      await post("/api/radar-bairro/localidades", { name }, "DELETE");
    },
    [post],
  );

  if (!enabled) {
    return (
      <div className="relative z-10 mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <ProductPageHeader
          title="Radar de Bairro"
          description="Monitoramento de grupos de bairro no Facebook."
        />
        <div className="rounded-xl border border-md-border bg-md-surface px-5 py-6 shadow-sm">
          <p className="m-0 text-sm text-md-text-muted">
            O Radar de Bairro ainda não está liberado nesta conta.
          </p>
        </div>
      </div>
    );
  }

  const generatedDate = meta?.generatedAt ? new Date(meta.generatedAt) : null;
  const canAdd = quota.max > 0 && quota.used < quota.max;

  return (
    <div
      className="relative z-10 mx-auto max-w-5xl px-4 py-6 pb-20 sm:px-6 sm:py-8 lg:px-8"
      data-testid="radar-bairro-page"
    >
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-64 bg-emerald-500/5 blur-[120px] pointer-events-none rounded-full" />

      <ProductPageHeader
        title="Radar de Bairro"
        description="O que os moradores estão falando nos grupos de bairro — obras, segurança, serviço público e mobilização local."
        actions={
          <div className="flex w-full shrink-0 flex-col gap-1 sm:w-[10.5rem] md:pt-1">
            <RefreshPautasButton
              variant="monitor"
              isLoading={busy === "refresh"}
              label="Atualizar radar"
              loadingLabel="Buscando nos grupos..."
              onClick={() => void handleRefresh()}
            />
            {generatedDate ? (
              <span className="text-center text-xs text-md-text-soft">
                Atualizado {generatedDate.toLocaleDateString("pt-BR")} às{" "}
                {generatedDate.toLocaleTimeString("pt-BR")}
              </span>
            ) : null}
          </div>
        }
      />

      {message ? (
        <div className="mb-8 rounded-xl border border-[var(--curador-border)] bg-[var(--curador-soft)] px-5 py-4 relative z-10">
          <p className="text-sm leading-relaxed text-md-text m-0">{message}</p>
        </div>
      ) : null}

      <section className="mb-10 rounded-xl border border-md-border bg-md-surface p-5 shadow-sm relative z-10">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-base font-semibold text-md-text m-0">Bairros monitorados</h2>
          <span className="text-xs text-md-text-soft">
            {quota.max ? `${quota.used} de ${quota.max} do seu plano` : "Disponível nos planos pagos"}
          </span>
        </div>

        {localities.length ? (
          <ul className="mb-4 flex flex-col gap-2 list-none p-0 m-0">
            {localities.map((locality) => (
              <li
                key={`${locality.name}-${locality.source}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-md-border px-3 py-2"
              >
                <span className="flex items-center gap-2 text-sm text-md-text">
                  {locality.name}
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[0.7rem] ${STATUS_CLASSES[locality.status]}`}
                  >
                    {STATUS_LABELS[locality.status]}
                  </span>
                  {locality.source === "automatico" ? (
                    <span className="text-[0.7rem] text-md-text-soft">automático</span>
                  ) : null}
                </span>
                {locality.source === "candidato" ? (
                  <button
                    type="button"
                    className="text-xs text-md-text-soft hover:underline underline-offset-2"
                    onClick={() => void handleRemove(locality.name)}
                  >
                    Remover
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-4 text-sm text-md-text-muted">
            Nenhum bairro ainda. Rode a busca automática da sua cidade para começar.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={newLocality}
            onChange={(event) => setNewLocality(event.target.value)}
            placeholder="Adicionar um bairro"
            disabled={!canAdd || busy !== null}
            className="min-w-[12rem] flex-1 rounded-lg border border-md-border bg-md-bg px-3 py-2 text-sm text-md-text disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => void handleAdd()}
            disabled={!canAdd || busy !== null || !newLocality.trim()}
            className="rounded-lg border border-md-border px-3 py-2 text-sm font-medium text-md-text disabled:opacity-50"
          >
            {busy === "add" ? "Procurando grupo..." : "Adicionar"}
          </button>
          <button
            type="button"
            onClick={() => void handleCuradoria()}
            disabled={busy !== null}
            className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--curador-text)] hover:underline underline-offset-2 disabled:opacity-50"
          >
            {busy === "curadoria" ? "Buscando na sua cidade..." : "Buscar automaticamente"}
          </button>
        </div>
      </section>

      {isLoading || busy === "refresh" ? (
        <div
          className="mb-8 flex items-center justify-center gap-3 rounded-xl border border-md-border bg-md-surface px-5 py-6 text-center shadow-sm relative z-10"
          role="status"
        >
          <span
            className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-md-border border-t-[var(--sentinela)]"
            aria-hidden="true"
          />
          <p className="text-sm leading-relaxed text-md-text-muted m-0">
            {busy === "refresh" ? "Lendo os grupos de bairro…" : "Carregando radar…"}
          </p>
        </div>
      ) : null}

      <div className="space-y-4 relative z-10">
        {!isLoading && signals.length
          ? signals.map((signal) => {
              const suggestion = toRadarBairroSuggestion(signal);
              return (
                <MonitorSignalCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  onOpenEvidence={(item) => setEvidence(item)}
                  themeCaption={signal.localityName}
                  noDateFallbackToToday
                />
              );
            })
          : null}

        {!isLoading && busy === null && !signals.length ? (
          <div className="rounded-xl border border-md-border bg-md-surface px-5 py-6 shadow-sm">
            <p className="text-sm text-md-text-muted m-0">
              Nenhum sinal ainda. Adicione bairros e clique em “Atualizar radar”.
            </p>
          </div>
        ) : null}
      </div>

      {meta?.emptyLocalities?.length ? (
        <p className="mt-6 text-xs text-md-text-soft relative z-10">
          Sem novidades relevantes em: {meta.emptyLocalities.join(", ")}.
        </p>
      ) : null}

      <SignalEvidenceDrawer suggestion={evidence} onClose={() => setEvidence(null)} />
    </div>
  );
}
