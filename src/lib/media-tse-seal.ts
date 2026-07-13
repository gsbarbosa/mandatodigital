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

function escapeDrawtext(text: string) {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/%/g, "\\%");
}

function resolveDrawtextFontFile() {
  const fromEnv = process.env.TSE_SEAL_FONT_PATH?.trim();
  if (fromEnv && fs.existsSync(fromEnv)) {
    return fromEnv;
  }

  const cwd = process.cwd();
  const candidates = [
    // Bundled for Cloud Run / App Hosting (sem fontes de sistema).
    path.join(cwd, "assets", "fonts", "DejaVuSans.ttf"),
    path.join(cwd, ".next", "standalone", "assets", "fonts", "DejaVuSans.ttf"),
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
    "/Library/Fonts/Arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "/usr/share/fonts/TTF/DejaVuSans.ttf",
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function requireDrawtextFontFile() {
  const fontFile = resolveDrawtextFontFile();
  if (!fontFile) {
    throw new Error(
      "Fonte para selo TSE ausente. Inclua assets/fonts/DejaVuSans.ttf no deploy ou defina TSE_SEAL_FONT_PATH.",
    );
  }
  return fontFile;
}

function buildDrawtextFilter(input: {
  text: string;
  fontSize: number;
  x: number;
  yExpr: string;
}) {
  const label = escapeDrawtext(input.text);
  const fontFile = requireDrawtextFontFile();
  return (
    `drawtext=fontfile=${escapeDrawtext(fontFile)}:text='${label}':fontsize=${input.fontSize}:fontcolor=white:` +
    `box=1:boxcolor=black@0.6:boxborderw=8:x=${input.x}:y=${input.yExpr}`
  );
}

function buildVideoVf(guestTestWatermark: boolean) {
  const layers = [
    buildDrawtextFilter({
      text: TSE_SEAL_OVERLAY_TEXT,
      fontSize: 18,
      x: 24,
      yExpr: "h-th-24",
    }),
  ];

  if (guestTestWatermark) {
    layers.push(
      buildDrawtextFilter({
        text: GUEST_TEST_WATERMARK_TEXT,
        fontSize: 16,
        x: 24,
        yExpr: "h-th-56",
      }),
    );
  }

  return layers.join(",");
}

export async function burnTseSealOnVideoBuffer(input: {
  buffer: Buffer;
  filename?: string;
  guestTestWatermark?: boolean;
}): Promise<Buffer> {
  const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "md-tse-seal-"));
  const inputPath = path.join(tmpDir, "input.mp4");
  const outputPath = path.join(tmpDir, "sealed.mp4");

  try {
    await fsPromises.writeFile(inputPath, input.buffer);
    const vf = buildVideoVf(Boolean(input.guestTestWatermark));

    await runFfmpeg([
      "-y",
      "-i",
      inputPath,
      "-vf",
      vf,
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
    ]);

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

  try {
    await fsPromises.writeFile(inputPath, input.buffer);
    const layers = [
      buildDrawtextFilter({
        text: TSE_SEAL_OVERLAY_TEXT,
        fontSize: 16,
        x: 16,
        yExpr: "h-th-16",
      }),
    ];
    if (input.guestTestWatermark) {
      layers.push(
        buildDrawtextFilter({
          text: GUEST_TEST_WATERMARK_TEXT,
          fontSize: 14,
          x: 16,
          yExpr: "h-th-44",
        }),
      );
    }
    await runFfmpeg(["-y", "-i", inputPath, "-vf", layers.join(","), outputPath]);
    return await fsPromises.readFile(outputPath);
  } finally {
    await fsPromises.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
