import fs from "node:fs";

import { describe, expect, it } from "vitest";

import { resolveFfmpegBinary } from "@/lib/ffmpeg-binary";

describe("resolveFfmpegBinary", () => {
  it("encontra o binario do ffmpeg-static ou o ffmpeg do PATH", () => {
    const binary = resolveFfmpegBinary();

    if (binary === "ffmpeg") {
      expect(binary).toBe("ffmpeg");
      return;
    }

    expect(fs.existsSync(binary)).toBe(true);
    expect(binary).not.toContain("/ROOT/");
  });
});
