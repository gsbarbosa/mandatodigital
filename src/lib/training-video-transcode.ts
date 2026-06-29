import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { resolveFfmpegBinary } from "@/lib/ffmpeg-binary";
import { HEYGEN_TRAINING_VIDEO_MAX_BYTES } from "@/lib/training-video-upload";

/** Margem abaixo do teto da HeyGen (32 MB via asset/URL). */
export const HEYGEN_TRAINING_VIDEO_TARGET_MAX_BYTES = 30 * 1024 * 1024;

const TRANSCODE_PRESETS = [
  { maxDurationSec: 75, crf: 28, height: 720 },
  { maxDurationSec: 60, crf: 30, height: 720 },
  { maxDurationSec: 45, crf: 32, height: 480 },
] as const;

export type TrainingVideoBufferInput = {
  buffer: Buffer;
  mimeType: string;
  filename: string;
};

export type NormalizedTrainingVideo = {
  buffer: Buffer;
  mimeType: "video/mp4";
  filename: string;
  sizeBytes: number;
  wasTranscoded: boolean;
};

function guessInputExtension(mimeType: string, filename: string) {
  const mime = mimeType.trim().toLowerCase();
  const name = filename.trim().toLowerCase();
  if (mime.includes("quicktime") || name.endsWith(".mov")) {
    return ".mov";
  }
  if (mime.includes("webm") || name.endsWith(".webm")) {
    return ".webm";
  }
  if (mime.includes("mp4") || name.endsWith(".mp4")) {
    return ".mp4";
  }
  return ".mp4";
}

function buildNormalizedFilename(filename: string) {
  const base = filename.replace(/\.[^.]+$/, "").trim() || "treino-gemeo";
  return `${base}-heygen.mp4`;
}

export function trainingVideoNeedsTranscode(input: TrainingVideoBufferInput) {
  const mime = input.mimeType.trim().toLowerCase();
  const name = input.filename.trim().toLowerCase();
  const isMov = mime.includes("quicktime") || name.endsWith(".mov");
  const isMp4 = mime.includes("mp4") || name.endsWith(".mp4");
  const isWebm = mime.includes("webm") || name.endsWith(".webm");

  return (
    isMov ||
    (!isMp4 && !isWebm) ||
    input.buffer.length > HEYGEN_TRAINING_VIDEO_MAX_BYTES
  );
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
          `FFmpeg indisponível (${binary}). Instale ffmpeg ou use MP4 menor que 32 MB. ${error.message}`,
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
            `Falha ao comprimir o video de treino (codigo ${code ?? "desconhecido"}).`,
        ),
      );
    });
  });
}

async function transcodeWithPreset(input: {
  inputPath: string;
  outputPath: string;
  preset: (typeof TRANSCODE_PRESETS)[number];
}) {
  const scale = `scale=-2:${input.preset.height}`;
  await runFfmpeg([
    "-y",
    "-i",
    input.inputPath,
    "-t",
    String(input.preset.maxDurationSec),
    "-vf",
    scale,
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    String(input.preset.crf),
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-ac",
    "1",
    "-ar",
    "44100",
    input.outputPath,
  ]);
}

export async function transcodeTrainingVideoForHeyGen(
  input: TrainingVideoBufferInput,
): Promise<NormalizedTrainingVideo> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "mandato-video-"));
  const inputExt = guessInputExtension(input.mimeType, input.filename);
  const inputPath = path.join(tempDir, `input${inputExt}`);
  const outputPath = path.join(tempDir, "output.mp4");

  try {
    await fs.writeFile(inputPath, input.buffer);

    let lastBuffer: Buffer | null = null;

    for (const preset of TRANSCODE_PRESETS) {
      await transcodeWithPreset({ inputPath, outputPath, preset });
      const candidate = await fs.readFile(outputPath);
      lastBuffer = candidate;

      if (candidate.length <= HEYGEN_TRAINING_VIDEO_TARGET_MAX_BYTES) {
        return {
          buffer: candidate,
          mimeType: "video/mp4",
          filename: buildNormalizedFilename(input.filename),
          sizeBytes: candidate.length,
          wasTranscoded: true,
        };
      }
    }

    if (!lastBuffer || lastBuffer.length === 0) {
      throw new Error("Não foi possível gerar um MP4 de treino após a compressão.");
    }

    if (lastBuffer.length > HEYGEN_TRAINING_VIDEO_MAX_BYTES) {
      throw new Error(
        `Mesmo após compressão o video ficou com ${(lastBuffer.length / (1024 * 1024)).toFixed(1)} MB. ` +
          "Grave um clipe mais curto (30–45s) ou em 480p e tente novamente.",
      );
    }

    return {
      buffer: lastBuffer,
      mimeType: "video/mp4",
      filename: buildNormalizedFilename(input.filename),
      sizeBytes: lastBuffer.length,
      wasTranscoded: true,
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

export async function normalizeTrainingVideoBuffer(
  input: TrainingVideoBufferInput,
): Promise<NormalizedTrainingVideo> {
  if (!trainingVideoNeedsTranscode(input)) {
    const filename =
      input.filename.trim().toLowerCase().endsWith(".mp4") ||
      input.mimeType.toLowerCase().includes("mp4")
        ? input.filename
        : buildNormalizedFilename(input.filename);

    return {
      buffer: input.buffer,
      mimeType: "video/mp4",
      filename,
      sizeBytes: input.buffer.length,
      wasTranscoded: false,
    };
  }

  return transcodeTrainingVideoForHeyGen(input);
}
