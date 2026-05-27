import { NextResponse } from "next/server";

import {
  avatarTrainingStorage,
} from "@/lib/avatar-training-storage";
import { avatarVideoStorage } from "@/lib/avatar-video-storage";
import { handleRouteError } from "@/lib/api";
import type { ArgilVideoWebhookPayload } from "@/lib/argil-types";
import { getRepository } from "@/lib/storage";
import type { AvatarTrainingStatus } from "@/lib/types";

function toTrainingStatus(status: string): AvatarTrainingStatus {
  const allowed: AvatarTrainingStatus[] = [
    "NOT_TRAINED",
    "TRAINING",
    "TRAINING_FAILED",
    "IDLE",
    "REFUSED",
  ];

  return allowed.includes(status as AvatarTrainingStatus)
    ? (status as AvatarTrainingStatus)
    : "TRAINING_FAILED";
}

async function syncProfileFromTraining(trainingId: string) {
  const training = await avatarTrainingStorage.getById(trainingId);

  if (!training?.profileId || !training.argilAvatarId) {
    return;
  }

  await getRepository().updateProfileArgilTraining(training.profileId, {
    argilAvatarId: training.argilAvatarId,
    argilVoiceId: training.argilVoiceId ?? "",
    avatarTrainingStatus: training.status,
  });
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as ArgilVideoWebhookPayload;

    if (payload.event === "VIDEO_GENERATION_SUCCESS") {
      const videoId = payload.data?.videoId;

      if (!videoId) {
        return NextResponse.json({ message: "videoId ausente no webhook." }, { status: 400 });
      }

      const generation = await avatarVideoStorage.getByArgilVideoId(videoId);

      if (!generation) {
        return NextResponse.json({ received: true, matched: false });
      }

      const updated = await avatarVideoStorage.update(generation.id, {
        status: "DONE",
        videoUrl: payload.data.videoUrl ?? generation.videoUrl,
        errorMessage: "",
      });

      return NextResponse.json({ received: true, matched: true, generation: updated });
    }

    if (payload.event === "VIDEO_GENERATION_FAILED") {
      const videoId = payload.data?.videoId;

      if (!videoId) {
        return NextResponse.json({ message: "videoId ausente no webhook." }, { status: 400 });
      }

      const generation = await avatarVideoStorage.getByArgilVideoId(videoId);

      if (!generation) {
        return NextResponse.json({ received: true, matched: false });
      }

      const updated = await avatarVideoStorage.update(generation.id, {
        status: "FAILED",
        errorMessage: "Geracao falhou na Argil (webhook).",
      });

      return NextResponse.json({ received: true, matched: true, generation: updated });
    }

    if (payload.event === "AVATAR_TRAINING_SUCCESS") {
      const avatarId = payload.data?.avatarId;

      if (!avatarId) {
        return NextResponse.json({ message: "avatarId ausente no webhook." }, { status: 400 });
      }

      const training =
        (payload.data.extras?.trainingId
          ? await avatarTrainingStorage.getById(payload.data.extras.trainingId)
          : null) ?? (await avatarTrainingStorage.getByArgilAvatarId(avatarId));

      if (!training) {
        return NextResponse.json({ received: true, matched: false });
      }

      const updated = await avatarTrainingStorage.update(training.id, {
        argilAvatarId: avatarId,
        argilVoiceId: payload.data.voiceId ?? training.argilVoiceId,
        status: "IDLE",
        errorMessage: "",
      });

      await syncProfileFromTraining(updated.id);

      return NextResponse.json({ received: true, matched: true, training: updated });
    }

    if (payload.event === "AVATAR_TRAINING_FAILED") {
      const avatarId = payload.data?.avatarId;

      if (!avatarId) {
        return NextResponse.json({ message: "avatarId ausente no webhook." }, { status: 400 });
      }

      const training =
        (payload.data.extras?.trainingId
          ? await avatarTrainingStorage.getById(payload.data.extras.trainingId)
          : null) ?? (await avatarTrainingStorage.getByArgilAvatarId(avatarId));

      if (!training) {
        return NextResponse.json({ received: true, matched: false });
      }

      const updated = await avatarTrainingStorage.update(training.id, {
        status: toTrainingStatus("TRAINING_FAILED"),
        errorMessage: "Treinamento falhou na Argil (webhook).",
      });

      if (training.profileId) {
        await getRepository().updateProfileArgilTraining(training.profileId, {
          argilAvatarId: training.argilAvatarId ?? avatarId,
          argilVoiceId: training.argilVoiceId ?? "",
          avatarTrainingStatus: "TRAINING_FAILED",
        });
      }

      return NextResponse.json({ received: true, matched: true, training: updated });
    }

    return NextResponse.json({ received: true, matched: false });
  } catch (error) {
    return handleRouteError(error);
  }
}
