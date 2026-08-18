import { describe, expect, it } from "vitest";

import {
  VOICE_RECORDER_AUDIO_BITS_PER_SECOND,
  VOICE_RECORDER_AUDIO_CONSTRAINTS,
} from "@/lib/voice-recorder-constraints";

describe("VOICE_RECORDER_AUDIO_CONSTRAINTS", () => {
  it("nao aplica processamento de ligacao no microfone", () => {
    expect(VOICE_RECORDER_AUDIO_CONSTRAINTS.echoCancellation).toBe(false);
    expect(VOICE_RECORDER_AUDIO_CONSTRAINTS.noiseSuppression).toBe(false);
    expect(VOICE_RECORDER_AUDIO_CONSTRAINTS.autoGainControl).toBe(false);
    expect(VOICE_RECORDER_AUDIO_CONSTRAINTS.channelCount).toBe(1);
  });

  it("pede bitrate acima de nota de WhatsApp", () => {
    expect(VOICE_RECORDER_AUDIO_BITS_PER_SECOND).toBeGreaterThanOrEqual(128_000);
  });
});
