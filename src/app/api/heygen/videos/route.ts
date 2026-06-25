import { NextResponse } from "next/server";

import { heygenApiRoute } from "@/lib/heygen-api-route";
import { handleRouteError } from "@/lib/api";
import { buildAvatarVideoTranscript } from "@/lib/avatar-video-script";
import {
  formatHeyGenError,
  heygenCreateVideo,
  heygenCreateVideoFromImage,
  heygenGetAvatarLook,
} from "@/lib/heygen";
import { resolveHeyGenClonedVoiceIdWithRetry } from "@/lib/heygen-voice-resolve";
import { resolveAvatarTrainingName } from "@/lib/heygen-twin-display";
import {
  checkHeyGenWalletForVideo,
  HEYGEN_DIGITAL_TWIN_VIDEO_RATE_PER_SECOND,
  HEYGEN_PHOTO_IMAGE_VIDEO_RATE_PER_SECOND,
} from "@/lib/heygen-credit-preflight";
import {
  getTrainingAssetPublicUrl,
  pickAvatarImageAndVoiceAudioAssets,
  resolveAppBaseUrl,
  resolveCaricatureAsset,
} from "@/lib/training-asset-urls";

export async function POST(request: Request) {
  try {
    return heygenApiRoute(request, async (repository) => {
      const body = (await request.json()) as {
        topic?: string;
        avatarId?: string;
        voiceId?: string;
        transcript?: string;
        name?: string;
        freePrompt?: string;
        generateMode?: "avatar" | "caricature" | "photo_real";
        caricatureAssetId?: string;
      };

      const generateMode =
        body.generateMode === "caricature"
          ? "caricature"
          : body.generateMode === "photo_real"
            ? "photo_real"
            : "avatar";

      const topic = String(body.topic ?? "").trim();
      const avatarId = String(body.avatarId ?? "").trim();
      const voiceId = String(body.voiceId ?? "").trim() || undefined;
      const explicitTranscript = String(body.transcript ?? "").trim();
      const freePrompt = String(body.freePrompt ?? "").trim();
      const name = String(body.name ?? "").trim() || undefined;

      if (!topic && !explicitTranscript) {
        return NextResponse.json(
          { message: "Informe o tema do video ou um roteiro completo (prompt livre)." },
          { status: 400 },
        );
      }

      const dashboard = await repository.getDashboard();

      if (generateMode === "caricature" || generateMode === "photo_real") {
        const assets = await repository.listTrainingAssetsForReference(
          dashboard.profile?.id ?? "",
        );
        const { voiceAudioAsset, avatarImageAsset } =
          pickAvatarImageAndVoiceAudioAssets(assets);
        if (!voiceAudioAsset) {
          return NextResponse.json(
            {
              message:
                "Modo por foto exige áudio de voz. Envie um MP3/WAV no Curador antes de gerar o vídeo.",
            },
            { status: 400 },
          );
        }

        const imageAsset =
          generateMode === "photo_real"
            ? avatarImageAsset
            : resolveCaricatureAsset(assets, body.caricatureAssetId);

        if (!imageAsset) {
          return NextResponse.json(
            {
              message:
                generateMode === "photo_real"
                  ? "Envie a foto do rosto no Curador antes de produzir o vídeo."
                  : "Gere e aprove a caricatura antes de produzir o video.",
            },
            { status: 400 },
          );
        }

        const baseTranscript = explicitTranscript
          ? explicitTranscript
          : await buildAvatarVideoTranscript({
              topic,
              profile: dashboard.profile,
            });

        const transcript = explicitTranscript
          ? baseTranscript
          : freePrompt
            ? `${baseTranscript}\n\nInstrucoes adicionais (prompt livre):\n${freePrompt}`
            : baseTranscript;

        const walletCheck = await checkHeyGenWalletForVideo({
          transcript,
          ratePerSecond: HEYGEN_PHOTO_IMAGE_VIDEO_RATE_PER_SECOND,
          modeLabel:
            generateMode === "photo_real"
              ? "foto real (imagem 1080p)"
              : "caricatura (imagem 1080p)",
        });
        if (!walletCheck.ok) {
          return NextResponse.json({ message: walletCheck.message }, { status: 402 });
        }

        const appBaseUrl = resolveAppBaseUrl(request);
        const callbackUrl = appBaseUrl.startsWith("https://")
          ? `${appBaseUrl}/api/heygen/webhooks`
          : undefined;
        const imageUrl = await getTrainingAssetPublicUrl(imageAsset, appBaseUrl);
        const voiceAudioUrl = await getTrainingAssetPublicUrl(voiceAudioAsset, appBaseUrl);
        const avatarName = resolveAvatarTrainingName({
          fullName: dashboard.profile?.fullName,
          role: dashboard.profile?.role,
          city: dashboard.profile?.city,
        });
        const { voiceId: resolvedVoiceId, value: result } =
          await resolveHeyGenClonedVoiceIdWithRetry({
          requestedVoiceId: voiceId,
          voiceName: `${avatarName} (clone)`,
          audio: { type: "url", url: voiceAudioUrl },
          run: async (activeVoiceId) =>
            heygenCreateVideoFromImage({
              image: { type: "url", url: imageUrl },
              voiceId: activeVoiceId,
              script: transcript,
              title:
                name ??
                (topic
                  ? generateMode === "photo_real"
                    ? `Curador v2 (foto real) - ${topic}`
                    : `Curador v2 (caricato) - ${topic}`
                  : generateMode === "photo_real"
                    ? "Curador v2 (foto real)"
                    : "Curador v2 (caricato)"),
              aspectRatio: "9:16",
              resolution: "1080p",
              callbackUrl,
            }),
        });

        return NextResponse.json(
          {
            videoId: result.videoId,
            voiceId: resolvedVoiceId,
            providerMode:
              generateMode === "photo_real" ? "photo_real_image" : "caricature_image",
            message:
              generateMode === "photo_real"
                ? "Vídeo com foto real enviado para renderização. Aguarde."
                : "Vídeo caricato enviado para renderização. Aguarde.",
          },
          { status: 201 },
        );
      }

      if (!avatarId) {
        return NextResponse.json(
          { message: "Gêmeo digital ausente. Treine no Curador antes de gerar o vídeo." },
          { status: 400 },
        );
      }
      // voiceId e opcional: se omitido, a HeyGen usa a voz padrao do avatar look (quando existir).

      const baseTranscript = explicitTranscript
        ? explicitTranscript
        : await buildAvatarVideoTranscript({
            topic,
            profile: dashboard.profile,
          });

      const transcript = explicitTranscript
        ? baseTranscript
        : freePrompt
          ? `${baseTranscript}\n\nInstrucoes adicionais (prompt livre):\n${freePrompt}`
          : baseTranscript;

      const appBaseUrl = resolveAppBaseUrl(request);
      const callbackUrl = appBaseUrl.startsWith("https://")
        ? `${appBaseUrl}/api/heygen/webhooks`
        : undefined;

      let engine: "avatar_iv" | "avatar_v" = "avatar_iv";
      let avatarType: string | null = null;
      try {
        const look = await heygenGetAvatarLook(avatarId);
        avatarType = look.data?.avatar_look?.avatar_type ?? null;
        const supported = look.data?.avatar_look?.supported_api_engines ?? [];
        if (supported.includes("avatar_v")) {
          engine = "avatar_v";
        }
      } catch {
        // ignore (fallback to avatar_iv)
      }

      const walletCheck = await checkHeyGenWalletForVideo({
        transcript,
        ratePerSecond:
          avatarType === "photo_avatar"
            ? HEYGEN_PHOTO_IMAGE_VIDEO_RATE_PER_SECOND
            : HEYGEN_DIGITAL_TWIN_VIDEO_RATE_PER_SECOND,
        modeLabel: avatarType === "photo_avatar" ? "foto avatar 1080p" : "gêmeo digital 1080p",
      });
      if (!walletCheck.ok) {
        return NextResponse.json({ message: walletCheck.message }, { status: 402 });
      }

      try {
        // `motion_prompt`/`expressiveness` nao sao suportados para video avatars (Digital Twin).
        // Para evitar regressao quando nao conseguimos inferir o avatar_type, so habilitamos
        // motion_prompt quando o look for explicitamente photo_avatar.
        const supportsMotionPrompt = engine === "avatar_iv" && avatarType === "photo_avatar";

        const baseCreatePayload = {
          avatarId,
          voiceId,
          script: transcript,
          title: name ?? (topic ? `Curador v2 - ${topic}` : "Curador v2 - prompt livre"),
          aspectRatio: "9:16" as const,
          resolution: "1080p" as const,
          callbackUrl,
          engine,
        };

        let result;
        try {
          result = await heygenCreateVideo({
            ...baseCreatePayload,
            ...(supportsMotionPrompt
              ? { motionPrompt: "nodding gently", expressiveness: "medium" }
              : null),
          });
        } catch (error) {
          const message = formatHeyGenError(error);
          // Se a HeyGen rejeitar controles de motion, tenta novamente sem eles.
          if (
            message.includes("motion_prompt is not supported") ||
            message.includes("expressiveness is not supported")
          ) {
            result = await heygenCreateVideo(baseCreatePayload);
          } else {
            throw error;
          }
        }

        return NextResponse.json(
          {
            videoId: result.videoId,
            providerMode: "avatar",
            message: "Vídeo enviado para renderização. Aguarde.",
          },
          { status: 201 },
        );
      } catch (error) {
        const message = formatHeyGenError(error);
        const isUnsupported =
          message.includes("is not supported") || message.includes("not supported");

        if (!isUnsupported) {
          throw error;
        }

        // Fallback: se o look nao for elegivel, gera via input direto de imagem.
        const assets = await repository.listTrainingAssetsForReference(
          dashboard.profile?.id ?? "",
        );
        const { avatarImageAsset } = pickAvatarImageAndVoiceAudioAssets(assets);
        if (!avatarImageAsset) {
          throw new Error(
            `${message} (e nao foi encontrada foto para fallback de imagem).`,
          );
        }

        const imageUrlBase = resolveAppBaseUrl(request);
        const imageUrl = await getTrainingAssetPublicUrl(avatarImageAsset, imageUrlBase);
        const { voiceAudioAsset } = pickAvatarImageAndVoiceAudioAssets(assets);
        if (!voiceAudioAsset) {
          throw new Error(
            `${message} (fallback por imagem exige áudio de voz enviado no Curador).`,
          );
        }

        const voiceAudioUrl = await getTrainingAssetPublicUrl(voiceAudioAsset, imageUrlBase);
        const avatarName = resolveAvatarTrainingName({
          fullName: dashboard.profile?.fullName,
          role: dashboard.profile?.role,
          city: dashboard.profile?.city,
        });
        const { value: fallbackResult } = await resolveHeyGenClonedVoiceIdWithRetry({
          requestedVoiceId: voiceId,
          voiceName: `${avatarName} (clone)`,
          audio: { type: "url", url: voiceAudioUrl },
          run: async (activeVoiceId) =>
            heygenCreateVideoFromImage({
              image: { type: "url", url: imageUrl },
              voiceId: activeVoiceId,
              script: transcript,
              title: name ?? `Curador v2 (fallback imagem) - ${topic}`,
              aspectRatio: "9:16",
              resolution: "1080p",
              callbackUrl,
            }),
        });

        return NextResponse.json(
          {
            videoId: fallbackResult.videoId,
            providerMode: "image_fallback",
            message:
              "O avatar treinado não foi aceito pela plataforma (consentimento ou estado do personagem). " +
              "Geramos via imagem direta para você ver o resultado.",
          },
          { status: 201 },
        );
      }
    });
  } catch (error) {
    return handleRouteError(new Error(formatHeyGenError(error)));
  }
}

