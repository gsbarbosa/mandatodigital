import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/feature-flags", () => ({
  getHeyGenVoiceProvider: vi.fn(() => "elevenlabs_audio"),
}));

vi.mock("@/lib/elevenlabs-ivc-lock", () => ({
  withElevenLabsIvcSlot: vi.fn(async (fn: () => Promise<unknown>) => fn()),
}));

vi.mock("@/lib/elevenlabs", () => ({
  elevenLabsCloneVoice: vi.fn(),
  elevenLabsDeleteVoice: vi.fn(),
  elevenLabsListVoices: vi.fn(),
  elevenLabsPurgeEphemeralVoices: vi.fn(),
  elevenLabsTextToSpeech: vi.fn(),
  elevenLabsVoiceExists: vi.fn(),
  formatElevenLabsError: (error: unknown) =>
    error instanceof Error ? error.message : String(error ?? ""),
  isElevenLabsCustomVoiceLimitError: (error: unknown) => {
    const message = (
      error instanceof Error ? error.message : String(error ?? "")
    ).toLowerCase();
    return (
      message.includes("maximum amount of custom voices") ||
      message.includes("custom voice limit")
    );
  },
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
  elevenLabsDeleteVoice,
  elevenLabsListVoices,
  elevenLabsPurgeEphemeralVoices,
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
const deleteVoice = vi.mocked(elevenLabsDeleteVoice);
const listVoices = vi.mocked(elevenLabsListVoices);
const purgeVoices = vi.mocked(elevenLabsPurgeEphemeralVoices);
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
    const resolved = await resolveElevenLabsVoiceId({
      requestedVoiceId: "el-1",
      voiceName: "Maria (deadbeef)",
      audioUrl: "https://example.com/a.mp3",
    });
    expect(resolved).toEqual({ voiceId: "el-1", created: false });
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
    const resolved = await resolveElevenLabsVoiceId({
      requestedVoiceId: "el-gone",
      voiceName: "Maria (deadbeef)",
      audioUrl: "https://example.com/a.mp3",
    });
    expect(resolved).toEqual({ voiceId: "el-new", created: true });
    expect(cloneVoice).toHaveBeenCalledOnce();
  });

  it("reutiliza clone existente pelo nome antes de clonar de novo", async () => {
    listVoices.mockResolvedValue([
      { voice_id: "el-existing", name: "Maria (deadbeef)" },
    ]);
    const resolved = await resolveElevenLabsVoiceId({
      requestedVoiceId: undefined,
      voiceName: "Maria (deadbeef)",
      audioUrl: "https://example.com/a.mp3",
    });
    expect(resolved).toEqual({ voiceId: "el-existing", created: false });
    expect(cloneVoice).not.toHaveBeenCalled();
  });

  it("clona de novo se a listagem de vozes falhar", async () => {
    listVoices.mockRejectedValue(new Error("timeout"));
    cloneVoice.mockResolvedValue({
      voiceId: "el-new",
      requiresVerification: false,
      raw: {},
    });
    const resolved = await resolveElevenLabsVoiceId({
      requestedVoiceId: undefined,
      voiceName: "Maria (deadbeef)",
      audioUrl: "https://example.com/a.mp3",
    });
    expect(resolved).toEqual({ voiceId: "el-new", created: true });
    expect(cloneVoice).toHaveBeenCalledOnce();
  });

  it("nao reclona quando forceReclone e voiceName vazio nao encontra nada", async () => {
    listVoices.mockResolvedValue([{ voice_id: "el-x", name: "Outra (aaaa)" }]);
    cloneVoice.mockResolvedValue({
      voiceId: "el-new",
      requiresVerification: false,
      raw: {},
    });
    const resolved = await resolveElevenLabsVoiceId({
      requestedVoiceId: "el-old",
      voiceName: "Maria (deadbeef)",
      audioUrl: "https://example.com/a.mp3",
      forceReclone: true,
    });
    expect(resolved).toEqual({ voiceId: "el-new", created: true });
    expect(listVoices).not.toHaveBeenCalled();
    expect(cloneVoice).toHaveBeenCalledOnce();
  });

  it("purga efemeros e retenta quando bate no limite 10/10", async () => {
    listVoices.mockResolvedValue([]);
    cloneVoice
      .mockRejectedValueOnce(
        new Error(
          "You have reached your maximum amount of custom voices (10 / 10).",
        ),
      )
      .mockResolvedValueOnce({
        voiceId: "el-after-purge",
        requiresVerification: false,
        raw: {},
      });
    purgeVoices.mockResolvedValue({ scanned: 10, deleted: 10 });

    const resolved = await resolveElevenLabsVoiceId({
      voiceName: "Maria (deadbeef)",
      audioUrl: "https://example.com/a.mp3",
    });

    expect(purgeVoices).toHaveBeenCalledOnce();
    expect(cloneVoice).toHaveBeenCalledTimes(2);
    expect(resolved).toEqual({ voiceId: "el-after-purge", created: true });
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
    deleteVoice.mockResolvedValue({ alreadyGone: false });
  });

  it("path elevenlabs_audio: TTS + URL + delete voice efemera", async () => {
    getProvider.mockReturnValue("elevenlabs_audio");
    voiceExists.mockResolvedValue(true);
    tts.mockResolvedValue(Buffer.from("mp3"));
    storeTts.mockResolvedValue({
      audioUrl: "https://cdn.example/tts.mp3",
      storagePath: "compliance/tts/temp/x.mp3",
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
      elevenLabsVoiceId: null,
      audioUrl: "https://cdn.example/tts.mp3",
      storagePath: "compliance/tts/temp/x.mp3",
      voiceDeleted: true,
    });
    expect(deleteVoice).toHaveBeenCalledWith("el-1");
    expect(heygenResolve).not.toHaveBeenCalled();
  });

  it("reusa checkpoint de audio sem clonar nem TTS", async () => {
    getProvider.mockReturnValue("elevenlabs_audio");

    const result = await resolveVideoSpeechForGeneration({
      transcript: "Ola mundo",
      avatarName: "Maria",
      voiceAudioAssetId: "deadbeef-1",
      voiceAudioUrl: "https://example.com/sample.mp3",
      mediaId: "job-1",
      existingAudioUrl: "https://cdn.example/checkpoint.mp3",
      existingStoragePath: "compliance/tts/temp/checkpoint.mp3",
    });

    expect(result).toEqual({
      provider: "elevenlabs_audio",
      elevenLabsVoiceId: null,
      audioUrl: "https://cdn.example/checkpoint.mp3",
      storagePath: "compliance/tts/temp/checkpoint.mp3",
      voiceDeleted: true,
    });
    expect(cloneVoice).not.toHaveBeenCalled();
    expect(tts).not.toHaveBeenCalled();
    expect(deleteVoice).not.toHaveBeenCalled();
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
