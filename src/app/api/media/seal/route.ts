import { NextResponse } from "next/server";
import { z } from "zod";

import { apiRoute } from "@/lib/auth/api-route";
import { handleRouteError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth/session";
import { isPremiumAccountMode } from "@/lib/dev-account-mode.server";
import { sealRemoteVideo } from "@/lib/media-tse-seal";

export const maxDuration = 120;

const bodySchema = z.object({
  videoUrl: z.string().min(1),
  mediaId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    return await apiRoute(async () => {
      const body = bodySchema.parse(await request.json());
      const sessionUser = await getSessionUser();
      const premium = await isPremiumAccountMode(sessionUser?.email);
      const sealed = await sealRemoteVideo({
        videoUrl: body.videoUrl,
        mediaId: body.mediaId,
        guestTestWatermark: !premium,
      });
      return NextResponse.json(sealed);
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
