import { NextResponse } from "next/server";

import {
  avatarTrainingStorage,
  isAvatarTrainingTerminal,
} from "@/lib/avatar-training-storage";
import { apiRoute } from "@/lib/auth/api-route";
import type { Repository } from "@/lib/storage";
import {
  argilCreateAvatarFromImage,
  argilCreateVoiceFromAudio,
  argilGetAvatar,
  isArgilPlaceholderId,
  isValidArgilUuid,
  getArgilConfig,
  isArgilAvatarTerminal,
} from "@/lib/argil";
import { getRepository } from "@/lib/storage";
import {
  getTrainingAssetPublicUrl,
  pickAvatarImageAndVoiceAudioAssets,
  resolveAppBaseUrl,
} from "@/lib/training-asset-urls";
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
    : "TRAINING";
}

async function syncProfileTrainingState(
  repository: Repository,
  input: {
  profileId: string | null;
  draftProfileId: string | null;
  argilAvatarId: string;
  argilVoiceId: string;
  avatarTrainingStatus: AvatarTrainingStatus;
  },
) {
  if (!input.profileId) {
    return;
  }

  await repository.updateProfileArgilTraining(input.profileId, {
    argilAvatarId: input.argilAvatarId,
    argilVoiceId: input.argilVoiceId,
    avatarTrainingStatus: input.avatarTrainingStatus,
  });
}

export async function POST(request: Request) {
  return apiRoute(async (repository) => {
    const body = (await request.json()) as {
      profileId?: string;
      draftProfileId?: string;
      avatarName?: string;
    };

    const profileId = String(body.profileId ?? "").trim() || null;
    const draftProfileId = String(body.draftProfileId ?? "").trim() || null;
    const referenceId = profileId ?? draftProfileId;

    if (!referenceId) {
      return NextResponse.json(
        { message: "Informe profileId ou draftProfileId para iniciar o treinamento." },
        { status: 400 },
      );
    }

    const config = getArgilConfig();
    const assets = await repository.listTrainingAssetsForReference(referenceId);
    const { avatarImageAsset, voiceAudioAsset } =
      pickAvatarImageAndVoiceAudioAssets(assets);

    if (!config.dryRun) {
      if (!avatarImageAsset) {
        const hasLegacyDataset = assets.some((asset) => asset.trainingRole === "dataset");
        return NextResponse.json(
          {
            message: hasLegacyDataset
              ? "A Argil nao aceita mais video de treino. Envie uma foto do rosto (PNG/JPEG) no slot de clone e clique em Treinar novamente."
              : "Envie uma foto do rosto (PNG/JPEG) para treinar o avatar na Argil.",
          },
          { status: 400 },
        );
      }

      if (!voiceAudioAsset) {
        return NextResponse.json(
          {
            message:
              "Envie um audio de voz (30s a 4 min, MP3/WAV/M4A) para clonar o timbre antes de treinar.",
          },
          { status: 400 },
        );
      }
    }

    const dashboard = await repository.getDashboard();
    const avatarName =
      String(body.avatarName ?? "").trim() ||
      dashboard.profile?.fullName?.trim() ||
      "Mandato Digital Avatar";

    const baseUrl = resolveAppBaseUrl(request);
    const datasetImageUrl = config.dryRun
      ? "https://example.com/dry-run-avatar.jpg"
      : await getTrainingAssetPublicUrl(avatarImageAsset!, baseUrl);
    const voiceAudioUrl = config.dryRun
      ? "https://example.com/dry-run-voice.mp3"
      : await getTrainingAssetPublicUrl(voiceAudioAsset!, baseUrl);

    const training = await avatarTrainingStorage.create({
      profileId,
      draftProfileId: profileId ? null : draftProfileId,
      status: "TRAINING",
      dryRun: config.dryRun,
      datasetAssetId: avatarImageAsset?.id ?? null,
      voiceAudioAssetId: voiceAudioAsset?.id ?? null,
      avatarName,
    });

    const voiceResult = await argilCreateVoiceFromAudio({
      name: `${avatarName} - voz`,
      audioUrl: voiceAudioUrl,
    });

    const clonedVoiceId = voiceResult.voice.id;

    const result = await argilCreateAvatarFromImage({
      name: avatarName,
      datasetImageUrl,
      voiceId: clonedVoiceId,
      extras: {
        source: "mandato-digital",
        trainingId: training.id,
        ...(profileId ? { profileId } : {}),
        ...(draftProfileId ? { draftProfileId } : {}),
      },
    });

    let updated = await avatarTrainingStorage.update(training.id, {
      argilAvatarId: result.avatar.id,
      argilVoiceId: result.avatar.voiceId ?? clonedVoiceId,
      status: toTrainingStatus(result.avatar.status),
    });

    if (config.dryRun) {
      updated = await avatarTrainingStorage.update(training.id, {
        argilAvatarId: result.avatar.id,
        argilVoiceId: clonedVoiceId,
        status: "IDLE",
        errorMessage: "",
      });

      await syncProfileTrainingState(repository, {
        profileId,
        draftProfileId,
        argilAvatarId: updated.argilAvatarId ?? result.avatar.id,
        argilVoiceId: updated.argilVoiceId ?? clonedVoiceId,
        avatarTrainingStatus: "IDLE",
      });
    } else if (profileId) {
      await syncProfileTrainingState(repository, {
        profileId,
        draftProfileId,
        argilAvatarId: result.avatar.id,
        argilVoiceId: result.avatar.voiceId ?? clonedVoiceId,
        avatarTrainingStatus: toTrainingStatus(result.avatar.status),
      });
    }

    return NextResponse.json(
      {
        dryRun: result.dryRun,
        training: updated,
        avatar: result.avatar,
        voice: voiceResult.voice,
        debug: result.dryRun
          ? { avatarRequest: result.request, voiceRequest: voiceResult.request }
          : undefined,
      },
      { status: 201 },
    );
  });
}

