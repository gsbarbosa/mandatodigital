import { describe, expect, it } from "vitest";

import { shouldReuseExistingVoicePreviews } from "@/lib/voice-preview";
import type { ProfileVoiceSelection } from "@/lib/voice-preview-types";

function selection(
  overrides: Partial<ProfileVoiceSelection> = {},
): ProfileVoiceSelection {
  return {
    profileId: "p1",
    voiceAudioAssetId: "audio-new",
    elevenLabsVoiceId: "el-1",
    selectedPreviewId: "firme",
    previews: [
      {
        id: "firme",
        label: "Firme",
        description: "",
        storagePath: "x",
        audioUrl: "https://example.com/a.mp3",
        voiceSettings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0,
          use_speaker_boost: true,
        },
      },
    ],
    previewScript: "oi",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("shouldReuseExistingVoicePreviews", () => {
  it("nao reusa quando force=true (retreino)", () => {
    expect(
      shouldReuseExistingVoicePreviews({
        existing: selection(),
        voiceAudioAssetId: "audio-new",
        force: true,
      }),
    ).toBe(false);
  });

  it("nao reusa quando o asset de audio mudou", () => {
    expect(
      shouldReuseExistingVoicePreviews({
        existing: selection({ voiceAudioAssetId: "audio-old" }),
        voiceAudioAssetId: "audio-new",
        force: false,
      }),
    ).toBe(false);
  });

  it("reusa so no mesmo asset sem force", () => {
    expect(
      shouldReuseExistingVoicePreviews({
        existing: selection(),
        voiceAudioAssetId: "audio-new",
        force: false,
      }),
    ).toBe(true);
  });
});
