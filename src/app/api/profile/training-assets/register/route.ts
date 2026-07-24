import { NextResponse } from "next/server";

import { apiRoute } from "@/lib/auth/api-route";
import { recordAuditEventFireAndForget } from "@/lib/audit/record";
import {
  isAllowedTrainingMime,
  parseTrainingAssetRole,
  trainingAssetUploadRequirementMessage,
} from "@/lib/training-asset-role";
import { normalizeDatasetVideoInStorage } from "@/lib/training-video-storage-normalize";

export const maxDuration = 300;

export async function POST(request: Request) {
  return apiRoute(async (repository) => {
    const body = (await request.json()) as {
      profileId?: string;
      draftProfileId?: string;
      trainingRole?: string;
      storageProvider?: string;
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
    const storageBucket = String(body.storageBucket ?? "").trim() || null;
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
      return NextResponse.json(
        { message: trainingAssetUploadRequirementMessage(trainingRole) },
        { status: 400 },
      );
    }

    let finalStorageBucket = storageBucket;
    let finalStoragePath = storagePath;
    let finalOriginalFilename = originalFilename;
    let finalMimeType = mimeType;
    let finalSizeBytes = sizeBytes;

    if (trainingRole === "dataset" && storagePath) {
      const normalized = await normalizeDatasetVideoInStorage({
        referenceId,
        storageProvider: "firebase",
        storageBucket,
        storagePath,
        originalFilename,
        mimeType,
      });
      finalStorageBucket = normalized.storageBucket;
      finalStoragePath = normalized.storagePath;
      finalOriginalFilename = normalized.originalFilename;
      finalMimeType = normalized.mimeType;
      finalSizeBytes = normalized.sizeBytes;
    }

    const assets = await repository.createTrainingAssets([
      {
        profileId,
        draftProfileId: profileId ? null : draftProfileId,
        sourceType: "upload",
        trainingRole,
        storageProvider: "firebase",
        storageBucket: finalStorageBucket,
        storagePath: finalStoragePath,
        originalFilename: finalOriginalFilename,
        mimeType: finalMimeType,
        sizeBytes: finalSizeBytes,
        status: "uploaded",
        errorMessage: "",
      },
    ]);

    recordAuditEventFireAndForget({
      request,
      profileId,
      action: "training_asset_registered",
      payload: {
        trainingRole,
        assetIds: assets.map((asset) => asset.id),
        mimeType: finalMimeType,
        sizeBytes: finalSizeBytes,
      },
    });

    return NextResponse.json({ assets }, { status: 201 });
  });
}
