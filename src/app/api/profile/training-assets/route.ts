import { NextResponse } from "next/server";

import { apiRoute } from "@/lib/auth/api-route";
import {
  deleteTrainingAssetFile,
  storeTrainingAssetFile,
} from "@/lib/storage";
import {
  isAllowedTrainingMime,
  parseTrainingAssetRole,
} from "@/lib/training-asset-role";

const MAX_TRAINING_FILES = 5;

export async function POST(request: Request) {
  return apiRoute(async (repository) => {
    const formData = await request.formData();
    const profileId = String(formData.get("profileId") ?? "").trim() || null;
    const draftProfileId = String(formData.get("draftProfileId") ?? "").trim() || null;
    const trainingRole = parseTrainingAssetRole(formData.get("trainingRole"));
    const files = formData
      .getAll("files")
      .filter((value): value is File => value instanceof File && value.size > 0);

    if (!profileId && !draftProfileId) {
      return NextResponse.json(
        { message: "Informe profileId ou draftProfileId para vincular os assets." },
        { status: 400 },
      );
    }

    if (!files.length) {
      return NextResponse.json(
        { message: "Envie ao menos um arquivo para treinamento." },
        { status: 400 },
      );
    }

    if (files.length > MAX_TRAINING_FILES) {
      return NextResponse.json(
        { message: `Envie no maximo ${MAX_TRAINING_FILES} arquivos por vez.` },
        { status: 400 },
      );
    }

    for (const file of files) {
      if (!isAllowedTrainingMime(trainingRole, file.type)) {
        const expected =
          trainingRole === "avatar_image"
            ? "uma imagem (PNG, JPEG ou WebP)"
            : "um video";
        return NextResponse.json(
          { message: `O arquivo ${file.name} deve ser ${expected}.` },
          { status: 400 },
        );
      }
    }

    const referenceId = profileId ?? draftProfileId!;
    const uploadedFiles = await Promise.all(
      files.map((file) => storeTrainingAssetFile({ referenceId, file })),
    );
    let assets;

    try {
      assets = await repository.createTrainingAssets(
        uploadedFiles.map((item) => ({
          profileId,
          draftProfileId: profileId ? null : draftProfileId,
          sourceType: "upload",
          trainingRole,
          storageProvider: item.storageProvider,
          storageBucket: item.storageBucket,
          storagePath: item.storagePath,
          originalFilename: item.originalFilename,
          mimeType: item.mimeType,
          sizeBytes: item.sizeBytes,
          status: "uploaded",
          errorMessage: "",
        })),
      );
    } catch (error) {
      await Promise.allSettled(
        uploadedFiles.map((item) =>
          deleteTrainingAssetFile({
            storageProvider: item.storageProvider,
            storageBucket: item.storageBucket,
            storagePath: item.storagePath,
          }),
        ),
      );
      throw error;
    }

    return NextResponse.json({ assets }, { status: 201 });
  });
}
