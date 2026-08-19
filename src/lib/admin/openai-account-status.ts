import type { ProviderAccountStatus, ProviderUsageSnapshot } from "@/lib/admin/provider-catalog";

const NOTABLE_MODELS = [
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-image-1.5",
  "gpt-image-1",
  "text-embedding-3-small",
  "text-embedding-3-large",
] as const;

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

export function getOpenAiAdminKeyFromEnv(): string {
  return (
    process.env.OPENAI_ADMIN_KEY?.trim() ||
    process.env.OPENAI_ADMIN_API_KEY?.trim() ||
    ""
  );
}

export function buildOpenAiAuthHeaders(token: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  const organization =
    process.env.OPENAI_ORG_ID?.trim() || process.env.OPENAI_ORGANIZATION?.trim();
  const project = process.env.OPENAI_PROJECT_ID?.trim();
  if (organization) {
    headers["OpenAI-Organization"] = organization;
  }
  if (project) {
    headers["OpenAI-Project"] = project;
  }
  return headers;
}

export function parseOpenAiMeStatus(payload: unknown): Record<string, string | number | boolean | null> {
  const data = asRecord(payload);
  const orgs = asRecord(data.orgs);
  const orgList = Array.isArray(orgs.data) ? orgs.data : [];
  const primaryOrg = asRecord(orgList[0]);
  const orgTitles = orgList
    .map((row) => str(asRecord(row).title) || str(asRecord(row).id))
    .filter(Boolean);

  return {
    email: str(data.email) || "—",
    name: str(data.name) || "—",
    userId: str(data.id) || "—",
    org: str(primaryOrg.title) || str(primaryOrg.id) || orgTitles[0] || "—",
    orgId: str(primaryOrg.id) || "—",
    orgsCount: orgList.length,
  };
}

export function summarizeOpenAiModels(payload: unknown): {
  modelsVisible: number;
  notableModels: string;
} {
  const data = asRecord(payload);
  const list = Array.isArray(data.data) ? data.data : [];
  const ids = new Set(
    list
      .map((row) => str(asRecord(row).id))
      .filter(Boolean),
  );
  const notable = NOTABLE_MODELS.filter((id) => ids.has(id));
  return {
    modelsVisible: ids.size || list.length,
    notableModels: notable.length ? notable.join(", ") : "—",
  };
}

/** Soma custos diários do /organization/costs (valores já em USD na maioria dos buckets). */
export function sumOpenAiCostsUsd(payload: unknown): number {
  const data = asRecord(payload);
  const buckets = Array.isArray(data.data) ? data.data : [];
  let total = 0;

  for (const bucket of buckets) {
    const row = asRecord(bucket);
    const results = Array.isArray(row.results)
      ? row.results
      : Array.isArray(row.result)
        ? row.result
        : [];
    for (const item of results) {
      const amount = asRecord(asRecord(item).amount);
      const value = num(amount.value);
      if (value != null) {
        total += value;
      }
    }
  }

  return total;
}

export function parseOpenAiSpendLimitUsd(payload: unknown): {
  limitUsd: number | null;
  interval: string;
  enforcement: string;
} {
  const data = asRecord(payload);
  const cents = num(data.threshold_amount);
  return {
    limitUsd: cents != null ? cents / 100 : null,
    interval: str(data.interval) || "month",
    enforcement: str(asRecord(data.enforcement).status) || "—",
  };
}

export function buildOpenAiUsageSnapshot(input: {
  monthSpendUsd: number | null;
  spendLimitUsd: number | null;
}): ProviderUsageSnapshot | null {
  if (input.monthSpendUsd == null && input.spendLimitUsd == null) {
    return null;
  }

  const used = input.monthSpendUsd ?? 0;
  if (input.spendLimitUsd != null && input.spendLimitUsd > 0) {
    const limit = input.spendLimitUsd;
    const remaining = Math.max(0, limit - used);
    return {
      label: "Gasto do mês vs spend limit",
      used,
      limit,
      remaining,
      percentUsed: Math.min(100, (used / limit) * 100),
      exhausted: used >= limit,
      unit: "USD",
      kind: "quota",
    };
  }

  return {
    label: "Gasto do mês (MTD)",
    used,
    limit: 0,
    remaining: 0,
    percentUsed: 0,
    exhausted: false,
    unit: "USD",
    kind: "uncapped",
  };
}

