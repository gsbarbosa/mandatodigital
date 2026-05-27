import { NextResponse } from "next/server";

import { buildAvatarVideoTranscript } from "@/lib/avatar-video-script";
import { avatarVideoStorage } from "@/lib/avatar-video-storage";
import { handleRouteError } from "@/lib/api";
import {
  argilCreateAndRenderVideo,
  getArgilConfig,
  isArgilVideoReady,
  mapArgilVideoToGenerationUpdate,
} from "@/lib/argil";
import { getRepository } from "@/lib/storage";
import { resolveAppBaseUrl } from "@/lib/training-asset-urls";
import type { AvatarVideoGenerationStatus } from "@/lib/types";

function toGenerationStatus(status: string): AvatarVideoGenerationStatus {
  const allowed: AvatarVideoGenerationStatus[] = [
    "IDLE",
    "GENERATING_AUDIO",
    "GENERATING_VIDEO",
    "DONE",
    "FAILED",
  ];

  return allowed.includes(status as AvatarVideoGenerationStatus)
    ? (status as AvatarVideoGenerationStatus)
    : "GENERATING_VIDEO";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      topic?: string;
      transcript?: string;
      name?: string;
      profileId?: string;
    };

    const topic = String(body.topic ?? "").trim();
    const explicitTranscript = String(body.transcript ?? "").trim();
    const name = String(body.name ?? "").trim() || undefined;
    const profileId = String(body.profileId ?? "").trim() || null;

    if (!topic) {
      return NextResponse.json({ message: "Informe o tema do video." }, { status: 400 });
    }

    const dashboard = await getRepository().getDashboard();
    const transcript =
      explicitTranscript ||
      buildAvatarVideoTranscript({
        topic,
        profile: dashboard.profile,
      });

    const generation = await avatarVideoStorage.create({
      profileId,
      topic,
      transcript,
      name: name ?? `Avatar - ${topic}`,
      dryRun: getArgilConfig().dryRun,
      status: "IDLE",
    });

    const appBaseUrl = resolveAppBaseUrl(request);
    const callbackUrl = appBaseUrl.startsWith("https://")
      ? `${appBaseUrl}/api/argil/webhooks`
      : undefined;

    const result = await argilCreateAndRenderVideo({
      topic,
      transcript,
      name: generation.name,
      avatarId: dashboard.profile?.argilAvatarId || undefined,
      voiceId: dashboard.profile?.argilVoiceId || undefined,
      callbackUrl,
    });

    const videoUpdate = mapArgilVideoToGenerationUpdate(result.video);
    const updated = await avatarVideoStorage.update(generation.id, {
      ...videoUpdate,
      status: toGenerationStatus(videoUpdate.status),
    });

    const finalGeneration =
      result.dryRun && !isArgilVideoReady(updated)
        ? await avatarVideoStorage.update(updated.id, {
            status: "DONE",
            previewUrl: result.video.previewUrl ?? updated.previewUrl,
            videoUrl: "https://example.com/argil-video-dry-run.mp4",
          })
        : updated;

    return NextResponse.json(
      {
        dryRun: result.dryRun,
        generation: finalGeneration,
        video: result.video,
        debug: result.dryRun ? result.request : undefined,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
