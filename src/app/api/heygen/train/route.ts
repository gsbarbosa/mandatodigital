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
  heygenGetAvatarGroup,
  heygenGetVoice,
} from "@/lib/heygen";
import {
  getTrainingAssetPublicUrl,
  pickAvatarImageAndVoiceAudioAssets,
  resolveAppBaseUrl,
  resolveCaricatureAsset,
} from "@/lib/training-asset-urls";

type HeyGenTrainMode = "photo" | "digital_twin" | "caricature";

export async function POST(request: Request) {
  try {
    return apiRoute(async (repository) => {
      const body = (await request.json().catch(() => ({}))) as {
        avatarName?: string;
        mode?: HeyGenTrainMode;
        caricatureAssetId?: string;
      };

      const dashboard = await repository.getDashboard();
      const profileId = dashboard.profile?.id ?? null;
      if (!profileId) {
        return NextResponse.json({ message: "Perfil nao encontrado." }, { status: 400 });
      }

      const assets = await repository.listTrainingAssetsForReference(profileId);
      const { avatarImageAsset, voiceAudioAsset } =
        pickAvatarImageAndVoiceAudioAssets(assets);
      const caricatureAsset = resolveCaricatureAsset(
        assets,
        body.caricatureAssetId,
      );
      const latestVideoAsset =
        [...assets]
          .filter(
            (asset) =>
              asset.trainingRole === "dataset" &&
              String(asset.mimeType ?? "").toLowerCase().startsWith("video/"),
          )
          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0] ?? null;

      if (!voiceAudioAsset) {
        return NextResponse.json(
          { message: "Envie um audio de voz (MP3/WAV) para clonar a voz." },
          { status: 400 },
        );
      }

      const mode: HeyGenTrainMode = body.mode ?? "photo";
      const appBaseUrl = resolveAppBaseUrl(request);
      const assetBaseUrl = resolveAppBaseUrl(request);
      const voiceAudioUrl = await getTrainingAssetPublicUrl(voiceAudioAsset, assetBaseUrl);
      const trainingVideoUrl = latestVideoAsset
        ? await getTrainingAssetPublicUrl(latestVideoAsset, assetBaseUrl)
        : "";

      const avatarName =
        String(body.avatarName ?? "").trim() ||
        dashboard.profile?.fullName?.trim() ||
        "Mandato Digital Avatar";

      let avatarId = "";
      let avatarGroupId: string | null = null;
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
        avatarGroupId = twin.groupId;

        try {
          const consent = await heygenCreateAvatarConsent({
            groupId: twin.groupId,
            rerouteUrl: appBaseUrl.startsWith("https://")
              ? `${appBaseUrl}/curador`
              : undefined,
          });
          consentUrl = consent.consentUrl;
        } catch (error) {
          const message = formatHeyGenError(error);
          if (message.toLowerCase().includes("security code already binded")) {
            let groupStatus: unknown = null;
            try {
              groupStatus = await heygenGetAvatarGroup(twin.groupId);
            } catch {
              groupStatus = null;
            }

            return NextResponse.json(
              {
                avatarId,
                avatarGroupId: twin.groupId,
                voiceId: null,
                consentUrl: null,
                consentStatus: (groupStatus as { data?: { avatar_group?: { consent_status?: string | null; status?: string | null } } })?.data?.avatar_group?.consent_status ?? null,
                avatarGroupStatus: (groupStatus as { data?: { avatar_group?: { consent_status?: string | null; status?: string | null } } })?.data?.avatar_group?.status ?? null,
                message:
                  "O consentimento deste Digital Twin ja foi iniciado (security code ja vinculado). " +
                  "Abra o HeyGen e finalize o consentimento do grupo, ou selecione um Digital Twin existente na lista.",
              },
              { status: 202 },
            );
          }

          throw error;
        }
      } else if (mode === "caricature") {
        if (!caricatureAsset) {
          return NextResponse.json(
            {
              message:
                "Gere a caricatura a partir da foto antes de preparar a voz para o video caricato.",
            },
            { status: 400 },
          );
        }
      } else if (!avatarImageAsset) {
        return NextResponse.json(
          { message: "Envie uma foto do rosto (PNG/JPEG) para criar o avatar." },
          { status: 400 },
        );
      }

      if (mode === "photo" && avatarImageAsset) {
        const avatarImageUrl = await getTrainingAssetPublicUrl(avatarImageAsset, assetBaseUrl);
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

      const messageByMode: Record<HeyGenTrainMode, string> = {
        digital_twin:
          "Digital Twin iniciado. Abra o link de consentimento para finalizar. Depois gere videos.",
        photo: "Avatar e voz HeyGen criados. Agora voce ja pode gerar videos.",
        caricature:
          "Voz clonada para o modo caricato. Agora gere o video com a caricatura aprovada.",
      };

      return NextResponse.json(
        {
          avatarId: avatarId || null,
          voiceId,
          avatarGroupId,
          consentUrl,
          mode,
          caricatureAssetId: caricatureAsset?.id ?? null,
          message: messageByMode[mode],
        },
        { status: 201 },
      );
    });
  } catch (error) {
    return handleRouteError(new Error(formatHeyGenError(error)));
  }
}
