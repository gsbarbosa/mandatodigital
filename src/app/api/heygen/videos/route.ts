import { NextResponse } from "next/server";

import { recordAuditEventFireAndForget } from "@/lib/audit/record";
import { heygenApiRoute } from "@/lib/heygen-api-route";
import { handleRouteError } from "@/lib/api";
import { buildAvatarVideoTranscript, countTranscriptWords } from "@/lib/avatar-video-script";
import {
  isDemoModeActiveForEmail,
  maxScriptWordsForPlan,
  maxVideoSecondsLabelForPlan,
} from "@/lib/demo-mode";
import {
  demoVideosExhaustedMessage,
  releaseDemoVideoQuota,
  tryConsumeDemoVideoQuota,
} from "@/lib/demo-usage-storage";
import { getUserRegistrationForOwner } from "@/lib/user-registration-storage";
import { getStorageOwnerUserId } from "@/lib/storage-context";
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
  requireOwnedTrainingAsset,
  resolveAppBaseUrl,
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
import type { ProfileTrainingAsset } from "@/lib/types";
import { appLog, appLogError, startTimer } from "@/lib/observability/log";

export const maxDuration = 300;

function auditVideoEvent(
  request: Request,
  profileId: string | null | undefined,
  payload: Record<string, unknown>,
  action: "video_generate" | "voice_job" = "video_generate",
) {
  recordAuditEventFireAndForget({
    request,
    profileId: profileId ?? null,
    action,
    payload,
  });
}

function assetIdsAudit(input: {
  voiceAudioAssetId?: string | null;
  avatarImageAssetId?: string | null;
  caricatureAssetId?: string | null;
}) {
  return {
    voiceAudioAssetId: input.voiceAudioAssetId?.trim() || null,
    avatarImageAssetId: input.avatarImageAssetId?.trim() || null,
    caricatureAssetId: input.caricatureAssetId?.trim() || null,
  };
}

function failAsset(result: { ok: false; message: string; status: 400 }) {
  return NextResponse.json({ message: result.message }, { status: result.status });
}

