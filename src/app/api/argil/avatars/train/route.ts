import { NextResponse } from "next/server";

import {
  avatarTrainingStorage,
  isAvatarTrainingTerminal,
} from "@/lib/avatar-training-storage";
import { handleRouteError } from "@/lib/api";
import {
  argilCreateAvatarFromVideo,
  argilGetAvatar,
  getArgilConfig,
  isArgilAvatarTerminal,
} from "@/lib/argil";
import { getRepository } from "@/lib/storage";
import {
  getTrainingAssetPublicUrl,
  pickDatasetAndConsentAssets,
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

async function syncProfileTrainingState(input: {
  profileId: string | null;
  draftProfileId: string | null;
  argilAvatarId: string;
  argilVoiceId: string;
  avatarTrainingStatus: AvatarTrainingStatus;
}) {
  if (!input.profileId) {
    return;
  }

  await getRepository().updateProfileArgilTraining(input.profileId, {
    argilAvatarId: input.argilAvatarId,
    argilVoiceId: input.argilVoiceId,
    avatarTrainingStatus: input.avatarTrainingStatus,
  });
}

export async function POST(request: Request) {
  try {
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
    const assets = await getRepository().listTrainingAssetsForReference(referenceId);
    const { datasetAsset, consentAsset } = pickDatasetAndConsentAssets(assets);

    if (!config.dryRun) {
      if (!datasetAsset) {
        return NextResponse.json(
          {
            message:
              "Envie ao menos um video de treinamento antes de iniciar o treinamento na Argil.",
          },
          { status: 400 },
        );
      }

      if (!consentAsset) {
        return NextResponse.json(
          {
            message:
              "Para treinar na Argil, envie dois videos: um de treino (3+ min) e um curto de consentimento (ate 30s).",
          },
          { status: 400 },
        );
      }
    }

    const dashboard = await getRepository().getDashboard();
    const avatarName =
      String(body.avatarName ?? "").trim() ||
      dashboard.profile?.fullName?.trim() ||
      "Mandato Digital Avatar";

    const baseUrl = resolveAppBaseUrl(request);
    const datasetVideoUrl = config.dryRun
      ? "https://example.com/dry-run-dataset.mp4"
      : await getTrainingAssetPublicUrl(datasetAsset!, baseUrl);
    const consentVideoUrl = config.dryRun
      ? "https://example.com/dry-run-consent.mp4"
      : await getTrainingAssetPublicUrl(consentAsset!, baseUrl);

    const training = await avatarTrainingStorage.create({
      profileId,
      draftProfileId: profileId ? null : draftProfileId,
      status: "TRAINING",
      dryRun: config.dryRun,
      datasetAssetId: datasetAsset?.id ?? null,
      consentAssetId: consentAsset?.id ?? null,
      avatarName,
    });

    const result = await argilCreateAvatarFromVideo({
      name: avatarName,
      datasetVideoUrl,
      consentVideoUrl,
      extras: {
        source: "mandato-digital",
        trainingId: training.id,
        ...(profileId ? { profileId } : {}),
        ...(draftProfileId ? { draftProfileId } : {}),
      },
    });

    let updated = await avatarTrainingStorage.update(training.id, {
      argilAvatarId: result.avatar.id,
      argilVoiceId: result.avatar.voiceId ?? null,
      status: toTrainingStatus(result.avatar.status),
    });

    if (config.dryRun) {
      updated = await avatarTrainingStorage.update(training.id, {
        argilAvatarId: result.avatar.id,
        argilVoiceId: "dry-run-voice-id",
        status: "IDLE",
        errorMessage: "",
      });

      await syncProfileTrainingState({
        profileId,
        draftProfileId,
        argilAvatarId: updated.argilAvatarId ?? result.avatar.id,
        argilVoiceId: updated.argilVoiceId ?? "dry-run-voice-id",
        avatarTrainingStatus: "IDLE",
      });
    } else if (profileId) {
      await syncProfileTrainingState({
        profileId,
        draftProfileId,
        argilAvatarId: result.avatar.id,
        argilVoiceId: result.avatar.voiceId ?? "",
        avatarTrainingStatus: toTrainingStatus(result.avatar.status),
      });
    }

    return NextResponse.json(
      {
        dryRun: result.dryRun,
        training: updated,
        avatar: result.avatar,
        debug: result.dryRun ? result.request : undefined,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function GET(request: Request) {
  try {
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
      !isAvatarTrainingTerminal(training.status)
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
          await syncProfileTrainingState({
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
  } catch (error) {
    return handleRouteError(error);
  }
}
