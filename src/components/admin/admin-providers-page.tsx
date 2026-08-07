"use client";

import { useCallback, useEffect, useState } from "react";

import type { AdminProvider } from "@/lib/admin/providers";
import {
  EDITABLE_PROVIDER_IDS,
  type EditableProviderId,
  type ProviderAccountStatus,
  type ProviderKeyPublic,
  type ProviderUsageSnapshot,
  PROVIDER_ENV_KEYS,
  PROVIDER_MAX_KEYS,
  isPoolProviderId,
} from "@/lib/admin/provider-catalog";
import {
  HeyGenProviderInsights,
  heygenStatusBadge,
  readHeyGenWalletHealth,
} from "@/components/admin/heygen-provider-insights";

const STATUS_STYLE: Record<string, string> = {
  configured: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  missing: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  optional: "bg-amber-500/15 text-amber-200 border-amber-500/30",
};

const STATUS_LABEL: Record<string, string> = {
  configured: "Configurado",
  missing: "Faltando",
  optional: "Opcional / off",
};

const EDITABLE_META: Record<
  EditableProviderId,
  { name: string; description: string; docsUrl: string; placeholder: string }
> = {
  apify: {
    name: "Apify",
    description: "Scraping de Instagram. Pool de keys com failover automático se a cota acabar.",
    docsUrl: "https://console.apify.com/account#/integrations",
    placeholder: "apify_api_…",
  },
  openai: {
    name: "OpenAI",
    description:
      "LLM/embeddings/caricaturas. Pool com failover; gasto MTD exige OPENAI_ADMIN_KEY no env.",
    docsUrl: "https://platform.openai.com/api-keys",
    placeholder: "sk-…",
  },
  anthropic: {
    name: "Anthropic",
    description: "LLM alternativo / juiz de evals.",
    docsUrl: "https://console.anthropic.com/settings/keys",
    placeholder: "sk-ant-…",
  },
  heygen: {
    name: "HeyGen",
    description: "Avatares e vídeo. Pool de keys com failover se a wallet zerar.",
    docsUrl: "https://app.heygen.com/settings?nav=API",
    placeholder: "heygen api key…",
  },
  elevenlabs: {
    name: "ElevenLabs",
    description: "Clone IVC + TTS. Pool de keys com failover se caracteres acabarem.",
    docsUrl: "https://elevenlabs.io/app/settings/api-keys",
    placeholder: "xi-… ou key…",
  },
  resend: {
    name: "Resend",
    description: "E-mail de contrato e dossiê após aceite do CNPJ.",
    docsUrl: "https://resend.com/api-keys",
    placeholder: "re_…",
  },
};

function formatUsageValue(value: number, unit: string) {
  if (unit === "USD") {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    });
  }
  return `${value.toLocaleString("pt-BR")} ${unit}`;
}

const ACCOUNT_LABELS: Record<string, string> = {
  email: "Email",
  username: "User",
  name: "Nome",
  userId: "User id",
  org: "Org",
  orgId: "Org id",
  orgsCount: "Orgs",
  planId: "Plano id",
  planTier: "Plano",
  plan: "Plano / tipo",
  tier: "Plano",
  firstName: "Nome",
  billingType: "Billing",
  autoReload: "Auto-reload",
  autoReloadThresholdUsd: "Reload threshold (USD)",
  autoReloadAmountUsd: "Reload amount (USD)",
  addOnCredits: "Add-on credits",
  walletCurrency: "Moeda wallet",
  walletRemainingUsd: "Saldo wallet (USD)",
  walletHealth: "Saúde wallet",
  estPhotoVideoSeconds: "Autonomia foto (s)",
  estTwinVideoSeconds: "Autonomia gêmeo (s)",
  subscriptionPlan: "Plano subscription",
  premiumCreditsRemaining: "Créditos premium",
  premiumCreditsResetsAt: "Reset créditos premium",
  subscriptionIncludedCredits: "Créditos inclusos",
  subscriptionRemainingCredits: "Créditos restantes (sub)",
  spendingCurrentUsd: "Gasto atual (USD)",
  spendingCapUsd: "Cap (USD)",
  modelsVisible: "Modelos visíveis",
  notableModels: "Modelos-chave",
  defaultModel: "Model default",
  imageModel: "Model imagem",
  envOrgId: "OPENAI_ORG_ID",
  envProjectId: "OPENAI_PROJECT_ID",
  adminKey: "Admin key",
  monthSpendUsd: "Gasto MTD (USD)",
  spendLimitUsd: "Spend limit (USD)",
  spendInterval: "Intervalo limit",
  spendEnforcement: "Enforcement",
  costsError: "Erro custos",
  spendLimitError: "Erro spend limit",
  meError: "Erro /v1/me",
  modelsError: "Erro /v1/models",
  domainsConfigured: "Domains",
  emailFrom: "EMAIL_FROM",
  note: "Status",
};