export async function POST(request: Request) {
  const routeElapsed = startTimer();
  const demoQuota = {
    release: null as null | (() => Promise<void>),
  };
  try {
    const response = await heygenApiRoute(request, async (repository) => {
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
        avatarImageAssetId?: string;
        voiceAudioAssetId?: string;
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
      const requestedVoiceAudioAssetId = String(body.voiceAudioAssetId ?? "").trim();
      const requestedAvatarImageAssetId = String(body.avatarImageAssetId ?? "").trim();
      const requestedCaricatureAssetId = String(body.caricatureAssetId ?? "").trim();

      const dashboard = await repository.getDashboard();
      const profileId = dashboard.profile?.id ?? null;

      appLog("heygen", "video_generate_started", {
        profileId,
        generateMode,
        voiceAudioAssetId: requestedVoiceAudioAssetId || null,
        avatarImageAssetId: requestedAvatarImageAssetId || null,
        caricatureAssetId: requestedCaricatureAssetId || null,
        hasAvatarId: Boolean(avatarId),
        transcriptWords: explicitTranscript
          ? countTranscriptWords(explicitTranscript)
          : 0,
        freePromptChars: freePrompt.length,
        asyncVoice: isAsyncVoiceEnabled(),
        elevenLabsProvider: isElevenLabsAudioVoiceProvider(),
        demoMode: isDemoModeActiveForEmail((await getSessionUser())?.email),
      });

      if (!topic && !explicitTranscript) {
        appLog(
          "heygen",
          "video_generate_rejected",
          { profileId, reason: "missing_topic_or_transcript" },
          "warn",
        );
        return NextResponse.json(
          { message: "Informe o tema do video ou um roteiro completo (prompt livre)." },
          { status: 400 },
        );
      }

      // DEMO: limite server-side por generateMode (antes só localStorage).
      const sessionForDemo = await getSessionUser();
      if (isDemoModeActiveForEmail(sessionForDemo?.email)) {
        const ownerUserId = getStorageOwnerUserId()?.trim() || "anonymous";
        const consumed = await tryConsumeDemoVideoQuota(ownerUserId, generateMode);
        if (!consumed.ok) {
          appLog(
            "heygen",
            "video_generate_rejected",
            { profileId, reason: "demo_video_quota", generateMode },
            "warn",
          );
          return NextResponse.json(
            { message: demoVideosExhaustedMessage(), demoUsage: consumed.usage },
            { status: 429 },
          );
        }
        demoQuota.release = () => releaseDemoVideoQuota(ownerUserId, generateMode);
      }

      const registration = await getUserRegistrationForOwner().catch((error) => {
        appLogError("heygen", "registration_lookup_failed", error, { profileId });
        return null;
      });
      const planId = registration?.planId || null;
      const maxScriptWords = maxScriptWordsForPlan(planId);
      const durationLabel = maxVideoSecondsLabelForPlan(planId).replace(/^até\s+/i, "");

      if (explicitTranscript && countTranscriptWords(explicitTranscript) > maxScriptWords) {
        appLog(
          "heygen",
          "video_generate_rejected",
          {
            profileId,
            reason: "script_too_long",
            transcriptWords: countTranscriptWords(explicitTranscript),
            maxScriptWords,
          },
          "warn",
        );
        return NextResponse.json(
          {
            message: `O roteiro excede o limite de ${maxScriptWords} palavras (${durationLabel}) do seu plano.`,
          },
          { status: 400 },
        );
      }

      if (generateMode === "caricature" || generateMode === "photo_real") {
        const assets = await repository.listTrainingAssetsForReference(
          dashboard.profile?.id ?? "",
        );

        const voiceResult = requireOwnedTrainingAsset(assets, {
          id: requestedVoiceAudioAssetId,
          role: "voice_audio",
          label: "áudio de voz",
        });
        if (!voiceResult.ok) {
          return failAsset({
            ...voiceResult,
            message:
              voiceResult.message.includes("Selecione")
                ? "Modo por foto exige áudio de voz. Envie um MP3/WAV em Configurar avatar e selecione o áudio antes de gerar o vídeo."
                : voiceResult.message,
          });
        }
        const voiceAudioAsset = voiceResult.asset;

        let imageAsset: ProfileTrainingAsset;
        if (generateMode === "photo_real") {
          const imageResult = requireOwnedTrainingAsset(assets, {
            id: requestedAvatarImageAssetId,
            role: "avatar_image",
            label: "foto do avatar",
          });
          if (!imageResult.ok) {
            return failAsset({
              ...imageResult,
              message: imageResult.message.includes("Selecione")
                ? "Envie a foto do rosto em Configurar avatar antes de produzir o vídeo."
                : imageResult.message,
            });
          }
          imageAsset = imageResult.asset;
        } else {
          const caricResult = requireOwnedTrainingAsset(assets, {
            id: requestedCaricatureAssetId,
            role: "avatar_caricature",
            label: "caricatura",
          });
          if (!caricResult.ok) {
            return failAsset({
              ...caricResult,
              message: caricResult.message.includes("Selecione")
                ? "Gere e aprove a caricatura no hub de Avatares antes de produzir o video."
                : caricResult.message,
            });
          }
          imageAsset = caricResult.asset;
        }

        const baseTranscript = explicitTranscript
          ? explicitTranscript
          : await buildAvatarVideoTranscript({
              topic,
              profile: dashboard.profile,
              maxWords: maxScriptWords,
              durationLabel,
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

        const resolvedAssetIds = assetIdsAudit({
          voiceAudioAssetId: voiceAudioAsset.id,
          avatarImageAssetId:
            generateMode === "photo_real" ? imageAsset.id : requestedAvatarImageAssetId,
          caricatureAssetId:
            generateMode === "caricature" ? imageAsset.id : requestedCaricatureAssetId,
        });

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
                  caricatureAssetId:
                    generateMode === "caricature" ? imageAsset.id : undefined,
                },
              },
            });
            auditVideoEvent(
              request,
              dashboard.profile?.id,
              {
                jobId: enqueued.jobId,
                generateMode,
                async: true,
                ...resolvedAssetIds,
              },
              "voice_job",
            );
            appLog("heygen", "video_generate_enqueued", {
              profileId,
              jobId: enqueued.jobId,
              generateMode,
              durationMs: routeElapsed(),
              ...resolvedAssetIds,
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
          auditVideoEvent(request, dashboard.profile?.id, {
            videoId: result.videoId,
            generateMode,
            voiceProvider: "elevenlabs_audio",
            ...resolvedAssetIds,
          });
          appLog("heygen", "video_generate_completed", {
            profileId,
            videoId: result.videoId,
            generateMode,
            voiceProvider: "elevenlabs_audio",
            durationMs: routeElapsed(),
            ...resolvedAssetIds,
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

        auditVideoEvent(request, dashboard.profile?.id, {
          videoId: value.videoId,
          generateMode,
          voiceProvider: "heygen_clone",
          ...resolvedAssetIds,
        });
        appLog("heygen", "video_generate_completed", {
          profileId,
          videoId: value.videoId,
          generateMode,
          voiceProvider: "heygen_clone",
          durationMs: routeElapsed(),
          ...resolvedAssetIds,
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
          { message: "Gêmeo digital ausente. Treine o avatar em Configurar avatar antes de gerar o vídeo." },
          { status: 400 },
        );
      }

      const baseTranscript = explicitTranscript
        ? explicitTranscript
        : await buildAvatarVideoTranscript({
            topic,
            profile: dashboard.profile,
            maxWords: maxScriptWords,
            durationLabel,
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
        appLog(
          "heygen",
          "avatar_look_lookup_failed",
          { avatarId, fallbackEngine: "avatar_iv" },
          "warn",
        );
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

      const twinAssets = await repository.listTrainingAssetsForReference(
        dashboard.profile?.id ?? "",
      );

      try {
        const supportsMotionPrompt = engine === "avatar_iv" && avatarType === "photo_avatar";
        const videoTitle = name ?? (topic ? `Curador v2 - ${topic}` : "Curador v2 - prompt livre");

        if (isElevenLabsAudioVoiceProvider()) {
          const twinVoiceResult = requireOwnedTrainingAsset(twinAssets, {
            id: requestedVoiceAudioAssetId,
            role: "voice_audio",
            label: "áudio de voz",
          });
          if (!twinVoiceResult.ok) {
            return failAsset({
              ...twinVoiceResult,
              message: twinVoiceResult.message.includes("Selecione")
                ? "Gêmeo digital com ElevenLabs exige o áudio de voz selecionado. Envie o áudio em Configurar avatar."
                : twinVoiceResult.message,
            });
          }
          const twinVoiceAsset = twinVoiceResult.asset;
          const twinAssetIds = assetIdsAudit({
            voiceAudioAssetId: twinVoiceAsset.id,
            avatarImageAssetId: requestedAvatarImageAssetId,
          });

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
            auditVideoEvent(request, dashboard.profile?.id, {
              videoId: result.videoId,
              generateMode: "avatar",
              voiceProvider: "elevenlabs_audio",
              ...twinAssetIds,
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

        auditVideoEvent(request, dashboard.profile?.id, {
          videoId: result.videoId,
          generateMode: "avatar",
          voiceProvider: "heygen_clone",
          ...assetIdsAudit({
            voiceAudioAssetId: requestedVoiceAudioAssetId,
            avatarImageAssetId: requestedAvatarImageAssetId,
          }),
        });
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

        const imageResult = requireOwnedTrainingAsset(twinAssets, {
          id: requestedAvatarImageAssetId,
          role: "avatar_image",
          label: "foto do avatar",
        });
        if (!imageResult.ok) {
          throw new Error(
            `${message} (e nao foi encontrada a foto selecionada para fallback de imagem).`,
          );
        }
        const voiceResult = requireOwnedTrainingAsset(twinAssets, {
          id: requestedVoiceAudioAssetId,
          role: "voice_audio",
          label: "áudio de voz",
        });
        if (!voiceResult.ok) {
          throw new Error(
            `${message} (fallback por imagem exige o áudio de voz selecionado em Configurar avatar).`,
          );
        }

        const avatarImageAsset = imageResult.asset;
        const voiceAudioAsset = voiceResult.asset;
        const fallbackAssetIds = assetIdsAudit({
          voiceAudioAssetId: voiceAudioAsset.id,
          avatarImageAssetId: avatarImageAsset.id,
        });

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
          auditVideoEvent(request, dashboard.profile?.id, {
            videoId: fallbackResult.videoId,
            providerMode: "image_fallback",
            voiceProvider: "elevenlabs_audio",
            ...fallbackAssetIds,
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

        auditVideoEvent(request, dashboard.profile?.id, {
          videoId: fallbackResult.videoId,
          providerMode: "image_fallback",
          voiceProvider: "heygen_clone",
          ...fallbackAssetIds,
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

    if (demoQuota.release && response.status >= 400) {
      await demoQuota.release();
    }
    return response;
  } catch (error) {
    if (demoQuota.release) {
      await demoQuota.release().catch(() => undefined);
    }
    appLogError("heygen", "video_generate_failed", error, {
      durationMs: routeElapsed(),
    });
    return handleRouteError(new Error(formatHeyGenError(error)));
  }
}
