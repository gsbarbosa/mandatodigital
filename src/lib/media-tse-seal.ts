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
  // Escala a faixa ~90% da largura do vídeo (máx ~1000px) e ancora no canto inf. esquerdo.
  if (guestTestWatermark) {
    return (
      "[1:v][0:v]scale2ref=w=min(iw\\,main_w*0.92):h=ow/mdar[tse][base];" +
      "[2:v][base]scale2ref=w=min(iw\\,main_w*0.85):h=ow/mdar[guest][base2];" +
      "[base2][tse]overlay=24:H-h-56[tmp];" +
      "[tmp][guest]overlay=24:H-h-24"
    );
  }

  return (
    "[1:v][0:v]scale2ref=w=min(iw\\,main_w*0.92):h=ow/mdar[wm][base];" +
    "[base][wm]overlay=24:H-h-24"
  );
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
    const filterComplex = buildOverlayFilterComplex(guest);

    const args = ["-y", "-i", inputPath, "-i", tsePng];
    if (guestPng) {
      args.push("-i", guestPng);
    }
    args.push(
      "-filter_complex",
      filterComplex,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-c:a",
      "copy",
      "-movflags",
      "+faststart",
      outputPath,
    );

    await runFfmpeg(args);
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
