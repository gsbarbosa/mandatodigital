import { NextResponse } from "next/server";

import { heygenApiRoute } from "@/lib/heygen-api-route";
import { handleRouteError } from "@/lib/api";
import { formatHeyGenError, heygenGetVideo } from "@/lib/heygen";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    return heygenApiRoute(request, async () => {
      const { id } = await context.params;
      const videoId = String(id ?? "").trim();

      if (!videoId) {
        return NextResponse.json({ message: "videoId ausente." }, { status: 400 });
      }

      const remote = await heygenGetVideo(videoId);
      const data = remote.data ?? {};

      return NextResponse.json({
        videoId,
        status: data.status ?? "pending",
        videoUrl: data.video_url ?? "",
        captionUrl: data.caption_url ?? "",
        errorMessage: data.failure_message ?? "",
        raw: remote,
      });
    });
  } catch (error) {
    return handleRouteError(new Error(formatHeyGenError(error)));
  }
}

