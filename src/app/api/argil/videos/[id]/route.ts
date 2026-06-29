import { NextResponse } from "next/server";

import { avatarVideoStorage } from "@/lib/avatar-video-storage";
import { apiRoute } from "@/lib/auth/api-route";
import {
  argilGetVideo,
  isArgilVideoReady,
  mapArgilVideoToGenerationUpdate,
} from "@/lib/argil";
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

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return apiRoute(async (repository) => {
    const { id } = await context.params;
    const generation = await avatarVideoStorage.getById(id);

    if (!generation) {
      return NextResponse.json({ message: "Geração não encontrada." }, { status: 404 });
    }

    const dashboard = await repository.getDashboard();
    if (
      generation.profileId &&
      dashboard.profile?.id &&
      generation.profileId !== dashboard.profile.id
    ) {
      return NextResponse.json({ message: "Geração não encontrada." }, { status: 404 });
    }

    if (
      generation.dryRun ||
      !generation.argilVideoId ||
      isArgilVideoReady(generation) ||
      generation.status === "FAILED"
    ) {
      return NextResponse.json({ generation });
    }

    const remoteVideo = await argilGetVideo(generation.argilVideoId);
    const update = mapArgilVideoToGenerationUpdate(remoteVideo);
    const updated = await avatarVideoStorage.update(generation.id, {
      ...update,
      status: toGenerationStatus(update.status),
    });

    return NextResponse.json({ generation: updated, video: remoteVideo });
  });
}
