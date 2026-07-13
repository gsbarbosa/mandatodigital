import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/heygen", () => ({
  heygenCloneVoice: vi.fn(),
  heygenGetVoiceReadiness: vi.fn(),
  heygenListAllPrivateVoices: vi.fn(),
  heygenWaitForVoiceReady: vi.fn(async (id: string) => id),
  isHeyGenVoiceGenerationError: vi.fn((error: unknown) => {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    return message.includes("not found") || message.includes("voice_not_found");
  }),
}));

import {
  heygenCloneVoice,
  heygenGetVoiceReadiness,
  heygenListAllPrivateVoices,
  heygenWaitForVoiceReady,
} from "@/lib/heygen";
import {
  HEYGEN_PRIVATE_VOICE_CLONE_LIMIT,
  HEYGEN_VOICE_CLONE_LIMIT_MESSAGE,
  pickReusablePrivateVoice,
  resolveHeyGenClonedVoiceId,
  resolveHeyGenClonedVoiceIdWithRetry,
} from "@/lib/heygen-voice-resolve";

const cloneVoice = vi.mocked(heygenCloneVoice);
const getReadiness = vi.mocked(heygenGetVoiceReadiness);
const listPrivate = vi.mocked(heygenListAllPrivateVoices);
const waitReady = vi.mocked(heygenWaitForVoiceReady);

const audio = { type: "url" as const, url: "https://example.com/voice.wav" };

describe("pickReusablePrivateVoice", () => {
  it("prioriza nome exato", () => {
    expect(
      pickReusablePrivateVoice(
        [
          { voice_id: "a", name: "Outro" },
          { voice_id: "b", name: "Maria (clone)" },
        ],
        "Maria (clone)",
      ),
    ).toBe("b");
  });

  it("aceita partial com base sem (clone)", () => {
    expect(
      pickReusablePrivateVoice([{ voice_id: "x", name: "Maria Campaign Voice" }], "Maria (clone)"),
    ).toBe("x");
  });
});

describe("resolveHeyGenClonedVoiceId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    waitReady.mockImplementation(async (id: string) => id);
  });

  it("reutiliza requestedVoiceId ready sem listar/clonar", async () => {
    getReadiness.mockResolvedValue("ready");
    const id = await resolveHeyGenClonedVoiceId({
      requestedVoiceId: "voice-1",
      voiceName: "Maria (clone)",
      audio,
    });
    expect(id).toBe("voice-1");
    expect(listPrivate).not.toHaveBeenCalled();
    expect(cloneVoice).not.toHaveBeenCalled();
  });

  it("reutiliza privado pelo nome quando requested falta", async () => {
    listPrivate.mockResolvedValue([{ voice_id: "reuse-me", name: "Maria (clone)" }]);
    getReadiness.mockResolvedValue("ready");
    const id = await resolveHeyGenClonedVoiceId({
      voiceName: "Maria (clone)",
      audio,
    });
    expect(id).toBe("reuse-me");
    expect(cloneVoice).not.toHaveBeenCalled();
  });

  it("bloqueia clone novo no limite 10", async () => {
    listPrivate.mockResolvedValue(
      Array.from({ length: HEYGEN_PRIVATE_VOICE_CLONE_LIMIT }, (_, i) => ({
        voice_id: `v-${i}`,
        name: `Other ${i}`,
      })),
    );
    await expect(
      resolveHeyGenClonedVoiceId({
        voiceName: "Maria (clone)",
        audio,
      }),
    ).rejects.toThrow(HEYGEN_VOICE_CLONE_LIMIT_MESSAGE);
    expect(cloneVoice).not.toHaveBeenCalled();
  });

  it("clona quando há slot e nenhum reuso", async () => {
    listPrivate.mockResolvedValue([{ voice_id: "v-0", name: "Outro" }]);
    cloneVoice.mockResolvedValue({ voiceId: "new-voice", raw: {} });
    getReadiness.mockResolvedValue("ready");
    const id = await resolveHeyGenClonedVoiceId({
      voiceName: "Maria (clone)",
      audio,
    });
    expect(id).toBe("new-voice");
    expect(cloneVoice).toHaveBeenCalledOnce();
  });
});

describe("resolveHeyGenClonedVoiceIdWithRetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    waitReady.mockImplementation(async (id: string) => id);
  });

  it("nao forceReclone quando a voz ainda esta ready apos erro de lookup", async () => {
    getReadiness.mockResolvedValue("ready");
    listPrivate.mockResolvedValue([]);

    const run = vi
      .fn()
      .mockRejectedValueOnce(new Error("voice_not_found"))
      .mockResolvedValueOnce("ok");

    const result = await resolveHeyGenClonedVoiceIdWithRetry({
      requestedVoiceId: "voice-keep",
      voiceName: "Maria (clone)",
      audio,
      run,
    });

    expect(result).toEqual({ voiceId: "voice-keep", value: "ok" });
    expect(cloneVoice).not.toHaveBeenCalled();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("reclona so quando readiness e missing", async () => {
    getReadiness
      .mockResolvedValueOnce("ready") // resolve inicial com requested
      .mockResolvedValueOnce("missing") // apos erro
      .mockResolvedValueOnce("ready"); // apos clone (wait)
    listPrivate.mockResolvedValue([]);
    cloneVoice.mockResolvedValue({ voiceId: "voice-new", raw: {} });

    const run = vi
      .fn()
      .mockRejectedValueOnce(new Error("voice_not_found"))
      .mockResolvedValueOnce("ok");

    const result = await resolveHeyGenClonedVoiceIdWithRetry({
      requestedVoiceId: "voice-old",
      voiceName: "Maria (clone)",
      audio,
      run,
    });

    expect(result.voiceId).toBe("voice-new");
    expect(cloneVoice).toHaveBeenCalledOnce();
  });
});
