import { NextResponse } from "next/server";

import { apiRoute } from "@/lib/auth/api-route";
import { handleRouteError } from "@/lib/api";
import { resolveAccessibleTrainingAsset } from "@/lib/training-asset-access";
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
      const access = await resolveAccessibleTrainingAsset(repository, id, profileId);

      if (!access.ok) {
        return NextResponse.json({ message: access.message }, { status: access.status });
      }

      const previewUrl = await getTrainingAssetPublicUrl(
        access.asset,
        resolveAppBaseUrl(request),
      );
      return NextResponse.json({ previewUrl }, { status: 200 });
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
