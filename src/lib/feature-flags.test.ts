import { afterEach, describe, expect, it } from "vitest";

import {
  featureFlags,
  isAuditorFactCheckEnabled,
  isSentinelLlmExpansionEnabled,
  isSentinelLlmThemeVerifyEnabled,
  isSentinelLlmQualityRankEnabled,
  isSentinelPersistCacheEnabled,
  isSentinelSocialEnabled,
  isSentinelTrendProxyEnabled,
  isSentinelV2PipelinesEnabled,
} from "@/lib/feature-flags";

const ENV_KEYS = [
  "SENTINEL_LLM_EXPANSION",
  "SENTINEL_LLM_THEME_VERIFY",
  "SENTINEL_LLM_QUALITY_RANK",
  "SENTINEL_V2_PIPELINES",
  "SENTINEL_TREND_PROXY",
  "SENTINEL_SOCIAL_ENABLED",
  "SENTINEL_PERSIST_CACHE",
  "AUDITOR_FACTCHECK_ENABLED",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe("feature-flags", () => {
  it("mantem flags de Fase 1+ desligadas por default", () => {
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }

    expect(isSentinelLlmExpansionEnabled()).toBe(false);
    expect(isSentinelLlmThemeVerifyEnabled()).toBe(false);
    expect(isSentinelLlmQualityRankEnabled()).toBe(false);
    expect(isSentinelV2PipelinesEnabled()).toBe(false);
    expect(isSentinelTrendProxyEnabled()).toBe(false);
    expect(isSentinelSocialEnabled()).toBe(false);
    expect(isAuditorFactCheckEnabled()).toBe(false);
    expect(featureFlags.auditorRealQueue).toBe(false);
  });

  it("liga persistencia quando Supabase esta configurado", () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

    expect(isSentinelPersistCacheEnabled()).toBe(true);
  });

  it("respeita SENTINEL_PERSIST_CACHE=false mesmo com Supabase", () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    process.env.SENTINEL_PERSIST_CACHE = "false";

    expect(isSentinelPersistCacheEnabled()).toBe(false);
  });
});
