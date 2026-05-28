import { NextResponse } from "next/server";

import { apiRoute } from "@/lib/auth/api-route";
import { handleRouteError } from "@/lib/api";
import { buildAvatarVideoTranscript } from "@/lib/avatar-video-script";
import { formatHeyGenError, heygenCreateVideo, heygenGetAvatarLook } from "@/lib/heygen";
import { resolveAppBaseUrl } from "@/lib/training-asset-urls";

export async function POST(request: Request) {
  try {
    return apiRoute(async (repository) => {
      const body = (await request.json()) as {
        topic?: string;
        avatarId?: string;
        voiceId?: string;
        transcript?: string;
        name?: string;
      };

      const topic = String(body.topic ?? "").trim();
      const avatarId = String(body.avatarId ?? "").trim();
      const voiceId = String(body.voiceId ?? "").trim();
      const explicitTranscript = String(body.transcript ?? "").trim();
      const name = String(body.name ?? "").trim() || undefined;

      if (!topic) {
        return NextResponse.json({ message: "Informe o tema do video." }, { status: 400 });
      }
      if (!avatarId) {
        return NextResponse.json(
          { message: "Avatar HeyGen ausente. Clique em Treinar (HeyGen) primeiro." },
          { status: 400 },
        );
      }
      if (!voiceId) {
        return NextResponse.json(
          { message: "Voz HeyGen ausente. Clique em Treinar (HeyGen) primeiro." },
          { status: 400 },
        );
      }

      const dashboard = await repository.getDashboard();
      const transcript =
        explicitTranscript ||
        (await buildAvatarVideoTranscript({
          topic,
          profile: dashboard.profile,
        }));

      const appBaseUrl = resolveAppBaseUrl(request);
      const callbackUrl = appBaseUrl.startsWith("https://")
        ? `${appBaseUrl}/api/heygen/webhooks`
        : undefined;

      let engine: "avatar_iv" | "avatar_v" = "avatar_iv";
      try {
        const look = await heygenGetAvatarLook(avatarId);
        const supported = look.data?.avatar_look?.supported_api_engines ?? [];
        if (supported.includes("avatar_v")) {
          engine = "avatar_v";
        }
      } catch {
        // ignore (fallback to avatar_iv)
      }

      const result = await heygenCreateVideo({
        avatarId,
        voiceId,
        script: transcript,
        title: name ?? `Curador v2 - ${topic}`,
        aspectRatio: "9:16",
        resolution: "1080p",
        callbackUrl,
        engine,
        motionPrompt: "nodding gently",
        expressiveness: "medium",
      });

      return NextResponse.json(
        {
          videoId: result.videoId,
          message: "Video enviado para a HeyGen. Aguarde a renderizacao.",
        },
        { status: 201 },
      );
    });
  } catch (error) {
    return handleRouteError(new Error(formatHeyGenError(error)));
  }
}

