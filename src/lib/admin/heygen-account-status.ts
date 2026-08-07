import type { HeyGenUserMeResponse } from "@/lib/heygen";
import type { ProviderAccountStatus, ProviderUsageSnapshot } from "@/lib/admin/provider-catalog";
import {
  HEYGEN_DIGITAL_TWIN_VIDEO_RATE_PER_SECOND,
  HEYGEN_PHOTO_IMAGE_VIDEO_RATE_PER_SECOND,
} from "@/lib/heygen-pricing";

export const HEYGEN_WALLET_LOW_USD = 5;
export const HEYGEN_WALLET_CRITICAL_USD = 2;
export const HEYGEN_API_SETTINGS_URL = "https://app.heygen.com/settings?nav=API";

export type HeyGenWalletHealth = "ok" | "low" | "critical" | "empty";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function num(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

export function resolveHeyGenWalletHealth(remainingUsd: number): HeyGenWalletHealth {
  if (remainingUsd <= 0) {
    return "empty";
  }
  if (remainingUsd < HEYGEN_WALLET_CRITICAL_USD) {
    return "critical";
  }
  if (remainingUsd < HEYGEN_WALLET_LOW_USD) {
    return "low";
  }
  return "ok";
}

export function estimateHeyGenWalletAutonomySeconds(remainingUsd: number) {
  const safe = Math.max(0, remainingUsd);
  return {
    photoSeconds: Math.floor(safe / HEYGEN_PHOTO_IMAGE_VIDEO_RATE_PER_SECOND),
    twinSeconds: Math.floor(safe / HEYGEN_DIGITAL_TWIN_VIDEO_RATE_PER_SECOND),
  };
}

export function formatHeyGenDurationSeconds(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes}min ${rest}s` : `${minutes}min`;
}

/**
 * Extrai conta + uso do GET /v3/users/me (wallet | subscription | usage_based).
 * Expõe todos os blocos presentes — a API só popula um billing_type, mas se
 * vierem campos extras (add-on, cap, etc.) eles entram em `account`.
 */
export function parseHeyGenUserMeStatus(
  payload: HeyGenUserMeResponse | Record<string, unknown> | null | undefined,
): Pick<ProviderAccountStatus, "account" | "usage"> {
  const root = asRecord(payload);
  const data = asRecord(root.data ?? root);
  const billingType = str(data.billing_type) || "unknown";
  const wallet = asRecord(data.wallet);
  const subscription = asRecord(data.subscription);
  const usageBased = asRecord(data.usage_based);
  const subCredits = asRecord(subscription.credits);
  const premium = asRecord(subCredits.premium_credits);
  const addOn = asRecord(subCredits.add_on_credits);
  const autoReload = asRecord(wallet.auto_reload);

  const firstName = str(data.first_name);
  const lastName = str(data.last_name);
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  const plan = str(subscription.plan);

  const account: Record<string, string | number | boolean | null> = {
    username: str(data.username) || "—",
    email: str(data.email) || "—",
    name: fullName || "—",
    billingType,
    plan:
      billingType === "wallet"
        ? "API wallet (pay-as-you-go)"
        : plan || (billingType === "usage_based" ? "Usage-based" : "—"),
  };

  const walletRemaining = num(wallet.remaining_balance);
  const walletCurrencyRaw = str(wallet.currency).toLowerCase();
  const walletUnit =
    walletCurrencyRaw === "usd" || walletCurrencyRaw === "" ? "USD" : walletCurrencyRaw || "USD";

  if (walletRemaining != null || wallet.currency != null || wallet.auto_reload != null) {
    account.walletCurrency = walletUnit;
    if (walletRemaining != null) {
      account.walletRemainingUsd = walletRemaining;
      const health = resolveHeyGenWalletHealth(walletRemaining);
      account.walletHealth = health;
      const autonomy = estimateHeyGenWalletAutonomySeconds(walletRemaining);
      account.estPhotoVideoSeconds = autonomy.photoSeconds;
      account.estTwinVideoSeconds = autonomy.twinSeconds;
    }
    account.autoReload = Boolean(autoReload.enabled);
    const threshold = num(autoReload.threshold_usd);
    const amount = num(autoReload.amount_usd);
    if (threshold != null) {
      account.autoReloadThresholdUsd = threshold;
    }
    if (amount != null) {
      account.autoReloadAmountUsd = amount;
    }
  }

  if (plan) {
    account.subscriptionPlan = plan;
  }
  const premiumRemaining = num(premium.remaining);
  const premiumResetsAt = str(premium.resets_at);
  const includedCredits = num(subscription.included_credits);
  const remainingCredits = num(subscription.remaining_credits);
  if (premiumRemaining != null) {
    account.premiumCreditsRemaining = premiumRemaining;
  }
  if (premiumResetsAt) {
    account.premiumCreditsResetsAt = premiumResetsAt;
  }
  if (includedCredits != null) {
    account.subscriptionIncludedCredits = includedCredits;
  }
  if (remainingCredits != null) {
    account.subscriptionRemainingCredits = remainingCredits;
  }
  const addOnRemaining = num(addOn.remaining);
  if (addOnRemaining != null) {
    account.addOnCredits = addOnRemaining;
  }

  const spendingCurrent = num(usageBased.spending_current_usd);
  const spendingCap = num(usageBased.spending_cap_usd);
  if (spendingCurrent != null) {
    account.spendingCurrentUsd = spendingCurrent;
  }
  if (spendingCap != null) {
    account.spendingCapUsd = spendingCap;
  }

  let usage: ProviderUsageSnapshot | null = null;

  if (
    billingType === "usage_based" ||
    (usageBased.spending_current_usd != null && usageBased.spending_cap_usd != null)
  ) {
    const used = spendingCurrent ?? 0;
    if (spendingCap != null && spendingCap > 0) {
      const remaining = Math.max(0, spendingCap - used);
      usage = {
        label: "Gasto do período (usage-based)",
        kind: "quota",
        used,
        limit: spendingCap,
        remaining,
        percentUsed: Math.min(100, (used / spendingCap) * 100),
        exhausted: used >= spendingCap,
        unit: "USD",
      };
    }
  } else if (billingType === "subscription" || plan || premiumRemaining != null) {
    const remaining = premiumRemaining ?? remainingCredits ?? null;
    if (remaining != null) {
      const limit = includedCredits != null && includedCredits > 0 ? includedCredits : remaining;
      const used = includedCredits != null && includedCredits > 0 ? Math.max(0, includedCredits - remaining) : 0;
      usage = {
        label: "Créditos premium (subscription)",
        kind: "quota",
        used,
        limit,
        remaining,
        percentUsed: limit > 0 ? Math.min(100, (used / limit) * 100) : remaining <= 0 ? 100 : 0,
        exhausted: remaining <= 0,
        unit: "créditos",
        cycleEnd: premiumResetsAt || null,
      };
    }
  }

  if (!usage && walletRemaining != null) {
    const health = resolveHeyGenWalletHealth(walletRemaining);
    usage = {
      label: "Saldo wallet (API)",
      kind: "balance",
      used: 0,
      limit: Math.max(walletRemaining, 0),
      remaining: walletRemaining,
      percentUsed: health === "empty" ? 100 : health === "critical" ? 90 : health === "low" ? 70 : 0,
      exhausted: walletRemaining <= 0,
      unit: walletUnit,
    };
  }

  return { account, usage };
}
