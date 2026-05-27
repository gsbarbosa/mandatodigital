import { NextResponse } from "next/server";

import { apiRoute } from "@/lib/auth/api-route";
import {
  isAllowedTrainingMime,
  parseTrainingAssetRole,
} from "@/lib/training-asset-role";

export async function POST(request: Request) {
  return apiRoute(async (repository) => {
    const body = (await request.json()) as {
      profileId?: string;
      draftProfileId?: string;
      trainingRole?: string;
      storageProvider?: "supabase" | "local";
      storageBucket?: string | null;
      storagePath?: string;
      originalFilename?: string;
      mimeType?: string;
      sizeBytes?: number;
    };

    const profileId = String(body.profileId ?? "").trim() || null;
    const draftProfileId = String(body.draftProfileId ?? "").trim() || null;
    const referenceId = profileId ?? draftProfileId;
    const trainingRole = parseTrainingAssetRole(body.trainingRole);
    const storageProvider = body.storageProvider === "supabase" ? "supabase" : "local";
    const storageBucket =
      storageProvider === "supabase" ? String(body.storageBucket ?? "").trim() || null : null;
    const storagePath = String(body.storagePath ?? "").trim();
    const originalFilename = String(body.originalFilename ?? "").trim();
    const mimeType = String(body.mimeType ?? "").trim() || "application/octet-stream";
    const sizeBytes = Number(body.sizeBytes ?? 0);

    if (!referenceId) {
      return NextResponse.json(
        { message: "Informe profileId ou draftProfileId para vincular os assets." },
        { status: 400 },
      );
    }

    if (!storagePath || !originalFilename || !Number.isFinite(sizeBytes) || sizeBytes <= 0) {
      return NextResponse.json(
        { message: "Payload incompleto para registrar o asset." },
        { status: 400 },
      );
    }

    if (!isAllowedTrainingMime(trainingRole, mimeType)) {
      const expected =
        trainingRole === "avatar_image"
          ? "uma imagem (PNG, JPEG ou WebP)"
          : trainingRole === "voice_audio"
            ? "um audio (MP3, WAV ou M4A)"
            : "um video";
      return NextResponse.json(
        { message: `Para ${trainingRole}, envie ${expected}.` },
        { status: 400 },
      );
    }

    const assets = await repository.createTrainingAssets([
      {
        profileId,
        draftProfileId: profileId ? null : draftProfileId,
        sourceType: "upload",
        trainingRole,
        storageProvider,
        storageBucket,
        storagePath,
        originalFilename,
        mimeType,
        sizeBytes,
        status: "uploaded",
        errorMessage: "",
      },
    ]);

    return NextResponse.json({ assets }, { status: 201 });
  });
}
