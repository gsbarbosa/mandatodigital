import { promises as fs } from "node:fs";
import path from "node:path";

import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api";
import { canUseLocalFilesystem } from "@/lib/server-runtime";

const LOCAL_DIR = path.join(process.cwd(), "data", "compliance");

export async function GET(request: Request) {
  try {
    if (!canUseLocalFilesystem()) {
      return NextResponse.json({ message: "Arquivo local indisponivel." }, { status: 404 });
    }

    const url = new URL(request.url);
    const relative = url.searchParams.get("path")?.trim() || "";
    if (!relative || relative.includes("..") || path.isAbsolute(relative)) {
      return NextResponse.json({ message: "Path invalido." }, { status: 400 });
    }

    const fullPath = path.join(LOCAL_DIR, relative);
    const buffer = await fs.readFile(fullPath);
    const mime = relative.endsWith(".pdf")
      ? "application/pdf"
      : relative.endsWith(".mp4")
        ? "video/mp4"
        : "application/octet-stream";

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `inline; filename="${path.basename(relative)}"`,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
