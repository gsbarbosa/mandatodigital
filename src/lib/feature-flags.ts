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
  /** IA de resgate de esfera zerada — escolhe ou rejeita, em vez de pegar cego por score. */
  sentinelLlmSphereRescue: readEnvFlag("SENTINEL_LLM_SPHERE_RESCUE"),
  /** Radar de Bairro (mecanismo isolado do Sentinela). */
  radarBairro: readEnvFlag("RADAR_BAIRRO_ENABLED"),
  radarBairroLlm: readEnvFlag("RADAR_BAIRRO_LLM_ENABLED"),
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

export function isSentinelLlmSphereRescueEnabled() {
  return featureFlags.sentinelLlmSphereRescue;
}

/**
 * Radar de Bairro — coleta de grupos de bairro no Facebook. Off por default:
 * envolve conteúdo público de terceiros e ainda depende do parecer jurídico
 * (LGPD + período eleitoral). Ver docs/radar-de-bairro.md.
 */
export function isRadarBairroEnabled() {
  return featureFlags.radarBairro;
}

/**
 * Estágio 2 do filtro (LLM). Separado da flag principal pra dar pra ligar a
 * coleta sem gastar LLM — mas sem ele a tela fica vazia de propósito: sem
 * julgamento semântico o que passa é majoritariamente ruído.
 */
export function isRadarBairroLlmEnabled() {
  return featureFlags.radarBairroLlm;
}

/** Selagem FFmpeg via job async (Pub/Sub / worker). */
export function isAsyncSealEnabled() {
  return readEnvFlag("ASYNC_SEAL_ENABLED") || readEnvFlag("NEXT_PUBLIC_ASYNC_SEAL_ENABLED");
}

/** TTS ElevenLabs + create video via job async (Fase 2). */
export function isAsyncVoiceEnabled() {
  return readEnvFlag("ASYNC_VOICE_ENABLED") || readEnvFlag("NEXT_PUBLIC_ASYNC_VOICE_ENABLED");
}

/** Agente Distribuidor — publicação em redes (fail-closed até smoke). */
export function isDistributionEnabled() {
  return (
    readEnvFlag("DISTRIBUTION_ENABLED") || readEnvFlag("NEXT_PUBLIC_DISTRIBUTION_ENABLED")
  );
}

/** Enfileira publish_post via Pub/Sub/worker (pode ficar off com Distribuidor só em draft). */
export function isDistributionPublishEnabled() {
  return (
    readEnvFlag("DISTRIBUTION_PUBLISH_ENABLED") ||
    readEnvFlag("NEXT_PUBLIC_DISTRIBUTION_PUBLISH_ENABLED")
  );
}
