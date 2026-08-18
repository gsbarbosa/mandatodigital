import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { resolveFfmpegBinary } from "@/lib/ffmpeg-binary";

export type VoiceAudioFormat =
  | "wav"
  | "mp3"
  | "m4a"
  | "ogg"
  | "opus"
  | "webm"
  | "flac"
  | "aac"
  | "unknown";

export type VoiceSampleInput = {
  buffer: Buffer;
  mimeType?: string;
  filename?: string;
};

export type NormalizedVoiceSample = {
  buffer: Buffer;
  mimeType: string;
  filename: string;
  format: VoiceAudioFormat;
  wasTranscoded: boolean;
};

const CLONE_SAFE_FORMATS = new Set<VoiceAudioFormat>(["wav", "mp3"]);
const MAX_CLONE_SECONDS = 120;

export function detectVoiceAudioFormat(input: VoiceSampleInput): VoiceAudioFormat {
  const head = input.buffer.subarray(0, 256);
  const ascii = head.toString("latin1");

  if (ascii.startsWith("OggS")) {
    return ascii.includes("OpusHead") ? "opus" : "ogg";
  }
  if (ascii.startsWith("RIFF") && ascii.includes("WAVE")) {
    return "wav";
  }
  if (ascii.startsWith("fLaC")) {
    return "flac";
  }
  if (ascii.startsWith("ID3") || (head[0] === 0xff && (head[1] & 0xe0) === 0xe0)) {
    return "mp3";
  }
  if (ascii.includes("ftyp")) {
    return "m4a";
  }
  if (head[0] === 0x1a && head[1] === 0x45) {
    return "webm";
  }

  const mime = String(input.mimeType ?? "").trim().toLowerCase();
  const name = String(input.filename ?? "").trim().toLowerCase();
  if (name.endsWith(".opus") || mime.includes("opus")) {
    return "opus";
  }
  if (name.endsWith(".ogg") || mime.includes("ogg")) {
    return "ogg";
  }
  if (name.endsWith(".webm") || mime.includes("webm")) {
    return "webm";
  }
  if (name.endsWith(".wav") || mime.includes("wav")) {
    return "wav";
  }
  if (name.endsWith(".mp3") || mime.includes("mpeg") || mime.includes("mp3")) {
    return "mp3";
  }
  if (
    name.endsWith(".m4a") ||
    name.endsWith(".mp4") ||
    mime.includes("mp4") ||
    mime.includes("m4a") ||
    mime.includes("aac")
  ) {
    return "m4a";
  }
  if (name.endsWith(".flac") || mime.includes("flac")) {
    return "flac";
  }

  return "unknown";
}

export function voiceSampleNeedsTranscode(format: VoiceAudioFormat) {
  return !CLONE_SAFE_FORMATS.has(format);
}

export function extensionForVoiceFormat(format: VoiceAudioFormat) {
  switch (format) {
    case "wav":
      return "wav";
    case "mp3":
      return "mp3";
    case "m4a":
      return "m4a";
    case "ogg":
      return "ogg";
    case "opus":
      return "opus";
    case "webm":
      return "webm";
    case "flac":
      return "flac";
    case "aac":
      return "aac";
    default:
      return "bin";
  }
}

export function mimeTypeForVoiceFormat(format: VoiceAudioFormat) {
  switch (format) {
    case "wav":
      return "audio/wav";
    case "mp3":
      return "audio/mpeg";
    case "m4a":
      return "audio/mp4";
    case "ogg":
      return "audio/ogg";
    case "opus":
      return "audio/opus";
    case "webm":
      return "audio/webm";
    case "flac":
      return "audio/flac";
    case "aac":
      return "audio/aac";
    default:
      return "application/octet-stream";
  }
}

async function runFfmpeg(args: string[]) {
  const binary = resolveFfmpegBinary();

  await new Promise<void>((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(
        new Error(
          `FFmpeg indisponível (${binary}). Não foi possível preparar o áudio de voz. ${error.message}`,
        ),
      );
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          stderr.trim() ||
            `Falha ao converter o áudio de voz (código ${code ?? "desconhecido"}).`,
        ),
      );
    });
  });
}

async function transcodeVoiceSampleToWav(input: {
  buffer: Buffer;
  format: VoiceAudioFormat;
}): Promise<Buffer> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "mandato-voice-"));
  const inputPath = path.join(
    tempDir,
    `input.${extensionForVoiceFormat(input.format)}`,
  );
  const outputPath = path.join(tempDir, "output.wav");

  try {
    await fs.writeFile(inputPath, input.buffer);
    await runFfmpeg([
      "-y",
      "-i",
      inputPath,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "44100",
      "-c:a",
      "pcm_s16le",
      "-t",
      String(MAX_CLONE_SECONDS),
      outputPath,
    ]);
    return await fs.readFile(outputPath);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

/**
 * Instant Voice Clone da ElevenLabs lida mal com Opus/OGG do WhatsApp
 * (bytes Opus rotulados como .ogg/.mp3 geram voz genérica ou “do áudio antigo”).
 * Converte para WAV PCM antes do POST /v1/voices/add.
 */
export async function normalizeVoiceSampleForClone(
  input: VoiceSampleInput,
): Promise<NormalizedVoiceSample> {
  const format = detectVoiceAudioFormat(input);
  if (!voiceSampleNeedsTranscode(format)) {
    return {
      buffer: input.buffer,
      mimeType: mimeTypeForVoiceFormat(format),
      filename: `sample.${extensionForVoiceFormat(format)}`,
      format,
      wasTranscoded: false,
    };
  }

  const wav = await transcodeVoiceSampleToWav({ buffer: input.buffer, format });
  return {
    buffer: wav,
    mimeType: "audio/wav",
    filename: "sample.wav",
    format,
    wasTranscoded: true,
  };
}
