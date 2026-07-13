import { NextResponse } from "next/server";
import { z } from "zod";

import { apiRoute } from "@/lib/auth/api-route";
import { handleRouteError } from "@/lib/api";
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
      const sealed = await sealRemoteVideo({
        videoUrl: body.videoUrl,
        mediaId: body.mediaId,
      });
      return NextResponse.json(sealed);
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
