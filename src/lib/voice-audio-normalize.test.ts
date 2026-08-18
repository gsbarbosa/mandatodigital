import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  detectVoiceAudioFormat,
  extensionForVoiceFormat,
  mimeTypeForVoiceFormat,
  normalizeVoiceSampleForClone,
  voiceSampleNeedsTranscode,
} from "@/lib/voice-audio-normalize";

function oggOpusBuffer() {
  const head = Buffer.alloc(64, 0);
  Buffer.from("OggS", "ascii").copy(head, 0);
  Buffer.from("OpusHead", "ascii").copy(head, 28);
  return head;
}

describe("detectVoiceAudioFormat", () => {
  it("detecta Opus do WhatsApp pelo magic OpusHead", () => {
    expect(
      detectVoiceAudioFormat({
        buffer: oggOpusBuffer(),
        mimeType: "audio/ogg",
        filename: "WhatsApp Audio 2026-04-28 at 12.04.51.opus",
      }),
    ).toBe("opus");
  });

  it("detecta OGG sem OpusHead", () => {
    expect(
      detectVoiceAudioFormat({
        buffer: Buffer.from("OggS\0vorbis-header", "ascii"),
        mimeType: "audio/ogg",
        filename: "sample.ogg",
      }),
    ).toBe("ogg");
  });

  it("detecta WAV pelo RIFF/WAVE", () => {
    const buf = Buffer.from("RIFF    WAVEfmt ", "ascii");
    expect(detectVoiceAudioFormat({ buffer: buf, mimeType: "audio/wav" })).toBe(
      "wav",
    );
  });

  it("cai no filename .opus quando o mime é octet-stream", () => {
    expect(
      detectVoiceAudioFormat({
        buffer: Buffer.from("not-a-header"),
        mimeType: "application/octet-stream",
        filename: "nota.opus",
      }),
    ).toBe("opus");
  });
});

describe("voiceSampleNeedsTranscode", () => {
  it("converte opus/ogg/webm e mantém wav/mp3", () => {
    expect(voiceSampleNeedsTranscode("opus")).toBe(true);
    expect(voiceSampleNeedsTranscode("ogg")).toBe(true);
    expect(voiceSampleNeedsTranscode("webm")).toBe(true);
    expect(voiceSampleNeedsTranscode("unknown")).toBe(true);
    expect(voiceSampleNeedsTranscode("wav")).toBe(false);
    expect(voiceSampleNeedsTranscode("mp3")).toBe(false);
  });

  it("mapeia extensão e mime do formato detectado", () => {
    expect(extensionForVoiceFormat("opus")).toBe("opus");
    expect(mimeTypeForVoiceFormat("opus")).toBe("audio/opus");
    expect(mimeTypeForVoiceFormat("wav")).toBe("audio/wav");
  });
});

describe("normalizeVoiceSampleForClone", () => {
  it("converte opus gerado pelo ffmpeg para wav pcm", async () => {
    const nodeRequire = createRequire(import.meta.url);
    const ffmpeg = String(nodeRequire("ffmpeg-static") ?? "ffmpeg");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "voice-norm-"));
    const wavIn = path.join(dir, "in.wav");
    const opus = path.join(dir, "in.opus");

    try {
      const wavResult = spawnSync(
        ffmpeg,
        ["-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=0.2", wavIn],
        { encoding: "utf8" },
      );
      if (wavResult.status !== 0) {
        throw new Error(wavResult.stderr || "ffmpeg wav failed");
      }

      const opusResult = spawnSync(
        ffmpeg,
        ["-y", "-i", wavIn, "-c:a", "libopus", opus],
        { encoding: "utf8" },
      );
      if (opusResult.status !== 0) {
        throw new Error(opusResult.stderr || "ffmpeg opus failed");
      }

      const result = await normalizeVoiceSampleForClone({
        buffer: fs.readFileSync(opus),
        mimeType: "audio/ogg",
        filename: "WhatsApp Audio 2026-04-28 at 12.04.51.opus",
      });

      expect(result.wasTranscoded).toBe(true);
      expect(result.filename).toBe("sample.wav");
      expect(result.mimeType).toBe("audio/wav");
      expect(result.buffer.subarray(0, 4).toString("ascii")).toBe("RIFF");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 20_000);
});
