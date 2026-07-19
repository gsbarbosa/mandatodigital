/**
 * Feature flags da roadmap Sentinela / Validador / MVP.
 * Defaults conservadores: tudo desligado = comportamento atual em producao.
 */

import { hasFirebaseServiceAccount } from "@/lib/firebase/env";

function readEnvFlag(name: string) {
  const value = process.env[name]?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

/** Voz do Criativo: TTS ElevenLabs → audio_url HeyGen, ou clone nativo HeyGen. */
export type HeyGenVoiceProvider = "elevenlabs_audio" | "heygen_clone";

export function getHeyGenVoiceProvider(): HeyGenVoiceProvider {
  const value = process.env.HEYGEN_VOICE_PROVIDER?.trim().toLowerCase();
  if (value === "elevenlabs_audio") {
    return "elevenlabs_audio";
  }
  return "heygen_clone";
}

export function isElevenLabsAudioVoiceProvider() {
  return getHeyGenVoiceProvider() === "elevenlabs_audio";
}

export const featureFlags = {
  sentinelLlmExpansion: readEnvFlag("SENTINEL_LLM_EXPANSION"),
  sentinelV2Pipelines: readEnvFlag("SENTINEL_V2_PIPELINES"),
  sentinelTrendProxy: readEnvFlag("SENTINEL_TREND_PROXY"),
  sentinelSocial: readEnvFlag("SENTINEL_SOCIAL_ENABLED"),
  sentinelSerpApi: Boolean(process.env.SENTINEL_SERPAPI_KEY?.trim()),
  auditorFactCheck: readEnvFlag("AUDITOR_FACTCHECK_ENABLED"),
  sentinelLlmThemeVerify: readEnvFlag("SENTINEL_LLM_THEME_VERIFY"),
  /** Spike qualidade: LLM mini só no top N (off por default). */
  sentinelLlmQualityRank: readEnvFlag("SENTINEL_LLM_QUALITY_RANK"),
  heygenVoiceProvider: getHeyGenVoiceProvider(),
} as const;

/** Cache persistido no Firestore; desligavel via SENTINEL_PERSIST_CACHE=false. */
export function isSentinelPersistCacheEnabled() {
  if (process.env.SENTINEL_PERSIST_CACHE?.trim()) {
    return readEnvFlag("SENTINEL_PERSIST_CACHE");
  }

  return hasFirebaseServiceAccount();
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
  return readEnvFlag("SENTINEL_SOCIAL_ENABLED");
}

export function isSentinelSerpApiEnabled() {
  return featureFlags.sentinelSerpApi;
}

export function isAuditorFactCheckEnabled() {
  return featureFlags.auditorFactCheck;
}

export function isSentinelLlmThemeVerifyEnabled() {
  return featureFlags.sentinelLlmThemeVerify;
}

export function isSentinelLlmQualityRankEnabled() {
  return featureFlags.sentinelLlmQualityRank;
}

/** Selagem FFmpeg via job async (Pub/Sub / worker). */
export function isAsyncSealEnabled() {
  return readEnvFlag("ASYNC_SEAL_ENABLED") || readEnvFlag("NEXT_PUBLIC_ASYNC_SEAL_ENABLED");
}

/** TTS ElevenLabs + create video via job async (Fase 2). */
export function isAsyncVoiceEnabled() {
  return readEnvFlag("ASYNC_VOICE_ENABLED") || readEnvFlag("NEXT_PUBLIC_ASYNC_VOICE_ENABLED");
}
