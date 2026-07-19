import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api";
import { getRepository } from "@/lib/storage";
import {
  createFirebaseTrainingReadUrl,
} from "@/lib/training-asset-storage";
import {
  createTrainingAssetAccessToken,
  verifyTrainingAssetAccessToken,
} from "@/lib/training-asset-urls";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const token = new URL(request.url).searchParams.get("token") ?? "";

    if (!verifyTrainingAssetAccessToken(id, token)) {
      return NextResponse.json({ message: "Token invalido ou expirado." }, { status: 403 });
    }

    const asset = await getRepository().getTrainingAssetById(id);

    if (!asset) {
      return NextResponse.json({ message: "Asset nao encontrado." }, { status: 404 });
    }

    const signedUrl = await createFirebaseTrainingReadUrl(
      asset.storageBucket,
      asset.storagePath,
    );

    return NextResponse.redirect(signedUrl, 302);
  } catch (error) {
    return handleRouteError(error);
  }
}

export { createTrainingAssetAccessToken };