export async function GET(request: Request) {
  return apiRoute(async (repository) => {
    const trainingId = new URL(request.url).searchParams.get("trainingId")?.trim();

    if (!trainingId) {
      return NextResponse.json(
        { message: "Informe trainingId para consultar o treinamento." },
        { status: 400 },
      );
    }

    const training = await avatarTrainingStorage.getById(trainingId);

    if (!training) {
      return NextResponse.json({ message: "Treinamento nao encontrado." }, { status: 404 });
    }

    if (
      training.argilAvatarId &&
      !training.dryRun &&
      !isAvatarTrainingTerminal(training.status) &&
      !isArgilPlaceholderId(training.argilAvatarId) &&
      isValidArgilUuid(training.argilAvatarId)
    ) {
      const avatar = await argilGetAvatar(training.argilAvatarId);
      const nextStatus = toTrainingStatus(avatar.status);

      if (nextStatus !== training.status || avatar.voiceId !== training.argilVoiceId) {
        const updated = await avatarTrainingStorage.update(training.id, {
          status: nextStatus,
          argilVoiceId: avatar.voiceId ?? training.argilVoiceId,
          errorMessage:
            nextStatus === "TRAINING_FAILED" || nextStatus === "REFUSED"
              ? "Treinamento falhou na Argil."
              : "",
        });

        if (isArgilAvatarTerminal(nextStatus) && training.profileId) {
          await syncProfileTrainingState(repository, {
            profileId: training.profileId,
            draftProfileId: training.draftProfileId,
            argilAvatarId: updated.argilAvatarId ?? training.argilAvatarId,
            argilVoiceId: updated.argilVoiceId ?? "",
            avatarTrainingStatus: nextStatus,
          });
        }

        return NextResponse.json({ training: updated, avatar });
      }
    }

    return NextResponse.json({ training });
  });
}
