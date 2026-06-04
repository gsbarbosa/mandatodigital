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
  heygenListAvatarLooks,
} from "@/lib/heygen";
import {
  resolveHeyGenTrainingPhase,
  trainingPhaseMessage,
} from "@/lib/heygen-twin-display";
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
        action?: "create" | "sync";
        avatarGroupId?: string;
        avatarLookId?: string;
        voiceId?: string;
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
      let consentStatus: string | null = null;
      let avatarGroupStatus: string | null = null;
      let voiceId = String(body.voiceId ?? "").trim();

      const trainAction = body.action === "sync" ? "sync" : "create";

      if (mode === "digital_twin" && trainAction === "sync") {
        const groupId = String(body.avatarGroupId ?? "").trim();
        if (!groupId) {
          return NextResponse.json(
            { message: "avatarGroupId ausente para sincronizar o treino." },
            { status: 400 },
          );
        }

        const groupResponse = await heygenGetAvatarGroup(groupId);
        const group = groupResponse.data?.avatar_group;
        consentStatus = group?.consent_status ?? null;
        avatarGroupStatus = group?.status ?? null;
        avatarGroupId = groupId;

        const preferredLookId = String(body.avatarLookId ?? "").trim();
        const looksResponse = await heygenListAvatarLooks({
          ownership: "private",
          avatarType: "digital_twin",
          groupId,
          limit: 50,
        });
        const looks = looksResponse.data ?? [];
        avatarId =
          preferredLookId && looks.some((look) => look.id === preferredLookId)
            ? preferredLookId
            : String(looks[0]?.id ?? "").trim();

        if (!avatarId) {
          return NextResponse.json(
            {
              message:
                "Nenhum look encontrado para este gêmeo. Remova o personagem e inicie um treino novo.",
            },
            { status: 404 },
          );
        }

        const consentNormalized = String(consentStatus ?? "").toLowerCase();
        if (
          consentNormalized &&
          consentNormalized !== "completed" &&
          consentNormalized !== "approved"
        ) {
          try {
            const consent = await heygenCreateAvatarConsent({
              groupId,
              rerouteUrl: appBaseUrl.startsWith("https://")
                ? `${appBaseUrl}/curador`
                : undefined,
            });
            consentUrl = consent.consentUrl;
          } catch (error) {
            const message = formatHeyGenError(error);
            if (!message.toLowerCase().includes("security code already binded")) {
              throw error;
            }
          }
        }

        if (!voiceId && voiceAudioAsset) {
          const voiceName = `${avatarName} (clone)`;
          const cloned = await heygenCloneVoice({
            voiceName,
            audio: { type: "url", url: voiceAudioUrl },
          });
          voiceId = cloned.voiceId;
        }
      } else if (mode === "digital_twin") {
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

            const avatar_group = (
              groupStatus as {
                data?: {
                  avatar_group?: {
                    consent_status?: string | null;
                    status?: string | null;
                  };
                };
              }
            )?.data?.avatar_group;

            consentStatus = avatar_group?.consent_status ?? null;
            avatarGroupStatus = avatar_group?.status ?? null;
          } else {
            throw error;
          }
        }

        try {
          const groupStatus = await heygenGetAvatarGroup(twin.groupId);
          consentStatus =
            groupStatus.data?.avatar_group?.consent_status ?? consentStatus;
          avatarGroupStatus = groupStatus.data?.avatar_group?.status ?? avatarGroupStatus;
        } catch {
          // ignore
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

      if (!voiceId) {
        const voiceName = `${avatarName} (clone)`;
        const cloned = await heygenCloneVoice({
          voiceName,
          audio: { type: "url", url: voiceAudioUrl },
        });
        voiceId = cloned.voiceId;
      }

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

      const trainingPhase = resolveHeyGenTrainingPhase({
        mode,
        consentStatus,
        groupStatus: avatarGroupStatus,
        consentUrl,
      });

      const messageByMode: Record<HeyGenTrainMode, string> = {
        digital_twin: trainingPhaseMessage(trainingPhase),
        photo: "Avatar e voz criados. Agora voce ja pode gerar videos.",
        caricature:
          "Voz clonada para o modo caricato. Agora gere o video com a caricatura aprovada.",
      };

      return NextResponse.json(
        {
          avatarId: avatarId || null,
          voiceId,
          avatarGroupId,
          consentUrl,
          consentStatus,
          avatarGroupStatus,
          trainingPhase,
          mode,
          action: trainAction,
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
