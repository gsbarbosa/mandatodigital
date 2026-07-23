import { NextResponse } from "next/server";

import { heygenApiRoute } from "@/lib/heygen-api-route";
import { handleRouteError } from "@/lib/api";
import { buildAvatarVideoTranscript } from "@/lib/avatar-video-script";
import {
  formatHeyGenError,
  heygenCreateDigitalTwin,
  heygenCreatePhotoAvatar,
  heygenGetAvatarGroup,
  heygenGetVoice,
  heygenListAvatarLooks,
} from "@/lib/heygen";
import { resolveHeyGenAvatarConsentLink } from "@/lib/heygen-consent-resolve";
import {
  buildHeyGenCloneVoiceName,
  resolveHeyGenClonedVoiceId,
} from "@/lib/heygen-voice-resolve";
import { isElevenLabsAudioVoiceProvider } from "@/lib/feature-flags";
import {
  buildElevenLabsCloneVoiceName,
  resolveElevenLabsVoiceId,
} from "@/lib/voice-provider-resolve";
import {
  resolveAvatarTrainingName,
  resolveDigitalTwinTrainingPhase,
  resolveHeyGenTrainingPhase,
  trainingPhaseMessage,
  twinGroupRequiresConsentLink,
  isConsentApproved,
} from "@/lib/heygen-twin-display";
import type { HeyGenAvatarLookListItem } from "@/lib/heygen";
import { resolveHeyGenDigitalTwinVideoInput } from "@/lib/heygen-training-video";
import {
  getTrainingAssetPublicUrl,
  pickAvatarImageAndVoiceAudioAssets,
  resolveAppBaseUrl,
  resolveCaricatureAsset,
} from "@/lib/training-asset-urls";

