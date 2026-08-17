import { describe, expect, it } from "vitest";

import { parseClientObservabilityEvent } from "./client-event";

describe("parseClientObservabilityEvent", () => {
  it("aceita falha de geracao com stage e ids de voz", () => {
    const parsed = parseClientObservabilityEvent({
      event: "video_generate_failed",
      surface: "criativo",
      stage: "voice_prepare",
      message: "Não foi possível preparar a voz na plataforma. Verifique o áudio enviado.",
      avatarTrack: "photo_real",
      voiceProvider: "elevenlabs_audio",
      hasVoiceAudioAsset: true,
      hasVoiceId: false,
      hasElevenLabsVoiceId: false,
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.event.stage).toBe("voice_prepare");
    expect(parsed.event.voiceProvider).toBe("elevenlabs_audio");
    expect(parsed.event.hasVoiceId).toBe(false);
    expect(parsed.event.hasVoiceAudioAsset).toBe(true);
  });

  it("rejeita evento desconhecido", () => {
    const parsed = parseClientObservabilityEvent({
      event: "arbitrary_hack",
      message: "x",
    });
    expect(parsed.ok).toBe(false);
  });

  it("remove nomes de provedor da mensagem", () => {
    const parsed = parseClientObservabilityEvent({
      event: "video_generate_failed",
      stage: "create_video",
      message: "Falha HeyGen / ElevenLabs no clone.",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.event.message).not.toMatch(/HeyGen|ElevenLabs/);
  });
});
