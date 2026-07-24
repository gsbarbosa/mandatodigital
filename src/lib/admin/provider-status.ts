import {
  type EditableProviderId,
  type ProviderAccountStatus,
  type ProviderUsageSnapshot,
} from "@/lib/admin/provider-catalog";
import { resolveProviderApiKey } from "@/lib/admin/provider-secrets";
import { isSentinelSocialEnabled } from "@/lib/feature-flags";

export type { ProviderAccountStatus, ProviderUsageSnapshot } from "@/lib/admin/provider-catalog";

function emptyStatus(
  providerId: EditableProviderId,
  resolved: Awaited<ReturnType<typeof resolveProviderApiKey>>,
  error: string,
): ProviderAccountStatus {
  return {
    providerId,
    ok: false,
    error,
    tokenSource: resolved.source,
    tokenHint: resolved.hint,
    account: null,
    usage: null,
  };
}

async function fetchJson(
  url: string,
  init: RequestInit,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> | null; message?: string }> {
  const response = await fetch(url, { ...init, next: { revalidate: 0 } });
  const payload = (await response.json().catch(() => null)) as
    | Record<string, unknown>
    | { error?: { message?: string } | string; message?: string }
    | null;

  if (!response.ok) {
    const err = payload && typeof payload === "object" ? payload : null;
    const nested =
      err && typeof err.error === "object" && err.error
        ? (err.error as { message?: string }).message
        : typeof err?.error === "string"
          ? err.error
          : undefined;
    return {
      ok: false,
      status: response.status,
      data: null,
      message: nested || (typeof err?.message === "string" ? err.message : undefined) || `HTTP ${response.status}`,
    };
  }

  return {
    ok: true,
    status: response.status,
    data: (payload ?? {}) as Record<string, unknown>,
  };
}

async function statusApify(token: string): Promise<Pick<ProviderAccountStatus, "account" | "usage">> {
  const [meRes, limitsRes] = await Promise.all([
    fetchJson("https://api.apify.com/v2/users/me", {
      headers: { Authorization: `Bearer ${token}` },
    }),
    fetchJson("https://api.apify.com/v2/users/me/limits", {
      headers: { Authorization: `Bearer ${token}` },
    }),
  ]);
  if (!meRes.ok) {
    throw new Error(meRes.message || "Falha ao consultar Apify /users/me");
  }
  if (!limitsRes.ok) {
    throw new Error(limitsRes.message || "Falha ao consultar Apify /users/me/limits");
  }

  const me = (meRes.data?.data ?? meRes.data ?? {}) as Record<string, unknown>;
  const limits = (limitsRes.data?.data ?? limitsRes.data ?? {}) as Record<string, unknown>;
  const plan = (me.plan ?? {}) as Record<string, unknown>;
  const cycle = (limits.monthlyUsageCycle ?? {}) as Record<string, unknown>;
  const current = (limits.current ?? {}) as Record<string, unknown>;
  const limitUsd = Number(plan.monthlyUsageCreditsUsd ?? plan.maxMonthlyUsageUsd ?? 0);
  const usedUsd = Number(current.monthlyUsageUsd ?? 0);
  const remainingUsd = Math.max(0, limitUsd - usedUsd);
  const percentUsed = limitUsd > 0 ? Math.min(100, (usedUsd / limitUsd) * 100) : 0;

  return {
    account: {
      email: String(me.email ?? ""),
      username: String(me.username ?? ""),
      planId: String(plan.id ?? ""),
      planTier: String(plan.tier ?? plan.id ?? ""),
    },
    usage: {
      label: "Créditos do ciclo",
      used: usedUsd,
      limit: limitUsd,
      remaining: remainingUsd,
      percentUsed,
      exhausted: usedUsd >= limitUsd && limitUsd > 0,
      unit: "USD",
      cycleEnd: typeof cycle.endAt === "string" ? cycle.endAt : null,
    },
  };
}

async function statusOpenAi(token: string): Promise<Pick<ProviderAccountStatus, "account" | "usage">> {
  const { fetchOpenAiAccountDetails, getOpenAiAdminKeyFromEnv } = await import(
    "@/lib/admin/openai-account-status"
  );
  return fetchOpenAiAccountDetails({
    apiKey: token,
    adminKey: getOpenAiAdminKeyFromEnv(),
    fetchJson,
  });
}

async function statusAnthropic(token: string): Promise<Pick<ProviderAccountStatus, "account" | "usage">> {
  const res = await fetchJson("https://api.anthropic.com/v1/models", {
    headers: {
      "x-api-key": token,
      "anthropic-version": "2023-06-01",
    },
  });
  if (!res.ok) {
    throw new Error(res.message || "Falha ao validar Anthropic");
  }
  const data = res.data?.data;
  const count = Array.isArray(data) ? data.length : 0;
  return {
    account: {
      modelsVisible: count,
      note: "Key válida (lista de modelos).",
    },
    usage: null,
  };
}