type HeyGenTrainMode = "photo" | "digital_twin" | "caricature" | "photo_real";

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    return heygenApiRoute(request, async (repository) => {
      const body = (await request.json().catch(() => ({}))) as {
        avatarName?: string;
        mode?: HeyGenTrainMode;
        caricatureAssetId?: string;
        action?: "create" | "sync";
        avatarGroupId?: string;
        avatarLookId?: string;
        voiceId?: string;
        elevenLabsVoiceId?: string;
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
      const trainingVideoAsset = latestVideoAsset;

      const avatarName = resolveAvatarTrainingName({
        fullName:
          String(body.avatarName ?? "").trim() || dashboard.profile?.fullName,
        role: dashboard.profile?.role,
        city: dashboard.profile?.city,
      });

      let avatarId = "";
      let avatarGroupId: string | null = null;
      let consentUrl: string | null = null;
      let consentStatus: string | null = null;
      let needsConsent = false;
      let avatarGroupStatus: string | null = null;
      let voiceId = String(body.voiceId ?? "").trim();
      let elevenLabsVoiceId = String(body.elevenLabsVoiceId ?? "").trim();
      let digitalTwinLookForPhase: HeyGenAvatarLookListItem | null = null;

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
        digitalTwinLookForPhase =
          (preferredLookId
            ? looks.find((look) => look.id === preferredLookId)
            : null) ?? looks[0] ?? null;
        avatarId = String(digitalTwinLookForPhase?.id ?? "").trim();

        if (!avatarId) {
          return NextResponse.json(
            {
              message:
                "Nenhum look encontrado para este gêmeo. Remova o personagem e inicie um treino novo.",
            },
            { status: 404 },
          );
        }

        const consentResolved = await resolveHeyGenAvatarConsentLink({
          groupId,
          consentStatus,
          rerouteUrl: appBaseUrl.startsWith("https://")
            ? `${appBaseUrl}/avatares/foto-real`
            : undefined,
        });
        consentUrl = consentResolved.consentUrl;
        consentStatus = consentResolved.consentStatus ?? consentStatus;
        needsConsent = consentResolved.needsConsent;

        if (!needsConsent || isConsentApproved(consentStatus)) {
          consentUrl = null;
          needsConsent = false;
        }
      } else if (mode === "digital_twin") {
        if (!trainingVideoAsset) {
          return NextResponse.json(
            {
              message:
                "Para o gêmeo digital, envie um vídeo de treino em Configurar avatar (MP4, MOV ou WebM).",
            },
            { status: 400 },
          );
        }

        const twinVideoInput = await resolveHeyGenDigitalTwinVideoInput(trainingVideoAsset);
        const twin = await heygenCreateDigitalTwin({
          name: avatarName,
          file: twinVideoInput,
        });
        avatarId = twin.avatarId;
        avatarGroupId = twin.groupId;

        try {
          const groupStatus = await heygenGetAvatarGroup(twin.groupId);
          consentStatus =
            groupStatus.data?.avatar_group?.consent_status ?? consentStatus;
          avatarGroupStatus = groupStatus.data?.avatar_group?.status ?? avatarGroupStatus;
        } catch {
          // ignore
        }

        if (twinGroupRequiresConsentLink(consentStatus, avatarGroupStatus)) {
          const consentResolved = await resolveHeyGenAvatarConsentLink({
            groupId: twin.groupId,
            consentStatus,
            requireFreshLink: true,
            rerouteUrl: appBaseUrl.startsWith("https://")
              ? `${appBaseUrl}/avatares/foto-real`
              : undefined,
          });
          consentUrl = consentResolved.consentUrl;
          consentStatus = consentResolved.consentStatus ?? consentStatus;
          needsConsent = consentResolved.needsConsent;
        }

        if (!needsConsent || isConsentApproved(consentStatus)) {
          consentUrl = null;
          needsConsent = false;
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
      } else if (mode === "photo_real") {
        if (!avatarImageAsset) {
          return NextResponse.json(
            { message: "Envie uma foto do rosto (PNG/JPEG) para usar a foto real." },
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

      if (isElevenLabsAudioVoiceProvider()) {
        elevenLabsVoiceId = await resolveElevenLabsVoiceId({
          requestedVoiceId: elevenLabsVoiceId || undefined,
          voiceName: buildElevenLabsCloneVoiceName(avatarName, voiceAudioAsset.id),
          audioUrl: voiceAudioUrl,
        });
        voiceId = "";
      } else {
        voiceId = await resolveHeyGenClonedVoiceId({
          requestedVoiceId: voiceId,
          voiceName: buildHeyGenCloneVoiceName(avatarName, voiceAudioAsset.id),
          audio: { type: "url", url: voiceAudioUrl },
        });
        elevenLabsVoiceId = "";

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
      }

      const trainingPhase =
        mode === "digital_twin"
          ? resolveDigitalTwinTrainingPhase({
              consentStatus,
              groupStatus: avatarGroupStatus,
              consentUrl,
              needsConsent,
              look: digitalTwinLookForPhase,
            })
          : resolveHeyGenTrainingPhase({
              mode,
              consentStatus,
              groupStatus: avatarGroupStatus,
              consentUrl,
              needsConsent,
            });

      const messageByMode: Record<HeyGenTrainMode, string> = {
        digital_twin: trainingPhaseMessage(trainingPhase, {
          hasConsentUrl: Boolean(consentUrl?.trim()),
        }),
        photo: "Avatar e voz criados. Agora voce ja pode gerar videos.",
        caricature:
          "Voz clonada para o modo caricato. Agora gere o video com a caricatura aprovada.",
        photo_real:
          "Voz clonada para foto real. Agora gere o video com a foto enviada em Configurar avatar.",
      };

      return NextResponse.json(
        {
          avatarId: avatarId || null,
          voiceId: voiceId || null,
          elevenLabsVoiceId: elevenLabsVoiceId || null,
          avatarGroupId,
          consentUrl,
          consentStatus,
          needsConsent,
          avatarGroupStatus,
          trainingPhase,
          mode,
          action: trainAction,
          caricatureAssetId: caricatureAsset?.id ?? null,
          voiceProvider: isElevenLabsAudioVoiceProvider()
            ? "elevenlabs_audio"
            : "heygen_clone",
          message: messageByMode[mode],
        },
        { status: 201 },
      );
    });
  } catch (error) {
    return handleRouteError(new Error(formatHeyGenError(error)));
  }
}
