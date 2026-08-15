import { NextResponse } from "next/server";

import { heygenApiRoute } from "@/lib/heygen-api-route";
import { handleRouteError } from "@/lib/api";
import { formatHeyGenError, heygenGetVideo } from "@/lib/heygen";
import { cleanupTtsAudioForVideo } from "@/lib/elevenlabs-tts-storage";
import { appLog, appLogError } from "@/lib/observability/log";

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
      const status = data.status ?? "pending";

      if (status === "completed" || status === "failed") {
        appLog(
          "heygen",
          "video_status_changed",
          {
            videoId,
            status,
            hasVideoUrl: Boolean(data.video_url),
            errorMessage: data.failure_message ? String(data.failure_message).slice(0, 200) : null,
          },
          status === "failed" ? "warn" : "info",
        );

        // MP3 TTS só é seguro apagar depois do render (HeyGen baixa o audio_url async).
        void cleanupTtsAudioForVideo(videoId)
          .then((result) => {
            if (result.deleted) {
              appLog("voice", "tts_audio_cleaned", {
                videoId,
                storagePath: result.storagePath,
              });
            }
          })
          .catch((error) => {
            appLogError("voice", "tts_audio_cleanup_failed", error, { videoId });
          });
      }

      return NextResponse.json({
        videoId,
        status,
        videoUrl: data.video_url ?? "",
        captionUrl: data.caption_url ?? "",
        errorMessage: data.failure_message ?? "",
        raw: remote,
      });
    });
  } catch (error) {
    appLogError("heygen", "video_status_failed", error);
    return handleRouteError(new Error(formatHeyGenError(error)));
  }
}
