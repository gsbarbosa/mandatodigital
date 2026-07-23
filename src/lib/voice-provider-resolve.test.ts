import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/feature-flags", () => ({
  getHeyGenVoiceProvider: vi.fn(() => "elevenlabs_audio"),
}));

vi.mock("@/lib/elevenlabs", () => ({
  elevenLabsCloneVoice: vi.fn(),
  elevenLabsListVoices: vi.fn(),
  elevenLabsTextToSpeech: vi.fn(),
  elevenLabsVoiceExists: vi.fn(),
  formatElevenLabsError: (error: unknown) =>
    error instanceof Error ? error.message : String(error ?? ""),
  isElevenLabsIvcSubscriptionError: (error: unknown) => {
    const message = (
      error instanceof Error ? error.message : String(error ?? "")
    ).toLowerCase();
    return (
      message.includes("instant voice cloning") ||
      message.includes("does not include instant voice") ||
      (message.includes("upgrade your plan") && message.includes("voice"))
    );
  },
}));

vi.mock("@/lib/elevenlabs-tts-storage", () => ({
  storeElevenLabsTtsAudio: vi.fn(),
}));

vi.mock("@/lib/heygen-voice-resolve", () => ({
  buildHeyGenCloneVoiceName: vi.fn(
    (name: string, id: string) => `${name} (${id.slice(0, 8)})`,
  ),
  resolveHeyGenClonedVoiceId: vi.fn(),
  resolveHeyGenClonedVoiceIdWithRetry: vi.fn(),
}));

import { getHeyGenVoiceProvider } from "@/lib/feature-flags";
import {
  elevenLabsCloneVoice,
  elevenLabsListVoices,
  elevenLabsTextToSpeech,
  elevenLabsVoiceExists,
} from "@/lib/elevenlabs";
import { storeElevenLabsTtsAudio } from "@/lib/elevenlabs-tts-storage";
import { resolveHeyGenClonedVoiceId } from "@/lib/heygen-voice-resolve";
import {
  buildElevenLabsCloneVoiceName,
  pickReusableElevenLabsVoice,
  resolveElevenLabsVoiceId,
  resolveVideoSpeechForGeneration,
} from "@/lib/voice-provider-resolve";

const cloneVoice = vi.mocked(elevenLabsCloneVoice);
const listVoices = vi.mocked(elevenLabsListVoices);
const tts = vi.mocked(elevenLabsTextToSpeech);
const voiceExists = vi.mocked(elevenLabsVoiceExists);
const storeTts = vi.mocked(storeElevenLabsTtsAudio);
const getProvider = vi.mocked(getHeyGenVoiceProvider);
const heygenResolve = vi.mocked(resolveHeyGenClonedVoiceId);

describe("buildElevenLabsCloneVoiceName", () => {
  it("inclui prefixo do asset", () => {
    expect(buildElevenLabsCloneVoiceName("Maria", "deadbeef-uuid")).toBe(
      "Maria (deadbeef)",
    );
  });
});

describe("resolveElevenLabsVoiceId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reutiliza voiceId existente", async () => {
    voiceExists.mockResolvedValue(true);
    const id = await resolveElevenLabsVoiceId({
      requestedVoiceId: "el-1",
      voiceName: "Maria (deadbeef)",
      audioUrl: "https://example.com/a.mp3",
    });
    expect(id).toBe("el-1");
    expect(cloneVoice).not.toHaveBeenCalled();
  });

  it("clona quando solicitado falta ou sumiu e nao ha clone reutilizavel", async () => {
    voiceExists.mockResolvedValue(false);
    listVoices.mockResolvedValue([]);
    cloneVoice.mockResolvedValue({
      voiceId: "el-new",
      requiresVerification: false,
      raw: {},
    });
    const id = await resolveElevenLabsVoiceId({
      requestedVoiceId: "el-gone",
      voiceName: "Maria (deadbeef)",
      audioUrl: "https://example.com/a.mp3",
    });
    expect(id).toBe("el-new");
    expect(cloneVoice).toHaveBeenCalledOnce();
  });

  it("reutiliza clone existente pelo nome antes de clonar de novo", async () => {
    listVoices.mockResolvedValue([
      { voice_id: "el-existing", name: "Maria (deadbeef)" },
    ]);
    const id = await resolveElevenLabsVoiceId({
      requestedVoiceId: undefined,
      voiceName: "Maria (deadbeef)",
      audioUrl: "https://example.com/a.mp3",
    });
    expect(id).toBe("el-existing");
    expect(cloneVoice).not.toHaveBeenCalled();
  });

  it("clona de novo se a listagem de vozes falhar", async () => {
    listVoices.mockRejectedValue(new Error("timeout"));
    cloneVoice.mockResolvedValue({
      voiceId: "el-new",
      requiresVerification: false,
      raw: {},
    });
    const id = await resolveElevenLabsVoiceId({
      requestedVoiceId: undefined,
      voiceName: "Maria (deadbeef)",
      audioUrl: "https://example.com/a.mp3",
    });
    expect(id).toBe("el-new");
    expect(cloneVoice).toHaveBeenCalledOnce();
  });

  it("nao reclona quando forceReclone e voiceName vazio nao encontra nada", async () => {
    listVoices.mockResolvedValue([{ voice_id: "el-x", name: "Outra (aaaa)" }]);
    cloneVoice.mockResolvedValue({
      voiceId: "el-new",
      requiresVerification: false,
      raw: {},
    });
    const id = await resolveElevenLabsVoiceId({
      requestedVoiceId: "el-old",
      voiceName: "Maria (deadbeef)",
      audioUrl: "https://example.com/a.mp3",
      forceReclone: true,
    });
    expect(id).toBe("el-new");
    expect(listVoices).not.toHaveBeenCalled();
    expect(cloneVoice).toHaveBeenCalledOnce();
  });
});

