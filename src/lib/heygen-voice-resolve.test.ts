import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/heygen", () => ({
  heygenCloneVoice: vi.fn(),
  heygenDeleteVoice: vi.fn(),
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
  heygenDeleteVoice,
  heygenGetVoiceReadiness,
  heygenListAllPrivateVoices,
  heygenWaitForVoiceReady,
} from "@/lib/heygen";
import {
  HEYGEN_PRIVATE_VOICE_CLONE_LIMIT,
  HEYGEN_VOICE_CLONE_LIMIT_MESSAGE,
  buildHeyGenCloneVoiceName,
  pickPrivateVoicesEligibleForPrune,
  pickReusablePrivateVoice,
  resolveHeyGenClonedVoiceId,
  resolveHeyGenClonedVoiceIdWithRetry,
} from "@/lib/heygen-voice-resolve";

const cloneVoice = vi.mocked(heygenCloneVoice);
const deleteVoice = vi.mocked(heygenDeleteVoice);
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
          { voice_id: "b", name: "Maria (ab12cd34)" },
        ],
        "Maria (ab12cd34)",
      ),
    ).toBe("b");
  });

  it("nao faz match parcial pelo nome base (evita voz antiga apos troca de audio)", () => {
    expect(
      pickReusablePrivateVoice([{ voice_id: "x", name: "Maria (clone)" }], "Maria (deadbeef)"),
    ).toBeNull();
  });
});

describe("pickPrivateVoicesEligibleForPrune", () => {
  it("exclui ids protegidos", () => {
    const eligible = pickPrivateVoicesEligibleForPrune(
      [
        { voice_id: "keep", name: "A" },
        { voice_id: "drop", name: "B" },
      ],
      ["keep"],
    );
    expect(eligible.map((v) => v.voice_id)).toEqual(["drop"]);
  });
});

describe("buildHeyGenCloneVoiceName", () => {
  it("inclui prefixo do asset id", () => {
    expect(buildHeyGenCloneVoiceName("Maria", "deadbeef-uuid")).toBe("Maria (deadbeef)");
  });
});

describe("resolveHeyGenClonedVoiceId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    waitReady.mockImplementation(async (id: string) => id);
    deleteVoice.mockResolvedValue({ voiceId: "v-0", alreadyGone: false });
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

  it("no limite 10, apaga orfao e clona", async () => {
    const full = Array.from({ length: HEYGEN_PRIVATE_VOICE_CLONE_LIMIT }, (_, i) => ({
      voice_id: `v-${i}`,
      name: `Other ${i}`,
    }));
    listPrivate
      .mockResolvedValueOnce(full)
      .mockResolvedValueOnce(full.slice(1));
    cloneVoice.mockResolvedValue({ voiceId: "new-voice", raw: {} });

    const id = await resolveHeyGenClonedVoiceId({
      voiceName: "Maria (clone)",
      audio,
    });

    expect(deleteVoice).toHaveBeenCalledWith("v-0");
    expect(cloneVoice).toHaveBeenCalledOnce();
    expect(id).toBe("new-voice");
  });

  it("bloqueia se no limite e delete falha em todos os orfaos", async () => {
    listPrivate.mockResolvedValue(
      Array.from({ length: HEYGEN_PRIVATE_VOICE_CLONE_LIMIT }, (_, i) => ({
        voice_id: `v-${i}`,
        name: `Other ${i}`,
      })),
    );
    deleteVoice.mockRejectedValue(new Error("Voice is associated with an active template"));

    await expect(
      resolveHeyGenClonedVoiceId({
        voiceName: "Maria (clone)",
        audio,
      }),
    ).rejects.toThrow(HEYGEN_VOICE_CLONE_LIMIT_MESSAGE);
    expect(cloneVoice).not.toHaveBeenCalled();
    expect(deleteVoice).toHaveBeenCalled();
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
