/**
 * Beacon de falha vista no browser. Fire-and-forget — não bloqueia a UI.
 * Sem PII: só stage, ids booleanos e a mensagem já exibida.
 */
export function reportClientObservabilityEvent(input: {
  event: "video_generate_failed";
  surface?: "criativo";
  stage: string;
  message: string;
  avatarTrack?: string;
  voiceProvider?: string;
  hasVoiceAudioAsset?: boolean;
  hasVoiceId?: boolean;
  hasElevenLabsVoiceId?: boolean;
}) {
  const message = input.message.trim();
  if (!message) {
    return;
  }

  try {
    void fetch("/api/observability/client-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: input.event,
        surface: input.surface ?? "criativo",
        stage: input.stage,
        message,
        avatarTrack: input.avatarTrack,
        voiceProvider: input.voiceProvider,
        hasVoiceAudioAsset: input.hasVoiceAudioAsset,
        hasVoiceId: input.hasVoiceId,
        hasElevenLabsVoiceId: input.hasElevenLabsVoiceId,
      }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // observabilidade nunca pode quebrar o fluxo do usuario
  }
}
