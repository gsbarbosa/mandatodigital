import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const nodeRequire = createRequire(import.meta.url);

function isExecutableFile(candidate: string) {
  try {
    return fs.existsSync(candidate) && fs.statSync(candidate).isFile();
  } catch {
    return false;
  }
}

/**
 * Resolve o binario FFmpeg em runtime. O import estatico de ffmpeg-static
 * quebra no bundle do Next (path /ROOT/...); por isso usamos createRequire + cwd.
 */
export function resolveFfmpegBinary() {
  const fromEnv = process.env.FFMPEG_PATH?.trim();
  if (fromEnv && isExecutableFile(fromEnv)) {
    return fromEnv;
  }

  const candidates: string[] = [];

  try {
    const fromPackage = nodeRequire("ffmpeg-static") as string | null;
    if (fromPackage) {
      candidates.push(fromPackage);
    }
  } catch {
    // pacote ausente no ambiente
  }

  const cwd = process.cwd();
  candidates.push(
    path.join(cwd, "node_modules", "ffmpeg-static", "ffmpeg"),
    path.join(cwd, ".next", "standalone", "node_modules", "ffmpeg-static", "ffmpeg"),
  );

  for (const candidate of candidates) {
    if (isExecutableFile(candidate)) {
      return candidate;
    }
  }

  return "ffmpeg";
}
