import { promises as fs } from "node:fs";
import path from "node:path";

import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api";
import { getRepository } from "@/lib/storage";
import {
  createTrainingAssetAccessToken,
  verifyTrainingAssetAccessToken,
} from "@/lib/training-asset-urls";

const LOCAL_TRAINING_ASSET_DIR = path.join(process.cwd(), "data", "training-assets");

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const token = new URL(request.url).searchParams.get("token") ?? "";

    if (!verifyTrainingAssetAccessToken(id, token)) {
      return NextResponse.json({ message: "Token inválido ou expirado." }, { status: 403 });
    }

    const asset = await getRepository().getTrainingAssetById(id);

    if (!asset) {
      return NextResponse.json({ message: "Asset não encontrado." }, { status: 404 });
    }

    if (asset.storageProvider === "supabase") {
      return NextResponse.json(
        { message: "Asset hospedado no Supabase deve usar URL assinada." },
        { status: 400 },
      );
    }

    const absolutePath = path.join(LOCAL_TRAINING_ASSET_DIR, asset.storagePath);
    const fileBuffer = await fs.readFile(absolutePath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": asset.mimeType || "application/octet-stream",
        "Content-Length": String(fileBuffer.byteLength),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export { createTrainingAssetAccessToken };
