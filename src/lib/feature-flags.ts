/**
 * Feature flags da roadmap Sentinela / Validador / MVP.
 * Defaults conservadores: tudo desligado = comportamento atual em producao.
 */

import { canUseLocalFilesystem } from "@/lib/server-runtime";

function readEnvFlag(name: string) {
  const value = process.env[name]?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

export const featureFlags = {
  sentinelLlmExpansion: readEnvFlag("SENTINEL_LLM_EXPANSION"),
  sentinelV2Pipelines: readEnvFlag("SENTINEL_V2_PIPELINES"),
  sentinelTrendProxy: readEnvFlag("SENTINEL_TREND_PROXY"),
  sentinelSocial: readEnvFlag("SENTINEL_SOCIAL_ENABLED"),
  sentinelSerpApi: Boolean(process.env.SENTINEL_SERPAPI_KEY?.trim()),
  auditorFactCheck: readEnvFlag("AUDITOR_FACTCHECK_ENABLED"),
  auditorRealQueue: readEnvFlag("AUDITOR_V2_REAL_QUEUE"),
  productNavV2: readEnvFlag("NEXT_PUBLIC_PRODUCT_NAV_V2"),
  heygenDigitalTwin: readEnvFlag("NEXT_PUBLIC_HEYGEN_DIGITAL_TWIN_ENABLED"),
} as const;

/** Cache persistido: Supabase em prod; JSON local em dev; desligavel via env. */
export function isSentinelPersistCacheEnabled() {
  if (process.env.SENTINEL_PERSIST_CACHE?.trim()) {
    return readEnvFlag("SENTINEL_PERSIST_CACHE");
  }

  return Boolean(
    (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) ||
      canUseLocalFilesystem(),
  );
}

export function isSentinelLlmExpansionEnabled() {
  return featureFlags.sentinelLlmExpansion;
}

export function isSentinelV2PipelinesEnabled() {
  return featureFlags.sentinelV2Pipelines;
}

export function isSentinelTrendProxyEnabled() {
  return featureFlags.sentinelTrendProxy;
}

export function isSentinelSocialEnabled() {
  return featureFlags.sentinelSocial;
}

export function isSentinelSerpApiEnabled() {
  return featureFlags.sentinelSerpApi;
}

export function isAuditorFactCheckEnabled() {
  return featureFlags.auditorFactCheck;
}

export function isAuditorRealQueueEnabled() {
  return featureFlags.auditorRealQueue;
}

export function isProductNavV2Enabled() {
  return featureFlags.productNavV2;
}

/** Gêmeo digital HeyGen via vídeo de treino — desligado por padrão nesta versão. */
export function isHeygenDigitalTwinEnabled() {
  return featureFlags.heygenDigitalTwin;
}