type FetchJson = (
  url: string,
  init: RequestInit,
) => Promise<{ ok: boolean; status: number; data: Record<string, unknown> | null; message?: string }>;

export async function fetchOpenAiAccountDetails(input: {
  apiKey: string;
  adminKey?: string;
  fetchJson: FetchJson;
}): Promise<Pick<ProviderAccountStatus, "account" | "usage">> {
  const headers = buildOpenAiAuthHeaders(input.apiKey);
  const adminKey = input.adminKey?.trim() || "";

  const [meRes, modelsRes] = await Promise.all([
    input.fetchJson("https://api.openai.com/v1/me", { headers }),
    input.fetchJson("https://api.openai.com/v1/models", { headers }),
  ]);

  if (!meRes.ok && !modelsRes.ok) {
    throw new Error(meRes.message || modelsRes.message || "Falha ao validar OpenAI");
  }

  const account: Record<string, string | number | boolean | null> = {
    defaultModel: process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini",
    imageModel: process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-1.5",
    envOrgId: process.env.OPENAI_ORG_ID?.trim() || process.env.OPENAI_ORGANIZATION?.trim() || "—",
    envProjectId: process.env.OPENAI_PROJECT_ID?.trim() || "—",
  };

  if (meRes.ok) {
    Object.assign(account, parseOpenAiMeStatus(meRes.data));
  } else {
    account.meError = meRes.message || `HTTP ${meRes.status}`;
  }

  if (modelsRes.ok) {
    const models = summarizeOpenAiModels(modelsRes.data);
    account.modelsVisible = models.modelsVisible;
    account.notableModels = models.notableModels;
  } else {
    account.modelsError = modelsRes.message || `HTTP ${modelsRes.status}`;
  }

  let monthSpendUsd: number | null = null;
  let spendLimitUsd: number | null = null;

  if (adminKey) {
    account.adminKey = "configurada (env)";
    const adminHeaders = { Authorization: `Bearer ${adminKey}` };
    const now = new Date();
    const startOfMonth = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) / 1000;
    const costsUrl =
      `https://api.openai.com/v1/organization/costs?start_time=${Math.floor(startOfMonth)}` +
      `&bucket_width=1d&limit=31`;

    const [costsRes, limitRes] = await Promise.all([
      input.fetchJson(costsUrl, { headers: adminHeaders }),
      input.fetchJson("https://api.openai.com/v1/organization/spend_limit", {
        headers: adminHeaders,
      }),
    ]);

    if (costsRes.ok) {
      monthSpendUsd = sumOpenAiCostsUsd(costsRes.data);
      account.monthSpendUsd = Number(monthSpendUsd.toFixed(4));
    } else {
      account.costsError = costsRes.message || `HTTP ${costsRes.status}`;
    }

    if (limitRes.ok) {
      const limit = parseOpenAiSpendLimitUsd(limitRes.data);
      spendLimitUsd = limit.limitUsd;
      account.spendLimitUsd = spendLimitUsd;
      account.spendInterval = limit.interval;
      account.spendEnforcement = limit.enforcement;
    } else if (limitRes.status === 404) {
      account.spendLimitUsd = "não configurado";
    } else {
      account.spendLimitError = limitRes.message || `HTTP ${limitRes.status}`;
    }
  } else {
    account.adminKey =
      "ausente — defina OPENAI_ADMIN_KEY no env para gasto MTD e spend limit";
  }

  return {
    account,
    usage: buildOpenAiUsageSnapshot({ monthSpendUsd, spendLimitUsd }),
  };
}