function formatAccountEntries(account: Record<string, string | number | boolean | null>) {
  return Object.entries(account)
    .filter(([key]) => key !== "id")
    .map(([key, value]) => ({
      label: ACCOUNT_LABELS[key] || key,
      value:
        value === null || value === ""
          ? "—"
          : typeof value === "boolean"
            ? value
              ? "sim"
              : "não"
            : String(value),
    }));
}

function ProviderUsageMeter({ usage }: { usage: ProviderUsageSnapshot }) {
  if (usage.kind === "balance") {
    return (
      <div className="mt-2 space-y-2 text-md-text-muted">
        <p className="text-2xl font-semibold tabular-nums text-md-text">
          {formatUsageValue(usage.remaining, usage.unit)}
        </p>
        <p className="text-xs text-md-text-soft">
          Saldo prepaid da API — sem cota mensal usada/limite.
          {usage.exhausted ? " Wallet zerada." : ""}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2 text-md-text-muted">
      <p>
        {formatUsageValue(usage.used, usage.unit)} / {formatUsageValue(usage.limit, usage.unit)}
        <span className="ml-2 text-md-text-soft">({usage.percentUsed.toFixed(0)}%)</span>
      </p>
      <div className="h-2 overflow-hidden rounded-full bg-md-slate-800">
        <div
          className={`h-full rounded-full ${
            usage.exhausted
              ? "bg-rose-500"
              : usage.percentUsed > 80
                ? "bg-amber-400"
                : "bg-emerald-400"
          }`}
          style={{ width: `${Math.min(100, Math.max(usage.percentUsed, usage.exhausted ? 100 : 0))}%` }}
        />
      </div>
      <p className="text-xs text-md-text-soft">
        Restante {formatUsageValue(usage.remaining, usage.unit)}
        {usage.cycleEnd
          ? ` · ciclo até ${new Date(usage.cycleEnd).toLocaleDateString("pt-BR")}`
          : null}
      </p>
    </div>
  );
}

function EditableProviderCard({ providerId }: { providerId: EditableProviderId }) {
  const meta = EDITABLE_META[providerId];
  const [status, setStatus] = useState<ProviderAccountStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const response = await fetch(`/api/admin/providers/${providerId}`);
    const payload = (await response.json()) as {
      status?: ProviderAccountStatus;
      message?: string;
    };
    if (!response.ok) {
      throw new Error(payload.message || `Falha ao carregar ${meta.name}.`);
    }
    setStatus(payload.status ?? null);
  }, [meta.name, providerId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await load();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erro.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function saveKey() {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/admin/providers/${providerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", apiKey }),
      });
      const payload = (await response.json()) as {
        status?: ProviderAccountStatus;
        message?: string;
      };
      if (!response.ok) {
        throw new Error(payload.message || "Falha ao salvar API key.");
      }
      setStatus(payload.status ?? null);
      setApiKey("");
      setMessage(
        isPoolProviderId(providerId)
          ? `Key adicionada ao pool ${meta.name}.`
          : `API key ${meta.name} salva (override do admin).`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  async function mutateKeys(body: Record<string, unknown>, successMessage: string) {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/admin/providers/${providerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as {
        status?: ProviderAccountStatus;
        message?: string;
      };
      if (!response.ok) {
        throw new Error(payload.message || "Falha ao atualizar keys.");
      }
      setStatus(payload.status ?? null);
      setMessage(successMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro.");
    } finally {
      setBusy(false);
    }
  }

  async function clearOverride() {
    await mutateKeys({ action: "clear" }, "Overrides removidos — voltando a usar a key do ambiente.");
  }

  async function removeKey(keyId: string) {
    await mutateKeys({ action: "remove_key", keyId }, "Key removida do pool.");
  }

  async function toggleKey(key: ProviderKeyPublic) {
    await mutateKeys(
      { action: "set_enabled", keyId: key.id, enabled: !key.enabled },
      key.enabled ? "Key desativada." : "Key reativada.",
    );
  }

  async function moveKey(keyId: string, direction: -1 | 1) {
    const keys = status?.keys ?? [];
    const index = keys.findIndex((row) => row.id === keyId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= keys.length) {
      return;
    }
    const next = [...keys];
    const [row] = next.splice(index, 1);
    next.splice(target, 0, row!);
    await mutateKeys(
      { action: "reorder", keyIds: next.map((item) => item.id) },
      "Ordem do pool atualizada.",
    );
  }

  const usage = status?.usage;
  const account = status?.account;
  const poolEnabled = isPoolProviderId(providerId) || Boolean(status?.supportsPool);
  const poolKeys = status?.keys ?? [];
  const maxKeys = PROVIDER_MAX_KEYS[providerId];
  const envKeys =
    providerId === "openai"
      ? `${PROVIDER_ENV_KEYS.openai.join(" / ")} (+ OPENAI_ADMIN_KEY p/ custos)`
      : PROVIDER_ENV_KEYS[providerId].join(" / ");
  const heygenBadge =
    providerId === "heygen"
      ? heygenStatusBadge({
          ok: Boolean(status?.ok),
          health: readHeyGenWalletHealth(account),
        })
      : null;

  return (
    <article className="rounded-2xl border border-cyan-800/40 bg-md-surface/60 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-md-text">{meta.name}</h3>
          <p className="mt-1 text-sm text-md-text-soft">{meta.description}</p>
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
            heygenBadge
              ? heygenBadge.className
              : status?.ok
                ? usage?.exhausted
                  ? STATUS_STYLE.missing
                  : STATUS_STYLE.configured
                : STATUS_STYLE.optional
          }`}
        >
          {heygenBadge
            ? heygenBadge.label
            : status?.ok
              ? usage?.exhausted
                ? "Cota esgotada"
                : "Configurado"
              : "Sem key / erro"}
        </span>
      </div>

      {error ? (
        <p className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {message}
        </p>
      ) : null}

      {providerId === "heygen" ? (
        !status ? (
          <p className="mt-4 text-sm text-md-text-soft">Carregando…</p>
        ) : status.error && !account ? (
          <p className="mt-4 text-sm text-md-text-soft">{status.error}</p>
        ) : (
          <HeyGenProviderInsights
            account={account ?? null}
            usage={usage ?? null}
            tokenHint={status.tokenHint}
            tokenSource={status.tokenSource}
          />
        )
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-md-border bg-md-bg/50 px-3 py-3 text-sm">
            <p className="text-xs uppercase tracking-wide text-md-text-soft">Conta / key</p>
            {account ? (
              <ul className="mt-2 space-y-1 text-md-text-muted">
                {formatAccountEntries(account).map((row) => (
                  <li key={row.label}>
                    <span className="text-md-text-soft">{row.label}:</span> {row.value}
                  </li>
                ))}
                <li>
                  <span className="text-md-text-soft">Key:</span> {status?.tokenHint ?? "—"} (
                  {status?.tokenSource ?? "none"})
                </li>
                {typeof status?.socialEnabled === "boolean" ? (
                  <li>
                    <span className="text-md-text-soft">Social flag:</span>{" "}
                    {status.socialEnabled ? "ligada" : "desligada"}
                  </li>
                ) : null}
              </ul>
            ) : (
              <p className="mt-2 text-md-text-soft">{status?.error || "Carregando…"}</p>
            )}
          </div>

          <div className="rounded-xl border border-md-border bg-md-bg/50 px-3 py-3 text-sm">
            <p className="text-xs uppercase tracking-wide text-md-text-soft">
              {usage?.label || "Uso / cota"}
            </p>
            {usage ? (
              <ProviderUsageMeter usage={usage} />
            ) : (
              <p className="mt-2 text-md-text-soft">
                {status?.ok
                  ? "Sem métrica de cota nesta API (key validada)."
                  : "Sem dados de uso."}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 border-t border-md-border pt-4">
        {poolEnabled ? (
          <div className="mb-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-md-text-soft">
              Pool de keys ({poolKeys.length}/{maxKeys})
            </p>
            {poolKeys.length === 0 ? (
              <p className="text-sm text-md-text-soft">
                Nenhuma override — usando env se existir. Adicione keys abaixo para failover.
              </p>
            ) : (
              <ul className="space-y-2">
                {poolKeys.map((key, index) => {
                  const cooling =
                    key.cooldownUntil && Date.parse(key.cooldownUntil) > Date.now();
                  return (
                    <li
                      key={key.id}
                      className="flex flex-wrap items-center gap-2 rounded-lg border border-md-border bg-md-bg/40 px-3 py-2 text-sm text-md-text-muted"
                    >
                      <span className="font-medium text-md-text">
                        #{index + 1} {key.label}
                      </span>
                      <span className="text-md-text-soft">{key.hint}</span>
                      {!key.enabled ? (
                        <span className="rounded border border-rose-500/40 px-1.5 py-0.5 text-[10px] uppercase text-rose-300">
                          off
                        </span>
                      ) : null}
                      {cooling ? (
                        <span className="rounded border border-amber-500/40 px-1.5 py-0.5 text-[10px] uppercase text-amber-200">
                          cooldown {key.cooldownReason || "quota"}
                        </span>
                      ) : null}
                      <div className="ml-auto flex flex-wrap gap-1">
                        <button
                          type="button"
                          disabled={busy || index === 0}
                          onClick={() => void moveKey(key.id, -1)}
                          className="rounded border border-md-border px-2 py-1 text-xs hover:bg-md-overlay-hover disabled:opacity-40"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={busy || index === poolKeys.length - 1}
                          onClick={() => void moveKey(key.id, 1)}
                          className="rounded border border-md-border px-2 py-1 text-xs hover:bg-md-overlay-hover disabled:opacity-40"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void toggleKey(key)}
                          className="rounded border border-md-border px-2 py-1 text-xs hover:bg-md-overlay-hover disabled:opacity-40"
                        >
                          {key.enabled ? "Desativar" : "Ativar"}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void removeKey(key.id)}
                          className="rounded border border-rose-800/60 px-2 py-1 text-xs text-rose-300 hover:bg-rose-950/40 disabled:opacity-40"
                        >
                          Remover
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}

        <label className="block text-xs font-semibold uppercase tracking-wide text-md-text-soft">
          {poolEnabled ? "Adicionar API key ao pool" : "Nova API key"}
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder={meta.placeholder}
            className="min-w-0 flex-1 rounded-lg border border-md-border bg-md-slate-900 px-3 py-2 text-sm text-md-text outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            autoComplete="off"
          />
          <button
            type="button"
            disabled={
              busy ||
              apiKey.trim().length < 16 ||
              (poolEnabled && poolKeys.length >= maxKeys)
            }
            onClick={() => void saveKey()}
            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {poolEnabled ? "Adicionar" : "Salvar key"}
          </button>
          <button
            type="button"
            disabled={busy || poolKeys.length === 0}
            onClick={() => void clearOverride()}
            className="rounded-lg border border-md-border px-4 py-2 text-sm font-semibold text-md-text-muted hover:bg-md-overlay-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            {poolEnabled ? "Limpar pool" : "Usar env"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void load().catch((err) => setError(err instanceof Error ? err.message : "Erro."))
            }
            className="rounded-lg border border-md-border px-4 py-2 text-sm font-semibold text-md-text-muted hover:bg-md-overlay-hover disabled:opacity-40"
          >
            Atualizar
          </button>
        </div>
        <p className="mt-2 text-xs text-md-text-soft">
          {poolEnabled
            ? `Ordem = prioridade de failover. Env (${envKeys}) entra por último. Em cota, a key fica em cooldown ~15min.`
            : `Override do admin tem prioridade sobre ${envKeys}. O valor completo nunca é exibido de volta.`}
        </p>
      </div>

      <a
        href={meta.docsUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-block text-xs text-cyan-400 hover:underline"
      >
        Console / docs →
      </a>
    </article>
  );
}

export function AdminProvidersPage() {
  const [providers, setProviders] = useState<AdminProvider[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/admin/providers");
        const payload = (await response.json()) as {
          providers?: AdminProvider[];
          message?: string;
        };
        if (!response.ok) {
          throw new Error(payload.message || "Falha ao listar provedores.");
        }
        if (!cancelled) {
          setProviders(payload.providers ?? []);
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

  const editableSet = new Set<string>(EDITABLE_PROVIDER_IDS);
  const others = providers.filter((provider) => !editableSet.has(provider.id));

  return (
    <div>
      <header className="mb-8">
        <h2 className="text-2xl font-bold text-md-text">Provedores</h2>
        <p className="mt-1 text-sm text-md-text-soft">
          Serviços externos com API key — monitore status/cota e troque a key sem redeploy. Demais
          provedores aparecem abaixo só como leitura de env.
        </p>
      </header>

      {error ? (
        <p className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3">
        {EDITABLE_PROVIDER_IDS.map((providerId) => (
          <EditableProviderCard key={providerId} providerId={providerId} />
        ))}

        {others.map((provider) => (
          <article
            key={provider.id}
            className="rounded-2xl border border-md-border bg-md-surface/40 px-5 py-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-md-text">{provider.name}</h3>
                <p className="mt-1 text-sm text-md-text-soft">{provider.description}</p>
                <p className="mt-2 text-xs text-md-text-soft">
                  Categoria: {provider.category}
                  {provider.envKeys.length > 0
                    ? ` · env: ${provider.envKeys.join(", ")}`
                    : " · sem API key"}
                  {provider.required ? " · obrigatório" : ""}
                </p>
              </div>
              <span
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${STATUS_STYLE[provider.status]}`}
              >
                {STATUS_LABEL[provider.status]}
              </span>
            </div>
            {provider.docsUrl ? (
              <a
                href={provider.docsUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-xs text-cyan-400 hover:underline"
              >
                Documentação →
              </a>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
