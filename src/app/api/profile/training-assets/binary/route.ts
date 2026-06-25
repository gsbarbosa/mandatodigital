import { NextResponse } from "next/server";

import { apiRoute } from "@/lib/auth/api-route";
import {
  deleteTrainingAssetFile,
  storeTrainingAssetBytes,
} from "@/lib/storage";
import {
  isAllowedTrainingMime,
  parseTrainingAssetRole,
  trainingAssetUploadRequirementMessage,
} from "@/lib/training-asset-role";
import { normalizeTrainingVideoBuffer } from "@/lib/training-video-transcode";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function PUT(request: Request) {
  return apiRoute(async (repository) => {
    const url = new URL(request.url);
    const profileId = url.searchParams.get("profileId")?.trim() || null;
    const draftProfileId = url.searchParams.get("draftProfileId")?.trim() || null;
    const trainingRole = parseTrainingAssetRole(url.searchParams.get("trainingRole"));
    const filename = url.searchParams.get("filename")?.trim() || "arquivo.bin";
    const mimeType = request.headers.get("content-type")?.trim() || "application/octet-stream";

    if (!profileId && !draftProfileId) {
      return NextResponse.json(
        { message: "Informe profileId ou draftProfileId para vincular o asset." },
        { status: 400 },
      );
    }

    if (!isAllowedTrainingMime(trainingRole, mimeType)) {
      return NextResponse.json(
        {
          message:
            trainingRole === "avatar_image"
              ? "Envie uma imagem PNG, JPEG ou WebP."
              : trainingAssetUploadRequirementMessage(trainingRole),
        },
        { status: 400 },
      );
    }

    const arrayBuffer = await request.arrayBuffer();
    if (!arrayBuffer.byteLength) {
      return NextResponse.json({ message: "Corpo do upload vazio." }, { status: 400 });
    }

    const referenceId = profileId ?? draftProfileId!;
    let uploadBuffer = Buffer.from(arrayBuffer);
    let uploadFilename = filename;
    let uploadMimeType = mimeType;

    if (trainingRole === "dataset") {
      const normalized = await normalizeTrainingVideoBuffer({
        buffer: uploadBuffer,
        mimeType,
        filename,
      });
      uploadBuffer = Buffer.from(normalized.buffer);
      uploadFilename = normalized.filename;
      uploadMimeType = normalized.mimeType;
    }

    let stored;

    try {
      stored = await storeTrainingAssetBytes({
        referenceId,
        filename: uploadFilename,
        mimeType: uploadMimeType,
        sizeBytes: uploadBuffer.byteLength,
        buffer: uploadBuffer,
      });
    } catch (error) {
      throw error;
    }

    try {
      const assets = await repository.createTrainingAssets([
        {
          profileId,
          draftProfileId: profileId ? null : draftProfileId,
          sourceType: "upload",
          trainingRole,
          storageProvider: stored.storageProvider,
          storageBucket: stored.storageBucket,
          storagePath: stored.storagePath,
          originalFilename: stored.originalFilename,
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
          status: "uploaded",
          errorMessage: "",
        },
      ]);

      return NextResponse.json({ assets }, { status: 201 });
    } catch (error) {
      await deleteTrainingAssetFile({
        storageProvider: stored.storageProvider,
        storageBucket: stored.storageBucket,
        storagePath: stored.storagePath,
      });
      throw error;
    }
  });
}
