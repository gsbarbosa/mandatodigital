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

  return await new Promise<string>((resolve, reject) => {
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
        resolve(stderr);
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

/** Margem lateral/inferior e respiro entre as duas linhas, em px. */
const SEAL_MARGIN = 24;
const SEAL_LINE_GAP = 10;

/** Fracao da largura do quadro ocupada por cada selo. */
const TSE_WIDTH_RATIO = 0.94;
const GUEST_WIDTH_RATIO = 0.52;
const CAMPAIGN_WIDTH_RATIO = 0.94;

type Size = { width: number; height: number };

/** Le width/height do IHDR do PNG — evita depender de ffprobe. */
function readPngSize(filePath: string): Size {
  const header = Buffer.alloc(24);
  const fd = fs.openSync(filePath, "r");
  try {
    fs.readSync(fd, header, 0, 24, 0);
  } finally {
    fs.closeSync(fd);
  }
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
}

/** Descobre o quadro do video pela saida do proprio ffmpeg (sem ffprobe). */
async function probeVideoSize(inputPath: string): Promise<Size> {
  const stderr = await runFfmpeg(["-i", inputPath, "-frames:v", "1", "-f", "null", "-"], 30_000);
  const match = stderr.match(/Stream #\d+:\d+.*?Video:.*?[,\s](\d{2,5})x(\d{2,5})[,\s]/);
  if (!match) {
    throw new Error("Nao foi possivel medir o quadro do video para posicionar o selo.");
  }
  return { width: Number(match[1]), height: Number(match[2]) };
}

/**
 * Escala o selo para uma fracao da largura do quadro, sem passar do tamanho
 * nativo do PNG (upscale borraria a letra). Caps em px absolutos nao servem:
 * um cap de 2200 estourava um quadro de 1080 e cortava a legenda pela direita.
 */
function fitSeal(seal: Size, frame: Size, ratio: number): Size {
  const width = Math.min(Math.round(frame.width * ratio), seal.width);
  return { width, height: Math.max(1, Math.round((width * seal.height) / seal.width)) };
}

function buildOverlayFilterComplex(input: {
  frame: Size;
  tse: Size;
  guest: Size | null;
  campaign: Size | null;
}) {
  // TSE/guest no canto inf. esquerdo; campanha no topo.
  // eof_action=repeat: PNG de 1 frame permanece até o fim do vídeo.
  const m = SEAL_MARGIN;
  const tse = fitSeal(input.tse, input.frame, TSE_WIDTH_RATIO);
  const guest = input.guest ? fitSeal(input.guest, input.frame, GUEST_WIDTH_RATIO) : null;
  const campaign = input.campaign
    ? fitSeal(input.campaign, input.frame, CAMPAIGN_WIDTH_RATIO)
    : null;

  // Com a tarja de convidado no rodape, o selo TSE sobe o suficiente para nao encostar.
  const tseBottom = guest ? m + guest.height + SEAL_LINE_GAP : m;

  const chain: string[] = [`[1:v]scale=${tse.width}:${tse.height}[tse];`];
  let index = 2;

  if (guest) {
    chain.push(`[${index}:v]scale=${guest.width}:${guest.height}[guest];`);
    index += 1;
  }
  if (campaign) {
    chain.push(`[${index}:v]scale=${campaign.width}:${campaign.height}[campaign];`);
  }

  let current = "0:v";
  const steps: string[] = [];

  if (campaign) {
    steps.push(`[${current}][campaign]overlay=${m}:${m}:eof_action=repeat[c0];`);
    current = "c0";
  }

  steps.push(
    `[${current}][tse]overlay=${m}:H-h-${tseBottom}:eof_action=repeat[${guest ? "c1" : "vout"}]`,
  );

  if (guest) {
    steps.push(`;[c1][guest]overlay=${m}:H-h-${m}:eof_action=repeat[vout]`);
  }

  return chain.join("") + steps.join("");
}

function buildVideoSealArgs(input: {
  inputPath: string;
  outputPath: string;
  tsePng: string;
  guestPng: string | null;
  campaignPng: string | null;
  frame: Size;
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
      frame: input.frame,
      tse: readPngSize(input.tsePng),
      guest: input.guestPng ? readPngSize(input.guestPng) : null,
      campaign: input.campaignPng ? readPngSize(input.campaignPng) : null,
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
    const frame = await probeVideoSize(inputPath);
    await runFfmpeg(
      buildVideoSealArgs({
        inputPath,
        outputPath,
        tsePng,
        guestPng,
        campaignPng,
        frame,
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
    const filterComplex = buildOverlayFilterComplex({
      frame: await probeVideoSize(inputPath),
      tse: readPngSize(tsePng),
      guest: guestPng ? readPngSize(guestPng) : null,
      campaign: campaignPng ? readPngSize(campaignPng) : null,
    });
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
