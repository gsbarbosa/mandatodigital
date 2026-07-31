#!/usr/bin/env node
/**
 * Renderiza artefatos PNG da Proposta 2 (monograma MD) a partir dos SVGs.
 * Uso: node scripts/render-brand-p2.mjs
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const brandDir = path.join(root, "brand", "propostas-logo");
const outDir = path.join(brandDir, "exports");

const jobs = [
  { svg: "md-monogram.svg", out: "md-monogram.png", width: 512 },
  { svg: "md-monogram-on-dark.svg", out: "md-monogram-on-dark.png", width: 512 },
  { svg: "md-monogram-mono.svg", out: "md-monogram-mono.png", width: 512 },
  { svg: "md-lockup-horizontal-dark.svg", out: "md-lockup-horizontal-dark.png", width: 1440 },
  { svg: "md-lockup-horizontal-light.svg", out: "md-lockup-horizontal-light.png", width: 1440 },
  { svg: "md-lockup-vertical-light.svg", out: "md-lockup-vertical-light.png", width: 640 },
  { svg: "md-app-icon.svg", out: "md-app-icon.png", width: 512 },
  { svg: "md-favicon.svg", out: "md-favicon.png", width: 32 },
  { svg: "md-favicon.svg", out: "md-favicon-48.png", width: 48 },
  { svg: "md-app-icon.svg", out: "md-apple-touch-icon.png", width: 180 },
];

function renderSvg(svgPath, pngPath, width) {
  // rsvg-convert preserva tipografia e paths com qualidade alta
  execFileSync(
    "rsvg-convert",
    ["-w", String(width), "-f", "png", "-o", pngPath, svgPath],
    { stdio: "pipe" },
  );
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  for (const job of jobs) {
    const svgPath = path.join(brandDir, job.svg);
    const pngPath = path.join(outDir, job.out);
    if (!fs.existsSync(svgPath)) {
      throw new Error(`SVG ausente: ${job.svg}`);
    }
    renderSvg(svgPath, pngPath, job.width);
    const meta = await sharp(pngPath).metadata();
    console.log(`✓ ${job.out} (${meta.width}×${meta.height})`);
  }

  // Lockup dark em fundo preto (compatível com uso atual no produto)
  const darkLockup = path.join(outDir, "md-lockup-horizontal-dark.png");
  const brandLogoOut = path.join(outDir, "brand-logo.png");
  const lockupMeta = await sharp(darkLockup).metadata();
  const padY = Math.round((lockupMeta.height ?? 360) * 0.12);
  const padX = Math.round((lockupMeta.width ?? 1440) * 0.04);

  await sharp(darkLockup)
    .extend({
      top: padY,
      bottom: padY,
      left: padX,
      right: padX,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    })
    .png()
    .toFile(brandLogoOut);

  // Fonte canônica do sync:logo
  const sourceLogo = path.join(root, "mandato_digital_logo.png");
  fs.copyFileSync(brandLogoOut, sourceLogo);
  fs.copyFileSync(brandLogoOut, path.join(root, "public", "brand-logo.png"));

  // Favicon / app icons no public (PNG — Next também usa src/app/icon.png)
  fs.copyFileSync(
    path.join(outDir, "md-favicon-48.png"),
    path.join(root, "public", "favicon-48.png"),
  );
  fs.copyFileSync(
    path.join(outDir, "md-app-icon.png"),
    path.join(root, "public", "icon-512.png"),
  );
  fs.copyFileSync(
    path.join(outDir, "md-apple-touch-icon.png"),
    path.join(root, "public", "apple-touch-icon.png"),
  );

  // Next.js App Router icons
  const appDir = path.join(root, "src", "app");
  fs.copyFileSync(path.join(outDir, "md-app-icon.png"), path.join(appDir, "icon.png"));
  fs.copyFileSync(
    path.join(outDir, "md-apple-touch-icon.png"),
    path.join(appDir, "apple-icon.png"),
  );

  const brandMeta = await sharp(brandLogoOut).metadata();
  console.log(
    JSON.stringify(
      {
        brandLogo: `mandato_digital_logo.png (${brandMeta.width}×${brandMeta.height})`,
        exports: outDir,
        public: ["brand-logo.png", "favicon-48.png", "icon-512.png", "apple-touch-icon.png"],
        app: ["icon.png", "apple-icon.png"],
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
