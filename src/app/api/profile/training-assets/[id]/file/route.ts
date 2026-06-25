import { NextResponse } from "next/server";

import { apiRoute } from "@/lib/auth/api-route";
import { handleRouteError } from "@/lib/api";
import { resolveAccessibleTrainingAsset } from "@/lib/training-asset-access";
import { readTrainingAssetBytes } from "@/lib/training-asset-storage";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    return apiRoute(async (repository) => {
      const dashboard = await repository.getDashboard();
      const profileId = dashboard.profile?.id ?? null;
      const access = await resolveAccessibleTrainingAsset(repository, id, profileId);

      if (!access.ok) {
        return NextResponse.json({ message: access.message }, { status: access.status });
      }

      const { buffer, mimeType } = await readTrainingAssetBytes(access.asset);

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": mimeType,
          "Content-Length": String(buffer.byteLength),
          "Cache-Control": "private, max-age=300",
        },
      });
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
