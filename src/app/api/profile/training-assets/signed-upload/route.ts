import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api";
import { createFirebaseTrainingUploadUrl } from "@/lib/training-asset-storage";
import { parseTrainingAssetRole } from "@/lib/training-asset-role";
import { resolveTrainingAssetsStorageProvider } from "@/lib/training-assets-provider";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      profileId?: string;
      draftProfileId?: string;
      trainingRole?: string;
      filename?: string;
      mimeType?: string;
    };

    const profileId = String(body.profileId ?? "").trim() || null;
    const draftProfileId = String(body.draftProfileId ?? "").trim() || null;
    const referenceId = profileId ?? draftProfileId;
    const trainingRole = parseTrainingAssetRole(body.trainingRole);
    const filename = String(body.filename ?? "").trim();
    const mimeType = String(body.mimeType ?? "").trim() || "application/octet-stream";

    if (!referenceId) {
      return NextResponse.json(
        { message: "Informe profileId ou draftProfileId para vincular o asset." },
        { status: 400 },
      );
    }

    if (!filename) {
      return NextResponse.json({ message: "Informe o nome do arquivo." }, { status: 400 });
    }

    resolveTrainingAssetsStorageProvider();

    const signed = await createFirebaseTrainingUploadUrl({
      referenceId,
      filename,
      mimeType,
    });

    return NextResponse.json(
      {
        trainingRole,
        storageProvider: "firebase",
        storageBucket: signed.storageBucket,
        storagePath: signed.storagePath,
        signedUrl: signed.signedUrl,
        contentType: signed.contentType,
        uploadMethod: "put",
      },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
