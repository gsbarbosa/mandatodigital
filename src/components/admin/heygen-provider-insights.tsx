"use client";

import type { ProviderUsageSnapshot } from "@/lib/admin/provider-catalog";
import {
  HEYGEN_API_SETTINGS_URL,
  formatHeyGenDurationSeconds,
  type HeyGenWalletHealth,
} from "@/lib/admin/heygen-account-status";

type Account = Record<string, string | number | boolean | null>;

function asString(value: string | number | boolean | null | undefined) {
  if (value == null || value === "") {
    return null;
  }
  return String(value);
}

function asNumber(value: string | number | boolean | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asBoolean(value: string | number | boolean | null | undefined) {
  return value === true || value === "true" || value === "sim";
}

function formatUsd(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function healthCopy(health: HeyGenWalletHealth | null) {
  if (health === "empty") {
    return {
      badge: "Wallet zerada",
      badgeClass: "bg-rose-500/15 text-rose-300 border-rose-500/30",
      title: "Sem saldo na wallet da API",
      body: "Treino de avatar e geração de vídeo vão falhar para todos os usuários até recarregar.",
      tone: "rose" as const,
    };
  }
  if (health === "critical") {
    return {
      badge: "Saldo crítico",
      badgeClass: "bg-rose-500/15 text-rose-300 border-rose-500/30",
      title: "Saldo crítico — menos de US$ 2",
      body: "Cabe no máximo um vídeo curto. Recarregue a wallet PAYG e ligue auto-reload.",
      tone: "rose" as const,
    };
  }
  if (health === "low") {
    return {
      badge: "Saldo baixo",
      badgeClass: "bg-amber-500/15 text-amber-200 border-amber-500/30",
      title: "Saldo baixo — menos de US$ 5",
      body: "Autonomia curta. Recarregue em Settings → API e ative auto-reload para não zerar no meio do dia.",
      tone: "amber" as const,
    };
  }
  return null;
}

export function heygenStatusBadge(input: {
  ok: boolean;
  health: HeyGenWalletHealth | null;
}) {
  if (!input.ok) {
    return {
      label: "Sem key / erro",
      className: "bg-amber-500/15 text-amber-200 border-amber-500/30",
    };
  }
  const copy = healthCopy(input.health);
  if (copy) {
    return { label: copy.badge, className: copy.badgeClass };
  }
  return {
    label: "Configurado",
    className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  };
}

export function readHeyGenWalletHealth(account: Account | null | undefined): HeyGenWalletHealth | null {
  const raw = asString(account?.walletHealth);
  if (raw === "ok" || raw === "low" || raw === "critical" || raw === "empty") {
    return raw;
  }
  return null;
}

export function HeyGenProviderInsights({
  account,
  usage,
  tokenHint,
  tokenSource,
}: {
  account: Account | null;
  usage: ProviderUsageSnapshot | null;
  tokenHint: string | null | undefined;
  tokenSource: string | null | undefined;
}) {
  if (!account) {
    return (
      <p className="mt-4 text-sm text-md-text-soft">Sem dados da conta HeyGen.</p>
    );
  }

  const remaining = asNumber(account.walletRemainingUsd) ?? usage?.remaining ?? null;
  const health = readHeyGenWalletHealth(account);
  const alert = healthCopy(health);
  const autoReload = asBoolean(account.autoReload);
  const threshold = asNumber(account.autoReloadThresholdUsd);
  const reloadAmount = asNumber(account.autoReloadAmountUsd);
  const photoSeconds = asNumber(account.estPhotoVideoSeconds);
  const twinSeconds = asNumber(account.estTwinVideoSeconds);
  const premiumRemaining = asNumber(account.premiumCreditsRemaining);
  const addOnCredits = asNumber(account.addOnCredits);
  const subscriptionPlan = asString(account.subscriptionPlan);
  const premiumResetsAt = asString(account.premiumCreditsResetsAt);
  const spendingCurrent = asNumber(account.spendingCurrentUsd);
  const spendingCap = asNumber(account.spendingCapUsd);
  const billingType = asString(account.billingType) || "—";
  const plan = asString(account.plan) || "—";

  const alertBox =
    alert?.tone === "rose"
      ? "border-rose-500/30 bg-rose-500/10 text-rose-100"
      : "border-amber-500/30 bg-amber-500/10 text-amber-100";

  return (
    <div className="mt-4 space-y-3">
      {alert ? (
        <div className={`rounded-xl border px-3 py-2 text-sm ${alertBox}`}>
          <p className="font-semibold">{alert.title}</p>
          <p className="mt-1 text-sm opacity-90">{alert.body}</p>
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-md-border bg-md-bg/50 px-3 py-3 text-sm">
          <p className="text-xs uppercase tracking-wide text-md-text-soft">Conta</p>
          <ul className="mt-2 space-y-1 text-md-text-muted">
            <li>
              <span className="text-md-text-soft">Nome:</span> {asString(account.name) || "—"}
            </li>
            <li>
              <span className="text-md-text-soft">Email:</span> {asString(account.email) || "—"}
            </li>
            <li>
              <span className="text-md-text-soft">User:</span> {asString(account.username) || "—"}
            </li>
            <li>
              <span className="text-md-text-soft">Key:</span> {tokenHint || "—"} ({tokenSource || "none"})
            </li>
          </ul>
        </div>

        <div className="rounded-xl border border-md-border bg-md-bg/50 px-3 py-3 text-sm lg:col-span-2">
          <p className="text-xs uppercase tracking-wide text-md-text-soft">
            {usage?.label || "Saldo wallet (API)"}
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-md-text">
            {remaining != null ? formatUsd(remaining) : "—"}
          </p>
          <p className="mt-1 text-xs text-md-text-soft">
            Billing: {billingType} · {plan}
            {usage?.unit && usage.unit !== "USD" ? ` · unidade ${usage.unit}` : null}
          </p>

          <dl className="mt-3 grid gap-2 sm:grid-cols-2 text-sm text-md-text-muted">
            <div>
              <dt className="text-xs uppercase tracking-wide text-md-text-soft">Auto-reload</dt>
              <dd className={autoReload ? "text-emerald-300" : "text-amber-200"}>
                {autoReload ? "ligado" : "desligado"}
                {threshold != null ? ` · dispara em ${formatUsd(threshold)}` : ""}
                {reloadAmount != null ? ` · recarrega ${formatUsd(reloadAmount)}` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-md-text-soft">
                Autonomia estimada
              </dt>
              <dd>
                {photoSeconds != null || twinSeconds != null
                  ? `foto ~${formatHeyGenDurationSeconds(photoSeconds ?? 0)} · gêmeo ~${formatHeyGenDurationSeconds(twinSeconds ?? 0)}`
                  : "—"}
              </dd>
            </div>
          </dl>

          <p className="mt-3 text-xs text-md-text-soft">
            Só a wallet PAYG paga a API do Mandato. Créditos do plano web (Creator/Pro no painel
            principal da HeyGen) e e-mails de cota mensal Pro/Scale não entram aqui.
          </p>

          <div className="mt-3 flex flex-wrap gap-3">
            <a
              href={HEYGEN_API_SETTINGS_URL}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-cyan-400 hover:underline"
            >
              Recarregar wallet / auto-reload →
            </a>
          </div>
        </div>
      </div>

      {subscriptionPlan ||
      premiumRemaining != null ||
      addOnCredits != null ||
      spendingCurrent != null ? (
        <div className="rounded-xl border border-md-border bg-md-bg/50 px-3 py-3 text-sm">
          <p className="text-xs uppercase tracking-wide text-md-text-soft">
            Outros saldos na mesma conta
          </p>
          <ul className="mt-2 space-y-1 text-md-text-muted">
            {subscriptionPlan ? (
              <li>
                <span className="text-md-text-soft">Plano subscription:</span> {subscriptionPlan}
              </li>
            ) : null}
            {premiumRemaining != null ? (
              <li>
                <span className="text-md-text-soft">Créditos premium:</span> {premiumRemaining}
                {premiumResetsAt
                  ? ` · reset ${new Date(premiumResetsAt).toLocaleDateString("pt-BR")}`
                  : ""}
              </li>
            ) : null}
            {addOnCredits != null ? (
              <li>
                <span className="text-md-text-soft">Add-on credits:</span> {addOnCredits}
              </li>
            ) : null}
            {spendingCurrent != null ? (
              <li>
                <span className="text-md-text-soft">Gasto usage-based:</span>{" "}
                {formatUsd(spendingCurrent)}
                {spendingCap != null ? ` / cap ${formatUsd(spendingCap)}` : ""}
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
