import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/feature-flags", () => ({
  getHeyGenVoiceProvider: vi.fn(() => "elevenlabs_audio"),
}));

vi.mock("@/lib/elevenlabs", () => ({
  elevenLabsCloneVoice: vi.fn(),
  elevenLabsTextToSpeech: vi.fn(),
  elevenLabsVoiceExists: vi.fn(),
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
  elevenLabsTextToSpeech,
  elevenLabsVoiceExists,
} from "@/lib/elevenlabs";
import { storeElevenLabsTtsAudio } from "@/lib/elevenlabs-tts-storage";
import { resolveHeyGenClonedVoiceId } from "@/lib/heygen-voice-resolve";
import {
  buildElevenLabsCloneVoiceName,
  resolveElevenLabsVoiceId,
  resolveVideoSpeechForGeneration,
} from "@/lib/voice-provider-resolve";

const cloneVoice = vi.mocked(elevenLabsCloneVoice);
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

  it("clona quando solicitado falta ou sumiu", async () => {
    voiceExists.mockResolvedValue(false);
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
});