async function statusHeygen(token: string): Promise<Pick<ProviderAccountStatus, "account" | "usage">> {
  const { parseHeyGenUserMeStatus } = await import("@/lib/admin/heygen-account-status");
  const baseUrl = (process.env.HEYGEN_BASE_URL || "https://api.heygen.com").replace(/\/$/, "");
  const res = await fetchJson(`${baseUrl}/v3/users/me`, {
    headers: {
      "Content-Type": "application/json",
      "x-api-key": token,
    },
  });
  if (!res.ok) {
    throw new Error(res.message || "Falha ao consultar HeyGen /v3/users/me");
  }
  return parseHeyGenUserMeStatus(res.data);
}

async function statusElevenLabs(token: string): Promise<Pick<ProviderAccountStatus, "account" | "usage">> {
  const baseUrl = (process.env.ELEVENLABS_BASE_URL || "https://api.elevenlabs.io").replace(/\/$/, "");
  const res = await fetchJson(`${baseUrl}/v1/user`, {
    headers: { "xi-api-key": token },
  });
  if (!res.ok) {
    throw new Error(res.message || "Falha ao consultar ElevenLabs /v1/user");
  }
  const data = (res.data ?? {}) as Record<string, unknown>;
  const subscription = (data.subscription ?? {}) as Record<string, unknown>;
  const used = Number(subscription.character_count ?? 0);
  const limit = Number(subscription.character_limit ?? 0);
  const remaining = Math.max(0, limit - used);
  const percentUsed = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;

  return {
    account: {
      email: String(data.email ?? ""),
      firstName: String(data.first_name ?? ""),
      tier: String(subscription.tier ?? ""),
    },
    usage: {
      label: "Caracteres do ciclo",
      used,
      limit,
      remaining,
      percentUsed,
      exhausted: limit > 0 && used >= limit,
      unit: "chars",
      cycleEnd:
        typeof subscription.next_character_count_reset_unix === "number"
          ? new Date(subscription.next_character_count_reset_unix * 1000).toISOString()
          : null,
    },
  };
}

async function statusResend(token: string): Promise<Pick<ProviderAccountStatus, "account" | "usage">> {
  const res = await fetchJson("https://api.resend.com/domains", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(res.message || "Falha ao validar Resend");
  }
  const data = res.data?.data;
  const domains = Array.isArray(data) ? data.length : 0;
  const from = process.env.EMAIL_FROM?.trim() || "";
  return {
    account: {
      domainsConfigured: domains,
      emailFrom: from || "(EMAIL_FROM não setado)",
      note: "Key válida (lista de domains).",
    },
    usage: null,
  };
}

const STATUS_FETCHERS: Record<
  EditableProviderId,
  (token: string) => Promise<Pick<ProviderAccountStatus, "account" | "usage">>
> = {
  apify: statusApify,
  openai: statusOpenAi,
  anthropic: statusAnthropic,
  heygen: statusHeygen,
  elevenlabs: statusElevenLabs,
  resend: statusResend,
};

export async function fetchProviderAccountStatus(
  providerId: EditableProviderId,
): Promise<ProviderAccountStatus> {
  const resolved = await resolveProviderApiKey(providerId);
  const socialEnabled = providerId === "apify" ? isSentinelSocialEnabled() : undefined;

  if (!resolved.token) {
    return {
      ...emptyStatus(providerId, resolved, "Nenhuma API key configurada (env ou override do admin)."),
      socialEnabled,
    };
  }

  try {
    const live = await STATUS_FETCHERS[providerId](resolved.token);
    return {
      providerId,
      ok: true,
      tokenSource: resolved.source,
      tokenHint: resolved.hint,
      socialEnabled,
      account: live.account,
      usage: live.usage,
    };
  } catch (error) {
    return {
      providerId,
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao consultar provedor.",
      tokenSource: resolved.source,
      tokenHint: resolved.hint,
      socialEnabled,
      account: null,
      usage: null,
    };
  }
}

/** Compat com o card Apify antigo. */
export type ApifyAccountStatus = Omit<ProviderAccountStatus, "providerId" | "account" | "usage"> & {
  account: {
    id: string;
    username: string;
    email: string;
    planId: string;
    planTier: string;
    monthlyCreditsUsd: number;
  } | null;
  usage: {
    cycleStart: string | null;
    cycleEnd: string | null;
    usedUsd: number;
    limitUsd: number;
    remainingUsd: number;
    percentUsed: number;
    exhausted: boolean;
  } | null;
};

export async function fetchApifyAccountStatus(): Promise<ApifyAccountStatus> {
  const status = await fetchProviderAccountStatus("apify");
  const usage = status.usage;
  const account = status.account;
  return {
    ok: status.ok,
    error: status.error,
    tokenSource: status.tokenSource,
    tokenHint: status.tokenHint,
    socialEnabled: Boolean(status.socialEnabled),
    account: account
      ? {
          id: String(account.id ?? ""),
          username: String(account.username ?? ""),
          email: String(account.email ?? ""),
          planId: String(account.planId ?? ""),
          planTier: String(account.planTier ?? ""),
          monthlyCreditsUsd: Number(usage?.limit ?? 0),
        }
      : null,
    usage: usage
      ? {
          cycleStart: null,
          cycleEnd: usage.cycleEnd ?? null,
          usedUsd: usage.used,
          limitUsd: usage.limit,
          remainingUsd: usage.remaining,
          percentUsed: usage.percentUsed,
          exhausted: usage.exhausted,
        }
      : null,
  };
}
