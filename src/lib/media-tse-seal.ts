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
import { CAMPAIGN_OVERLAY_TEXT } from "@/lib/campaign-overlay";
import { resolveFfmpegBinary } from "@/lib/ffmpeg-binary";
import { storeComplianceBuffer } from "@/lib/legal/contract-storage";

/**
 * O binário `ffmpeg-static` no Cloud Run **não** inclui o filtro `drawtext`
 * (sem libfreetype). Por isso o selo é PNG pré-renderizado + `overlay`.
 */
const TSE_SEAL_PNG = "assets/seals/tse-seal.png";
const GUEST_SEAL_PNG = "assets/seals/guest-test-seal.png";
const CAMPAIGN_TARJA_PNG = "assets/seals/campaign-tarja-seal.png";

/** Evita comer o timeout do Cloud Run (300s) se o encode travar. */
const FFMPEG_SEAL_TIMEOUT_MS = 90_000;

async function runFfmpeg(args: string[], timeoutMs = FFMPEG_SEAL_TIMEOUT_MS) {
  const binary = resolveFfmpegBinary();

  await new Promise<void>((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(new Error(`FFmpeg indisponivel (${binary}). ${error.message}`));
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(
          new Error(
            `FFmpeg excedeu ${Math.round(timeoutMs / 1000)}s na selagem. Tente de novo com um video mais curto.`,
          ),
        );
        return;
      }
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

function buildOverlayFilterComplex(opts: { guest: boolean; campaign: boolean }) {
  // TSE/guest no canto inf. esquerdo; campanha no topo.
  // eof_action=repeat: PNG de 1 frame permanece até o fim do vídeo.
  if (!opts.guest && !opts.campaign) {
    return (
      "[1:v]scale=min(1100\\,iw):-1[tse];" +
      "[0:v][tse]overlay=24:H-h-24:eof_action=repeat[vout]"
    );
  }

  if (opts.guest && !opts.campaign) {
    return (
      "[1:v]scale=min(1100\\,iw):-1[tse];" +
      "[2:v]scale=min(900\\,iw):-1[guest];" +
      "[0:v][tse]overlay=24:H-h-56:eof_action=repeat[tmp];" +
      "[tmp][guest]overlay=24:H-h-24:eof_action=repeat[vout]"
    );
  }

  if (!opts.guest && opts.campaign) {
    return (
      "[1:v]scale=min(1100\\,iw):-1[tse];" +
      "[2:v]scale=min(1100\\,iw):-1[campaign];" +
      "[0:v][campaign]overlay=24:24:eof_action=repeat[tmp];" +
      "[tmp][tse]overlay=24:H-h-24:eof_action=repeat[vout]"
    );
  }

  return (
    "[1:v]scale=min(1100\\,iw):-1[tse];" +
    "[2:v]scale=min(900\\,iw):-1[guest];" +
    "[3:v]scale=min(1100\\,iw):-1[campaign];" +
    "[0:v][campaign]overlay=24:24:eof_action=repeat[tmp0];" +
    "[tmp0][tse]overlay=24:H-h-56:eof_action=repeat[tmp1];" +
    "[tmp1][guest]overlay=24:H-h-24:eof_action=repeat[vout]"
  );
}

function buildVideoSealArgs(input: {
  inputPath: string;
  outputPath: string;
  tsePng: string;
  guestPng: string | null;
  campaignPng: string | null;
}) {
  const args = ["-y", "-i", input.inputPath, "-i", input.tsePng];
  if (input.guestPng) {
    args.push("-i", input.guestPng);
  }
  if (input.campaignPng) {
    args.push("-i", input.campaignPng);
  }
  args.push(
    "-filter_complex",
    buildOverlayFilterComplex({
      guest: Boolean(input.guestPng),
      campaign: Boolean(input.campaignPng),
    }),
    "-map",
    "[vout]",
    "-map",
    "0:a?",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-crf",
    "23",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "copy",
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
  campaignTarja?: boolean;
}): Promise<Buffer> {
  const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "md-tse-seal-"));
  const inputPath = path.join(tmpDir, "input.mp4");
  const outputPath = path.join(tmpDir, "sealed.mp4");
  const tsePng = resolveAssetPath(TSE_SEAL_PNG);
  const guest = Boolean(input.guestTestWatermark);
  const campaign = Boolean(input.campaignTarja);
  const guestPng = guest ? resolveAssetPath(GUEST_SEAL_PNG) : null;
  const campaignPng = campaign ? resolveAssetPath(CAMPAIGN_TARJA_PNG) : null;

  try {
    await fsPromises.writeFile(inputPath, input.buffer);
    await runFfmpeg(
      buildVideoSealArgs({
        inputPath,
        outputPath,
        tsePng,
        guestPng,
        campaignPng,
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
  campaignTarja?: boolean;
}) {
  const response = await fetch(input.videoUrl);
  if (!response.ok) {
    throw new Error(`Nao foi possivel baixar o video para selagem (HTTP ${response.status}).`);
  }

  const source = Buffer.from(await response.arrayBuffer());
  const sealed = await burnTseSealOnVideoBuffer({
    buffer: source,
    guestTestWatermark: input.guestTestWatermark,
    campaignTarja: input.campaignTarja,
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
    campaignTarja: Boolean(input.campaignTarja),
    campaignOverlayText: input.campaignTarja ? CAMPAIGN_OVERLAY_TEXT : undefined,
  };
}

export async function burnTseSealOnImageBuffer(input: {
  buffer: Buffer;
  mimeType: string;
  guestTestWatermark?: boolean;
  campaignTarja?: boolean;
}): Promise<Buffer> {
  const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "md-tse-img-"));
  const ext = input.mimeType.includes("png") ? ".png" : ".jpg";
  const inputPath = path.join(tmpDir, `input${ext}`);
  const outputPath = path.join(tmpDir, `sealed${ext}`);
  const tsePng = resolveAssetPath(TSE_SEAL_PNG);
  const guest = Boolean(input.guestTestWatermark);
  const campaign = Boolean(input.campaignTarja);
  const guestPng = guest ? resolveAssetPath(GUEST_SEAL_PNG) : null;
  const campaignPng = campaign ? resolveAssetPath(CAMPAIGN_TARJA_PNG) : null;

  try {
    await fsPromises.writeFile(inputPath, input.buffer);
    const filterComplex = buildOverlayFilterComplex({ guest, campaign });
    const args = ["-y", "-i", inputPath, "-i", tsePng];
    if (guestPng) {
      args.push("-i", guestPng);
    }
    if (campaignPng) {
      args.push("-i", campaignPng);
    }
    args.push("-filter_complex", filterComplex, outputPath);
    await runFfmpeg(args);
    return await fsPromises.readFile(outputPath);
  } finally {
    await fsPromises.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
