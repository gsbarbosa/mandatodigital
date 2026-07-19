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
import {
  resolveHeyGenVoiceWithRetryForImageVideo,
  resolveVideoSpeechForGeneration,
} from "@/lib/voice-provider-resolve";
import { isAsyncVoiceEnabled, isElevenLabsAudioVoiceProvider } from "@/lib/feature-flags";
import { getSessionUser } from "@/lib/auth/session";
import { toDatabaseOwnerUserId } from "@/lib/owner-user-id";
import {
  AsyncJobQuotaError,
  enqueueVoiceCreateVideoJob,
} from "@/lib/async-jobs-enqueue";

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    return heygenApiRoute(request, async (repository) => {
      const body = (await request.json()) as {
        topic?: string;
        avatarId?: string;
        voiceId?: string;
        elevenLabsVoiceId?: string;
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
      const elevenLabsVoiceId =
        String(body.elevenLabsVoiceId ?? "").trim() || undefined;
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
        const videoTitle =
          name ??
          (topic
            ? generateMode === "photo_real"
              ? `Curador v2 (foto real) - ${topic}`
              : `Curador v2 (caricato) - ${topic}`
            : generateMode === "photo_real"
              ? "Curador v2 (foto real)"
              : "Curador v2 (caricato)");

        if (isAsyncVoiceEnabled() && isElevenLabsAudioVoiceProvider()) {
          const sessionUser = await getSessionUser();
          if (!sessionUser?.id) {
            return NextResponse.json({ message: "Nao autenticado." }, { status: 401 });
          }
          try {
            const enqueued = await enqueueVoiceCreateVideoJob({
              ownerUserId: toDatabaseOwnerUserId(sessionUser.id),
              payload: {
                transcript,
                avatarName,
                voiceAudioAssetId: voiceAudioAsset.id,
                voiceAudioUrl,
                requestedElevenLabsVoiceId: elevenLabsVoiceId,
                requestedHeygenVoiceId: voiceId,
                createVideo: {
                  generateMode,
                  imageUrl,
                  title: videoTitle,
                  caricatureAssetId: body.caricatureAssetId?.trim() || undefined,
                },
              },
            });
            return NextResponse.json(
              {
                jobId: enqueued.jobId,
                async: true,
                voiceProvider: "elevenlabs_audio",
                providerMode:
                  generateMode === "photo_real" ? "photo_real_image" : "caricature_image",
                message:
                  "Voz e video enfileirados. Aguarde o processamento assincrono.",
              },
              { status: 202 },
            );
          } catch (error) {
            if (error instanceof AsyncJobQuotaError) {
              return NextResponse.json({ message: error.message }, { status: 429 });
            }
            throw error;
          }
        }

        const speech = await resolveVideoSpeechForGeneration({
          transcript,
          avatarName,
          voiceAudioAssetId: voiceAudioAsset.id,
          voiceAudioUrl,
          requestedHeygenVoiceId: voiceId,
          requestedElevenLabsVoiceId: elevenLabsVoiceId,
          mediaId: `image-${Date.now()}`,
        });

        let result: { videoId: string };
        if (speech.provider === "elevenlabs_audio") {
          result = await heygenCreateVideoFromImage({
            image: { type: "url", url: imageUrl },
            audioUrl: speech.audioUrl,
            title: videoTitle,
            aspectRatio: "9:16",
            resolution: "1080p",
            callbackUrl,
          });
          return NextResponse.json(
            {
              videoId: result.videoId,
              elevenLabsVoiceId: speech.elevenLabsVoiceId,
              voiceId: null,
              voiceProvider: "elevenlabs_audio",
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

        const { voiceId: resolvedVoiceId, value } =
          await resolveHeyGenVoiceWithRetryForImageVideo({
            requestedVoiceId: voiceId,
            avatarName,
            voiceAudioAssetId: voiceAudioAsset.id,
            voiceAudioUrl,
            run: async (activeVoiceId) =>
              heygenCreateVideoFromImage({
                image: { type: "url", url: imageUrl },
                voiceId: activeVoiceId,
                script: transcript,
                title: videoTitle,
                aspectRatio: "9:16",
                resolution: "1080p",
                callbackUrl,
              }),
          });

        return NextResponse.json(
          {
            videoId: value.videoId,
            voiceId: resolvedVoiceId,
            elevenLabsVoiceId: null,
            voiceProvider: "heygen_clone",
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

      // Gêmeo digital: se ElevenLabs estiver ativo e houver amostra, usa audio_url;
      // senão mantém script+voiceId (voz padrão do look ou clone HeyGen enviado).
      const twinAssets = await repository.listTrainingAssetsForReference(
        dashboard.profile?.id ?? "",
      );
      const { voiceAudioAsset: twinVoiceAsset } =
        pickAvatarImageAndVoiceAudioAssets(twinAssets);

      try {
        const supportsMotionPrompt = engine === "avatar_iv" && avatarType === "photo_avatar";
        const videoTitle = name ?? (topic ? `Curador v2 - ${topic}` : "Curador v2 - prompt livre");

        if (twinVoiceAsset && isElevenLabsAudioVoiceProvider()) {
          const speech = await resolveVideoSpeechForGeneration({
            transcript,
            avatarName: resolveAvatarTrainingName({
              fullName: dashboard.profile?.fullName,
              role: dashboard.profile?.role,
              city: dashboard.profile?.city,
            }),
            voiceAudioAssetId: twinVoiceAsset.id,
            voiceAudioUrl: await getTrainingAssetPublicUrl(twinVoiceAsset, appBaseUrl),
            requestedHeygenVoiceId: voiceId,
            requestedElevenLabsVoiceId: elevenLabsVoiceId,
            mediaId: `avatar-${avatarId}`,
          });

          if (speech.provider === "elevenlabs_audio") {
            const result = await heygenCreateVideo({
              avatarId,
              audioUrl: speech.audioUrl,
              title: videoTitle,
              aspectRatio: "9:16",
              resolution: "1080p",
              callbackUrl,
              engine,
            });
            return NextResponse.json(
              {
                videoId: result.videoId,
                elevenLabsVoiceId: speech.elevenLabsVoiceId,
                voiceProvider: "elevenlabs_audio",
                providerMode: "avatar",
                message: "Vídeo enviado para renderização. Aguarde.",
              },
              { status: 201 },
            );
          }
        }

        const baseCreatePayload = {
          avatarId,
          voiceId,
          script: transcript,
          title: videoTitle,
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
              ? { motionPrompt: "nodding gently", expressiveness: "medium" as const }
              : null),
          });
        } catch (error) {
          const message = formatHeyGenError(error);
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
            voiceProvider: "heygen_clone",
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

        const assets = await repository.listTrainingAssetsForReference(
          dashboard.profile?.id ?? "",
        );
        const { avatarImageAsset, voiceAudioAsset } =
          pickAvatarImageAndVoiceAudioAssets(assets);
        if (!avatarImageAsset) {
          throw new Error(
            `${message} (e nao foi encontrada foto para fallback de imagem).`,
          );
        }
        if (!voiceAudioAsset) {
          throw new Error(
            `${message} (fallback por imagem exige áudio de voz enviado no Curador).`,
          );
        }

        const imageUrlBase = resolveAppBaseUrl(request);
        const imageUrl = await getTrainingAssetPublicUrl(avatarImageAsset, imageUrlBase);
        const voiceAudioUrl = await getTrainingAssetPublicUrl(voiceAudioAsset, imageUrlBase);
        const avatarName = resolveAvatarTrainingName({
          fullName: dashboard.profile?.fullName,
          role: dashboard.profile?.role,
          city: dashboard.profile?.city,
        });

        const speech = await resolveVideoSpeechForGeneration({
          transcript,
          avatarName,
          voiceAudioAssetId: voiceAudioAsset.id,
          voiceAudioUrl,
          requestedHeygenVoiceId: voiceId,
          requestedElevenLabsVoiceId: elevenLabsVoiceId,
          mediaId: `fallback-${Date.now()}`,
        });

        if (speech.provider === "elevenlabs_audio") {
          const fallbackResult = await heygenCreateVideoFromImage({
            image: { type: "url", url: imageUrl },
            audioUrl: speech.audioUrl,
            title: name ?? `Curador v2 (fallback imagem) - ${topic}`,
            aspectRatio: "9:16",
            resolution: "1080p",
            callbackUrl,
          });
          return NextResponse.json(
            {
              videoId: fallbackResult.videoId,
              elevenLabsVoiceId: speech.elevenLabsVoiceId,
              voiceProvider: "elevenlabs_audio",
              providerMode: "image_fallback",
              message:
                "O avatar treinado não foi aceito pela plataforma (consentimento ou estado do personagem). " +
                "Geramos via imagem direta para você ver o resultado.",
            },
            { status: 201 },
          );
        }

        const { value: fallbackResult } = await resolveHeyGenVoiceWithRetryForImageVideo({
          requestedVoiceId: voiceId,
          avatarName,
          voiceAudioAssetId: voiceAudioAsset.id,
          voiceAudioUrl,
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
            voiceProvider: "heygen_clone",
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
