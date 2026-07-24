import type { HeyGenUserMeResponse } from "@/lib/heygen";
import type { ProviderAccountStatus, ProviderUsageSnapshot } from "@/lib/admin/provider-catalog";

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

/**
 * Extrai conta + uso do GET /v3/users/me (wallet | subscription | usage_based).
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
    plan: plan || (billingType === "wallet" ? "API wallet (pay-as-you-go)" : "—"),
  };

  if (billingType === "wallet" || wallet.remaining_balance != null) {
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

  const addOnRemaining = num(addOn.remaining);
  if (addOnRemaining != null) {
    account.addOnCredits = addOnRemaining;
  }

  let usage: ProviderUsageSnapshot | null = null;

  if (billingType === "usage_based" || (usageBased.spending_current_usd != null && usageBased.spending_cap_usd != null)) {
    const used = num(usageBased.spending_current_usd) ?? 0;
    const limit = num(usageBased.spending_cap_usd);
    if (limit != null && limit > 0) {
      const remaining = Math.max(0, limit - used);
      usage = {
        label: "Gasto do período (usage-based)",
        used,
        limit,
        remaining,
        percentUsed: Math.min(100, (used / limit) * 100),
        exhausted: used >= limit,
        unit: "USD",
      };
    } else if (num(usageBased.spending_current_usd) != null) {
      account.spendingCurrentUsd = num(usageBased.spending_current_usd);
      account.spendingCapUsd = limit;
    }
  } else if (billingType === "subscription" || plan || premium.remaining != null) {
    const remaining =
      num(premium.remaining) ??
      num(subscription.remaining_credits) ??
      null;
    const included = num(subscription.included_credits);
    const resetsAt = str(premium.resets_at) || null;

    if (remaining != null) {
      const limit = included != null && included > 0 ? included : remaining;
      const used = included != null && included > 0 ? Math.max(0, included - remaining) : 0;
      usage = {
        label: "Créditos premium (subscription)",
        used,
        limit,
        remaining,
        percentUsed: limit > 0 ? Math.min(100, (used / limit) * 100) : remaining <= 0 ? 100 : 0,
        exhausted: remaining <= 0,
        unit: "créditos",
        cycleEnd: resetsAt,
      };
    }
  } else {
    // wallet (default API key billing)
    const remaining = num(wallet.remaining_balance);
    const currencyRaw = str(wallet.currency).toLowerCase();
    const unit = currencyRaw === "usd" || currencyRaw === "" ? "USD" : currencyRaw || "USD";

    if (remaining != null) {
      usage = {
        label: "Saldo wallet (API)",
        used: 0,
        limit: Math.max(remaining, 0),
        remaining,
        percentUsed: remaining <= 0 ? 100 : 0,
        exhausted: remaining <= 0,
        unit,
      };
      account.walletCurrency = unit;
    }
  }

  return { account, usage };
}
