import { NextResponse } from "next/server";

import { apiRoute } from "@/lib/auth/api-route";
import { handleRouteError } from "@/lib/api";
import { mergeProfileInputForSave } from "@/lib/profile-save";
import { profileInputSchema } from "@/lib/schemas";
import {
  invalidateSentinelCache,
} from "@/lib/sentinel-suggestions";
import { syncSentinelThemeExpansions } from "@/lib/sentinel-theme-expansion";

export async function GET() {
  return apiRoute(async (repository) => {
    const dashboard = await repository.getDashboard();
    return NextResponse.json({ profile: dashboard.profile });
  });
}

export async function PUT(request: Request) {
  try {
    return apiRoute(async (repository) => {
      const body = (await request.json()) as Record<string, unknown> & {
        draftSave?: boolean;
      };
      const draftSave = body.draftSave === true;
      delete body.draftSave;

      const dashboard = await repository.getDashboard();
      const merged = draftSave
        ? mergeProfileInputForSave(
            body as Parameters<typeof mergeProfileInputForSave>[0],
            dashboard.profile,
            { allowDraftDefaults: true },
          )
        : (body as Parameters<typeof mergeProfileInputForSave>[0]);

      const payload = profileInputSchema.parse(merged);
      const profile = await repository.saveProfile(payload);

      void syncSentinelThemeExpansions(profile)
        .then(() => {
          if (profile.id) {
            invalidateSentinelCache(profile.id);
          }
        })
        .catch(() => undefined);

      return NextResponse.json({ profile });
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