describe("pickReusableElevenLabsVoice", () => {
  it("acha por nome normalizado (case/espacos)", () => {
    const id = pickReusableElevenLabsVoice(
      [{ voice_id: "el-1", name: "  Maria  (deadbeef)  " }],
      "maria (DEADBEEF)",
    );
    expect(id).toBe("el-1");
  });

  it("retorna null sem correspondencia", () => {
    const id = pickReusableElevenLabsVoice(
      [{ voice_id: "el-1", name: "Joao (aaaaaaaa)" }],
      "Maria (deadbeef)",
    );
    expect(id).toBeNull();
  });
});

describe("resolveVideoSpeechForGeneration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("path elevenlabs_audio: TTS + URL", async () => {
    getProvider.mockReturnValue("elevenlabs_audio");
    voiceExists.mockResolvedValue(true);
    tts.mockResolvedValue(Buffer.from("mp3"));
    storeTts.mockResolvedValue({
      audioUrl: "https://cdn.example/tts.mp3",
      storagePath: "tts/x.mp3",
    });

    const result = await resolveVideoSpeechForGeneration({
      transcript: "Ola mundo",
      avatarName: "Maria",
      voiceAudioAssetId: "deadbeef-1",
      voiceAudioUrl: "https://example.com/sample.mp3",
      requestedElevenLabsVoiceId: "el-1",
      mediaId: "job-1",
    });

    expect(result).toEqual({
      provider: "elevenlabs_audio",
      elevenLabsVoiceId: "el-1",
      audioUrl: "https://cdn.example/tts.mp3",
    });
    expect(heygenResolve).not.toHaveBeenCalled();
  });

  it("path heygen_clone: resolve voice_id", async () => {
    getProvider.mockReturnValue("heygen_clone");
    heygenResolve.mockResolvedValue("hg-1");

    const result = await resolveVideoSpeechForGeneration({
      transcript: "Ola",
      avatarName: "Maria",
      voiceAudioAssetId: "deadbeef-1",
      voiceAudioUrl: "https://example.com/sample.mp3",
      requestedHeygenVoiceId: "hg-1",
      mediaId: "job-1",
    });

    expect(result).toEqual({ provider: "heygen_clone", voiceId: "hg-1" });
    expect(tts).not.toHaveBeenCalled();
  });

  it("fallback heygen_clone quando ElevenLabs nao tem IVC no plano", async () => {
    getProvider.mockReturnValue("elevenlabs_audio");
    listVoices.mockResolvedValue([]);
    cloneVoice.mockRejectedValue(
      new Error(
        "Your subscription does not include instant voice cloning. Please upgrade your plan.",
      ),
    );
    heygenResolve.mockResolvedValue("hg-fallback");

    const result = await resolveVideoSpeechForGeneration({
      transcript: "Ola",
      avatarName: "Maria",
      voiceAudioAssetId: "deadbeef-1",
      voiceAudioUrl: "https://example.com/sample.mp3",
      requestedHeygenVoiceId: "hg-1",
      mediaId: "job-1",
    });

    expect(result).toEqual({
      provider: "heygen_clone",
      voiceId: "hg-fallback",
      fallbackFromElevenLabs: true,
    });
    expect(tts).not.toHaveBeenCalled();
    expect(heygenResolve).toHaveBeenCalledOnce();
  });
});
