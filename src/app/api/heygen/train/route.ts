import { NextResponse } from "next/server";

import { apiRoute } from "@/lib/auth/api-route";
import { handleRouteError } from "@/lib/api";
import { buildAvatarVideoTranscript } from "@/lib/avatar-video-script";
import {
  formatHeyGenError,
  heygenCloneVoice,
  heygenCreateAvatarConsent,
  heygenCreateDigitalTwin,
  heygenCreatePhotoAvatar,
  heygenGetVoice,
} from "@/lib/heygen";
import {
  getTrainingAssetPublicUrl,
  pickAvatarImageAndVoiceAudioAssets,
  resolveAppBaseUrl,
} from "@/lib/training-asset-urls";

export async function POST(request: Request) {
  try {
    return apiRoute(async (repository) => {
      const body = (await request.json().catch(() => ({}))) as {
        avatarName?: string;
        mode?: "photo" | "digital_twin";
      };

      const dashboard = await repository.getDashboard();
      const profileId = dashboard.profile?.id ?? null;
      if (!profileId) {
        return NextResponse.json({ message: "Perfil nao encontrado." }, { status: 400 });
      }

      const assets = await repository.listTrainingAssetsForReference(profileId);
      const { avatarImageAsset, voiceAudioAsset } =
        pickAvatarImageAndVoiceAudioAssets(assets);
      const latestVideoAsset =
        [...assets]
          .filter(
            (asset) =>
              asset.trainingRole === "dataset" &&
              String(asset.mimeType ?? "").toLowerCase().startsWith("video/"),
          )
          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0] ?? null;

      if (!avatarImageAsset) {
        return NextResponse.json(
          { message: "Envie uma foto do rosto (PNG/JPEG) para criar o avatar." },
          { status: 400 },
        );
      }

      if (!voiceAudioAsset) {
        return NextResponse.json(
          { message: "Envie um audio de voz (MP3/WAV) para clonar a voz." },
          { status: 400 },
        );
      }

      const appBaseUrl = resolveAppBaseUrl(request);
      const assetBaseUrl = resolveAppBaseUrl(request);
      const avatarImageUrl = await getTrainingAssetPublicUrl({
        asset: avatarImageAsset,
        repository,
        appBaseUrl: assetBaseUrl,
      });
      const voiceAudioUrl = await getTrainingAssetPublicUrl({
        asset: voiceAudioAsset,
        repository,
        appBaseUrl: assetBaseUrl,
      });
      const trainingVideoUrl = latestVideoAsset
        ? await getTrainingAssetPublicUrl({
            asset: latestVideoAsset,
            repository,
            appBaseUrl: assetBaseUrl,
          })
        : "";

      const avatarName =
        String(body.avatarName ?? "").trim() ||
        dashboard.profile?.fullName?.trim() ||
        "Mandato Digital Avatar";

      const mode = body.mode ?? "photo";

      let avatarId = "";
      let consentUrl: string | null = null;

      if (mode === "digital_twin") {
        if (!trainingVideoUrl) {
          return NextResponse.json(
            {
              message:
                "Para Realismo Maximo (Digital Twin), envie um video MP4 no slot de treino de video (HeyGen).",
            },
            { status: 400 },
          );
        }

        const twin = await heygenCreateDigitalTwin({
          name: `${avatarName} (digital twin)`,
          file: { type: "url", url: trainingVideoUrl },
        });
        avatarId = twin.avatarId;

        const consent = await heygenCreateAvatarConsent({
          groupId: twin.groupId,
          rerouteUrl: appBaseUrl.startsWith("https://")
            ? `${appBaseUrl}/curador-v2`
            : undefined,
        });
        consentUrl = consent.consentUrl;
      } else {
        const photo = await heygenCreatePhotoAvatar({
          name: avatarName,
          file: { type: "url", url: avatarImageUrl },
        });
        avatarId = photo.avatarId;
      }

      const voiceName = `${avatarName} (clone)`;
      const { voiceId } = await heygenCloneVoice({
        voiceName,
        audio: { type: "url", url: voiceAudioUrl },
      });

      // Best-effort: force a small voice poll so the UI gets a clearer status quickly.
      // If the voice is not ready yet, the UI can still proceed (HeyGen will queue).
      try {
        void buildAvatarVideoTranscript({
          topic: "Teste",
          profile: dashboard.profile,
        });
        await Promise.race([
          heygenGetVoice(voiceId),
          new Promise((resolve) => setTimeout(resolve, 2500)),
        ]);
      } catch {
        // ignore
      }

      return NextResponse.json(
        {
          avatarId,
          voiceId,
          consentUrl,
          message:
            mode === "digital_twin"
              ? "Digital Twin iniciado. Abra o link de consentimento para finalizar. Depois gere videos."
              : "Avatar e voz HeyGen criados. Agora voce ja pode gerar videos.",
        },
        { status: 201 },
      );
    });
  } catch (error) {
    return handleRouteError(new Error(formatHeyGenError(error)));
  }
}

