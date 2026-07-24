/** Catálogo client-safe (sem Firebase/Node). Usado pelo admin UI e pelo server. */

export const EDITABLE_PROVIDER_IDS = [
  "apify",
  "openai",
  "anthropic",
  "heygen",
  "elevenlabs",
  "resend",
] as const;

export type EditableProviderId = (typeof EDITABLE_PROVIDER_IDS)[number];

/** Provedores com pool de keys + failover automático. */
export const POOL_PROVIDER_IDS = ["apify", "heygen", "elevenlabs", "openai"] as const;

export type PoolProviderId = (typeof POOL_PROVIDER_IDS)[number];

export const PROVIDER_ENV_KEYS: Record<EditableProviderId, readonly string[]> = {
  apify: ["APIFY_TOKEN", "APIFY_API_TOKEN"],
  openai: ["OPENAI_API_KEY"],
  anthropic: ["ANTHROPIC_API_KEY"],
  heygen: ["HEYGEN_API_KEY"],
  elevenlabs: ["ELEVENLABS_API_KEY"],
  resend: ["RESEND_API_KEY"],
};

/** Máximo de overrides no admin (env continua como fallback final). */
export const PROVIDER_MAX_KEYS: Record<EditableProviderId, number> = {
  apify: 5,
  heygen: 5,
  elevenlabs: 5,
  openai: 5,
  anthropic: 1,
  resend: 1,
};

export function isEditableProviderId(value: string): value is EditableProviderId {
  return (EDITABLE_PROVIDER_IDS as readonly string[]).includes(value);
}

export function isPoolProviderId(value: string): value is PoolProviderId {
  return (POOL_PROVIDER_IDS as readonly string[]).includes(value);
}

export type ProviderKeyPublic = {
  id: string;
  hint: string;
  label: string;
  enabled: boolean;
  cooldownUntil: string | null;
  cooldownReason: string | null;
  source: "override";
  updatedAt: string;
};

export type ProviderUsageSnapshot = {
  label: string;
  used: number;
  limit: number;
  remaining: number;
  percentUsed: number;
  exhausted: boolean;
  unit: string;
  cycleEnd?: string | null;
};

export type ProviderAccountStatus = {
  providerId: EditableProviderId;
  ok: boolean;
  error?: string;
  tokenSource: "override" | "env" | "none";
  tokenHint: string | null;
  socialEnabled?: boolean;
  account: Record<string, string | number | boolean | null> | null;
  usage: ProviderUsageSnapshot | null;
  /** Pool de overrides (sem secrets). Env não entra aqui. */
  keys?: ProviderKeyPublic[];
  supportsPool?: boolean;
};
