import { afterEach, describe, expect, it } from "vitest";

import {
  getHeyGenVoiceProvider,
  isAsyncSealEnabled,
  isAsyncVoiceEnabled,
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
  "HEYGEN_VOICE_PROVIDER",
  "ASYNC_SEAL_ENABLED",
  "NEXT_PUBLIC_ASYNC_SEAL_ENABLED",
  "ASYNC_VOICE_ENABLED",
  "NEXT_PUBLIC_ASYNC_VOICE_ENABLED",
  "FIREBASE_SERVICE_ACCOUNT_JSON",
  "FIREBASE_CONFIG",
  "K_SERVICE",
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
  });

  it("liga persistencia quando Firebase Admin esta configurado", () => {
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = '{"type":"service_account"}';
    delete process.env.SENTINEL_PERSIST_CACHE;

    expect(isSentinelPersistCacheEnabled()).toBe(true);
  });

  it("respeita SENTINEL_PERSIST_CACHE=false mesmo com Firebase Admin", () => {
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = '{"type":"service_account"}';
    process.env.SENTINEL_PERSIST_CACHE = "false";

    expect(isSentinelPersistCacheEnabled()).toBe(false);
  });

  it("default HeyGen voice provider e heygen_clone", () => {
    delete process.env.HEYGEN_VOICE_PROVIDER;
    expect(getHeyGenVoiceProvider()).toBe("heygen_clone");
  });

  it("aceita HEYGEN_VOICE_PROVIDER=elevenlabs_audio", () => {
    process.env.HEYGEN_VOICE_PROVIDER = "elevenlabs_audio";
    expect(getHeyGenVoiceProvider()).toBe("elevenlabs_audio");
  });

  it("flags async jobs desligadas por default", () => {
    delete process.env.ASYNC_SEAL_ENABLED;
    delete process.env.NEXT_PUBLIC_ASYNC_SEAL_ENABLED;
    delete process.env.ASYNC_VOICE_ENABLED;
    delete process.env.NEXT_PUBLIC_ASYNC_VOICE_ENABLED;
    expect(isAsyncSealEnabled()).toBe(false);
    expect(isAsyncVoiceEnabled()).toBe(false);
  });

  it("liga ASYNC_SEAL e ASYNC_VOICE via env", () => {
    process.env.ASYNC_SEAL_ENABLED = "true";
    process.env.ASYNC_VOICE_ENABLED = "1";
    expect(isAsyncSealEnabled()).toBe(true);
    expect(isAsyncVoiceEnabled()).toBe(true);
  });
});
