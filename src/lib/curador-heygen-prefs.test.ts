import { describe, expect, it } from "vitest";

import {
  formatHeyGenAvatarGroupLockMessage,
  formatHeyGenPurgeFailureMessage,
  formatProviderLimitHint,
  sanitizeProviderFacingMessage,
  shouldInvalidateElevenLabsVoiceClone,
  shouldInvalidateHeygenVoiceClone,
} from "./curador-heygen-prefs";

describe("shouldInvalidateHeygenVoiceClone", () => {
  it("invalida quando o asset de audio mudou", () => {
    expect(
      shouldInvalidateHeygenVoiceClone(
        { heygenVoiceId: "v1", heygenVoiceAudioAssetId: "audio-a" },
        "audio-b",
      ),
    ).toBe(true);
  });

  it("mantem quando o asset e o mesmo", () => {
    expect(
      shouldInvalidateHeygenVoiceClone(
        { heygenVoiceId: "v1", heygenVoiceAudioAssetId: "audio-a" },
        "audio-a",
      ),
    ).toBe(false);
  });

  it("invalida se ha voz salva sem vinculo de audio (estado legado)", () => {
    expect(
      shouldInvalidateHeygenVoiceClone({ heygenVoiceId: "v1" }, "audio-a"),
    ).toBe(true);
  });
});

describe("shouldInvalidateElevenLabsVoiceClone", () => {
  it("invalida quando o asset de audio mudou", () => {
    expect(
      shouldInvalidateElevenLabsVoiceClone(
        { elevenLabsVoiceId: "el1", elevenLabsVoiceAudioAssetId: "audio-a" },
        "audio-b",
      ),
    ).toBe(true);
  });

  it("mantem quando o asset e o mesmo", () => {
    expect(
      shouldInvalidateElevenLabsVoiceClone(
        { elevenLabsVoiceId: "el1", elevenLabsVoiceAudioAssetId: "audio-a" },
        "audio-a",
      ),
    ).toBe(false);
  });
});

describe("formatHeyGenAvatarGroupLockMessage", () => {
  it("traduz bloqueio de modificacao com data", () => {
    const message = formatHeyGenAvatarGroupLockMessage(
      "Cannot modify this avatar group until 2026-07-01",
    );

    expect(message).toContain("01/07/2026");
    expect(message).toContain("bloqueado");
  });

  it("retorna null para mensagens sem bloqueio", () => {
    expect(formatHeyGenAvatarGroupLockMessage("Something else")).toBeNull();
  });
});

describe("sanitizeProviderFacingMessage", () => {
  it("remove fornecedores e CTAs obsoletos", () => {
    const message = sanitizeProviderFacingMessage(
      'Use "Utilizar Gêmeo Digital Atual" ou abra o painel HeyGen → Voice Library. OpenAI falhou.',
    );

    expect(message).not.toContain("HeyGen");
    expect(message).not.toContain("OpenAI");
    expect(message).toContain("use o gêmeo já treinado no Curador");
    expect(message).toContain("biblioteca de vozes do painel");
  });
});

describe("formatHeyGenPurgeFailureMessage", () => {
  it("prioriza erro de bloqueio do grupo", () => {
    const message = formatHeyGenPurgeFailureMessage([
      {
        groupId: "e9c915ac98bc4b27bbf5f4b605802d07",
        message: "Cannot modify this avatar group until 2026-07-01",
      },
    ]);

    expect(message).toContain("01/07/2026");
  });

  it("usa fallback quando nao ha erros", () => {
    expect(formatHeyGenPurgeFailureMessage(undefined, "Falha generica")).toBe(
      "Falha generica",
    );
  });
});

describe("formatProviderLimitHint", () => {
  it("explica limite de clones de voz", () => {
    const hint = formatProviderLimitHint(
      "Voice clone limit reached (10). Delete unused clones or contact support to increase your limit.",
    );
    expect(hint).toContain("Limite de clones de voz HeyGen");
    expect(hint).toContain("elevenlabs_audio");
  });
});
