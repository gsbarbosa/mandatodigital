import { describe, expect, it } from "vitest";

import {
  HEYGEN_TRAINING_VIDEO_TARGET_MAX_BYTES,
  trainingVideoNeedsTranscode,
} from "@/lib/training-video-transcode";

describe("trainingVideoNeedsTranscode", () => {
  it("detecta mov e arquivos acima de 32 MB", () => {
    expect(
      trainingVideoNeedsTranscode({
        buffer: Buffer.alloc(1024),
        mimeType: "video/quicktime",
        filename: "treino.mov",
      }),
    ).toBe(true);

    expect(
      trainingVideoNeedsTranscode({
        buffer: Buffer.alloc(33 * 1024 * 1024),
        mimeType: "video/mp4",
        filename: "treino.mp4",
      }),
    ).toBe(true);
  });

  it("mantem mp4 pequeno sem transcode", () => {
    expect(
      trainingVideoNeedsTranscode({
        buffer: Buffer.alloc(5 * 1024 * 1024),
        mimeType: "video/mp4",
        filename: "treino.mp4",
      }),
    ).toBe(false);
  });

  it("define alvo abaixo do limite da HeyGen", () => {
    expect(HEYGEN_TRAINING_VIDEO_TARGET_MAX_BYTES).toBeLessThan(32 * 1024 * 1024);
  });
});
