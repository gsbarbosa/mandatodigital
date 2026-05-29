import { NextResponse } from "next/server";

import { apiRoute } from "@/lib/auth/api-route";
import { handleRouteError } from "@/lib/api";
import { getTrainingAssetPublicUrl, resolveAppBaseUrl } from "@/lib/training-asset-urls";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    return apiRoute(async (repository) => {
      const dashboard = await repository.getDashboard();
      const profileId = dashboard.profile?.id ?? null;
      if (!profileId) {
        return NextResponse.json({ message: "Perfil nao encontrado." }, { status: 400 });
      }

      const asset = await repository.getTrainingAssetById(id);
      if (!asset) {
        return NextResponse.json({ message: "Asset nao encontrado." }, { status: 404 });
      }

      const ownedByProfile = asset.profileId === profileId || asset.draftProfileId === profileId;
      if (!ownedByProfile) {
        return NextResponse.json({ message: "Asset nao pertence ao perfil atual." }, { status: 403 });
      }

      const previewUrl = await getTrainingAssetPublicUrl(asset, resolveAppBaseUrl(request));
      return NextResponse.json({ previewUrl }, { status: 200 });
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
