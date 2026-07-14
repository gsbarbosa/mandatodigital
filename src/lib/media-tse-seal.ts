import { spawn } from "node:child_process";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  GUEST_TEST_WATERMARK_TEXT,
  TSE_SEAL_OVERLAY_TEXT,
  TSE_SEAL_VERSION,
} from "@/lib/creative-ai-metadata";
import { resolveFfmpegBinary } from "@/lib/ffmpeg-binary";
import { storeComplianceBuffer } from "@/lib/legal/contract-storage";

/**
 * O binário `ffmpeg-static` no Cloud Run **não** inclui o filtro `drawtext`
 * (sem libfreetype). Por isso o selo é PNG pré-renderizado + `overlay`.
 */
const TSE_SEAL_PNG = "assets/seals/tse-seal.png";
const GUEST_SEAL_PNG = "assets/seals/guest-test-seal.png";

async function runFfmpeg(args: string[]) {
  const binary = resolveFfmpegBinary();

  await new Promise<void>((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(new Error(`FFmpeg indisponivel (${binary}). ${error.message}`));
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`FFmpeg falhou (code ${code}): ${stderr.slice(-800)}`));
    });
  });
}

function resolveAssetPath(relativePath: string) {
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, relativePath),
    path.join(cwd, ".next", "standalone", relativePath),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error(`Asset de selo ausente: ${relativePath}`);
  }
  return found;
}

function buildOverlayFilterComplex(guestTestWatermark: boolean) {
  // Escala a faixa e ancora no canto inf. esquerdo.
  // eof_action=repeat: PNG de 1 frame permanece até o fim do vídeo
  // (sem -loop 1 infinito, que pode travar o encode no Cloud Run).
  if (guestTestWatermark) {
    return (
      "[1:v]scale=min(900\\,iw):-1[tse];" +
      "[2:v]scale=min(800\\,iw):-1[guest];" +
      "[0:v][tse]overlay=24:H-h-56:eof_action=repeat[tmp];" +
      "[tmp][guest]overlay=24:H-h-24:eof_action=repeat[vout]"
    );
  }

  return (
    "[1:v]scale=min(900\\,iw):-1[wm];" +
    "[0:v][wm]overlay=24:H-h-24:eof_action=repeat[vout]"
  );
}

function buildVideoSealArgs(input: {
  inputPath: string;
  outputPath: string;
  tsePng: string;
  guestPng: string | null;
}) {
  const args = ["-y", "-i", input.inputPath, "-i", input.tsePng];
  if (input.guestPng) {
    args.push("-i", input.guestPng);
  }
  args.push(
    "-filter_complex",
    buildOverlayFilterComplex(Boolean(input.guestPng)),
    "-map",
    "[vout]",
    "-map",
    "0:a?",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    input.outputPath,
  );
  return args;
}

export async function burnTseSealOnVideoBuffer(input: {
  buffer: Buffer;
  filename?: string;
  guestTestWatermark?: boolean;
}): Promise<Buffer> {
  const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "md-tse-seal-"));
  const inputPath = path.join(tmpDir, "input.mp4");
  const outputPath = path.join(tmpDir, "sealed.mp4");
  const tsePng = resolveAssetPath(TSE_SEAL_PNG);
  const guest = Boolean(input.guestTestWatermark);
  const guestPng = guest ? resolveAssetPath(GUEST_SEAL_PNG) : null;

  try {
    await fsPromises.writeFile(inputPath, input.buffer);
    await runFfmpeg(
      buildVideoSealArgs({
        inputPath,
        outputPath,
        tsePng,
        guestPng,
      }),
    );
    return await fsPromises.readFile(outputPath);
  } finally {
    await fsPromises.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function sealRemoteVideo(input: {
  videoUrl: string;
  mediaId: string;
  guestTestWatermark?: boolean;
}) {
  const response = await fetch(input.videoUrl);
  if (!response.ok) {
    throw new Error(`Nao foi possivel baixar o video para selagem (HTTP ${response.status}).`);
  }

  const source = Buffer.from(await response.arrayBuffer());
  const sealed = await burnTseSealOnVideoBuffer({
    buffer: source,
    guestTestWatermark: input.guestTestWatermark,
  });
  const stored = await storeComplianceBuffer({
    relativePath: `sealed/${input.mediaId}.mp4`,
    buffer: sealed,
    mimeType: "video/mp4",
  });

  return {
    sealedUrl: stored.publicUrl,
    storagePath: stored.storagePath,
    sealVersion: TSE_SEAL_VERSION,
    overlayText: TSE_SEAL_OVERLAY_TEXT,
    guestTestWatermark: Boolean(input.guestTestWatermark),
    guestOverlayText: input.guestTestWatermark ? GUEST_TEST_WATERMARK_TEXT : undefined,
  };
}

export async function burnTseSealOnImageBuffer(input: {
  buffer: Buffer;
  mimeType: string;
  guestTestWatermark?: boolean;
}): Promise<Buffer> {
  const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "md-tse-img-"));
  const ext = input.mimeType.includes("png") ? ".png" : ".jpg";
  const inputPath = path.join(tmpDir, `input${ext}`);
  const outputPath = path.join(tmpDir, `sealed${ext}`);
  const tsePng = resolveAssetPath(TSE_SEAL_PNG);
  const guest = Boolean(input.guestTestWatermark);
  const guestPng = guest ? resolveAssetPath(GUEST_SEAL_PNG) : null;

  try {
    await fsPromises.writeFile(inputPath, input.buffer);
    const filterComplex = buildOverlayFilterComplex(guest);
    const args = ["-y", "-i", inputPath, "-i", tsePng];
    if (guestPng) {
      args.push("-i", guestPng);
    }
    args.push("-filter_complex", filterComplex, outputPath);
    await runFfmpeg(args);
    return await fsPromises.readFile(outputPath);
  } finally {
    await fsPromises.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
