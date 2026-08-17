import { sanitizeProviderFacingMessage } from "@/lib/curador-heygen-prefs";

export const CLIENT_OBSERVABILITY_EVENTS = ["video_generate_failed"] as const;
export const CLIENT_OBSERVABILITY_STAGES = [
  "precheck",
  "train",
  "voice_prepare",
  "create_video",
  "poll_video",
  "seal",
  "unknown",
] as const;
export const CLIENT_OBSERVABILITY_SURFACES = ["criativo"] as const;

export type ClientObservabilityEventName = (typeof CLIENT_OBSERVABILITY_EVENTS)[number];
export type ClientObservabilityStage = (typeof CLIENT_OBSERVABILITY_STAGES)[number];
export type ClientObservabilitySurface = (typeof CLIENT_OBSERVABILITY_SURFACES)[number];

export type ParsedClientObservabilityEvent = {
  event: ClientObservabilityEventName;
  surface: ClientObservabilitySurface;
  stage: ClientObservabilityStage;
  message: string;
  avatarTrack: string | null;
  voiceProvider: string | null;
  hasVoiceAudioAsset: boolean | null;
  hasVoiceId: boolean | null;
  hasElevenLabsVoiceId: boolean | null;
};

const AVATAR_TRACKS = new Set(["realistic", "caricature", "photo_real"]);
const VOICE_PROVIDERS = new Set(["elevenlabs_audio", "heygen_clone"]);
const MAX_MESSAGE_CHARS = 360;

function pickAllowed(list: readonly string[], value: unknown, fallback: string) {
  const raw = String(value ?? "").trim();
  return list.includes(raw) ? raw : fallback;
}

function pickOptionalSet(allowed: Set<string>, value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return null;
  }
  return allowed.has(raw) ? raw : null;
}

function pickOptionalBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

export function parseClientObservabilityEvent(
  body: unknown,
): { ok: true; event: ParsedClientObservabilityEvent } | { ok: false; message: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, message: "Payload invalido." };
  }

  const raw = body as Record<string, unknown>;
  const event = pickAllowed(CLIENT_OBSERVABILITY_EVENTS, raw.event, "");
  if (!event) {
    return { ok: false, message: "Evento de observabilidade nao suportado." };
  }

  const message = sanitizeProviderFacingMessage(String(raw.message ?? "").trim()).slice(
    0,
    MAX_MESSAGE_CHARS,
  );
  if (!message) {
    return { ok: false, message: "Informe a mensagem exibida ao usuario." };
  }

  return {
    ok: true,
    event: {
      event: event as ClientObservabilityEventName,
      surface: pickAllowed(CLIENT_OBSERVABILITY_SURFACES, raw.surface, "criativo") as ClientObservabilitySurface,
      stage: pickAllowed(CLIENT_OBSERVABILITY_STAGES, raw.stage, "unknown") as ClientObservabilityStage,
      message,
      avatarTrack: pickOptionalSet(AVATAR_TRACKS, raw.avatarTrack),
      voiceProvider: pickOptionalSet(VOICE_PROVIDERS, raw.voiceProvider),
      hasVoiceAudioAsset: pickOptionalBoolean(raw.hasVoiceAudioAsset),
      hasVoiceId: pickOptionalBoolean(raw.hasVoiceId),
      hasElevenLabsVoiceId: pickOptionalBoolean(raw.hasElevenLabsVoiceId),
    },
  };
}

export function clientObservabilityLogFields(event: ParsedClientObservabilityEvent) {
  return {
    eventName: event.event,
    surface: event.surface,
    stage: event.stage,
    message: event.message,
    avatarTrack: event.avatarTrack,
    voiceProvider: event.voiceProvider,
    hasVoiceAudioAsset: event.hasVoiceAudioAsset,
    hasVoiceId: event.hasVoiceId,
    hasElevenLabsVoiceId: event.hasElevenLabsVoiceId,
  };
}
