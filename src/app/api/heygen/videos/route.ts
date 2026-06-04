import { NextResponse } from "next/server";

import { apiRoute } from "@/lib/auth/api-route";
import { handleRouteError } from "@/lib/api";
import { buildAvatarVideoTranscript } from "@/lib/avatar-video-script";
import {
  formatHeyGenError,
  heygenCreateVideo,
  heygenCreateVideoFromImage,
  heygenGetAvatarLook,
  heygenGetUserMe,
} from "@/lib/heygen";
import { resolveAppBaseUrl } from "@/lib/training-asset-urls";
import {
  pickAvatarImageAndVoiceAudioAssets,
  resolveCaricatureAsset,
} from "@/lib/training-asset-urls";

function countWords(text: string) {
  return text
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function estimateSecondsFromWords(words: number) {
  // Aproximacao: 150 wpm ~ 2.5 w/s para voz PT-BR.
  return words / 2.5;
}

export async function POST(request: Request) {
  try {
    return apiRoute(async (repository) => {
      const body = (await request.json()) as {
        topic?: string;
        avatarId?: string;
        voiceId?: string;
        transcript?: string;
        name?: string;
        freePrompt?: string;
        generateMode?: "avatar" | "caricature";
        caricatureAssetId?: string;
      };

      const generateMode = body.generateMode === "caricature" ? "caricature" : "avatar";

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

      if (generateMode === "caricature") {
        if (!voiceId) {
          return NextResponse.json(
            {
              message:
                "Modo caricato exige voz clonada. Clique em Preparar voz (HeyGen) antes de gerar o video.",
            },
            { status: 400 },
          );
        }

        const assets = await repository.listTrainingAssetsForReference(
          dashboard.profile?.id ?? "",
        );
        const caricatureAsset = resolveCaricatureAsset(
          assets,
          body.caricatureAssetId,
        );
        if (!caricatureAsset) {
          return NextResponse.json(
            { message: "Gere e aprove a caricatura antes de produzir o video." },
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
        const { getTrainingAssetPublicUrl } = await import("@/lib/training-asset-urls");
        const imageUrl = await getTrainingAssetPublicUrl(caricatureAsset, appBaseUrl);

        const result = await heygenCreateVideoFromImage({
          image: { type: "url", url: imageUrl },
          voiceId,
          script: transcript,
          title: name ?? (topic ? `Curador v2 (caricato) - ${topic}` : "Curador v2 (caricato)"),
          aspectRatio: "9:16",
          resolution: "1080p",
          callbackUrl,
        });

        return NextResponse.json(
          {
            videoId: result.videoId,
            providerMode: "caricature_image",
            message: "Video caricato enviado para a HeyGen. Aguarde a renderizacao.",
          },
          { status: 201 },
        );
      }

      if (!avatarId) {
        return NextResponse.json(
          { message: "Avatar HeyGen ausente. Clique em Treinar (HeyGen) primeiro." },
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

      // Pre-flight: estima custo com base na duracao aproximada do texto.
      // Importante: o erro "Insufficient credit" costuma acontecer quando o roteiro fica longo
      // (especialmente quando o prompt livre vira texto de fala).
      try {
        const me = await heygenGetUserMe();
        const remaining = Number(me.data?.wallet?.remaining_balance ?? 0);
        const words = countWords(transcript);
        const seconds = estimateSecondsFromWords(words);
        const ratePerSecond = avatarType === "photo_avatar" ? 0.05 : 0.0667; // docs pricing (IV/V 1080p)
        const estimatedCost = seconds * ratePerSecond;

        if (remaining > 0 && estimatedCost > remaining) {
          return NextResponse.json(
            {
              message:
                `Saldo insuficiente no wallet da API da HeyGen. ` +
                `Saldo: $${remaining.toFixed(2)}. ` +
                `Estimativa: ~${Math.ceil(seconds)}s (~${words} palavras) ≈ $${estimatedCost.toFixed(2)}. ` +
                `Dica: encurte o roteiro/prompt livre para ~${Math.floor(
                  (remaining / ratePerSecond) * 2.5,
                )} palavras, ou adicione mais saldo.`,
            },
            { status: 402 },
          );
        }
      } catch {
        // Se o endpoint /v3/users/me falhar, nao bloqueia a geracao.
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
            message: "Video enviado para a HeyGen. Aguarde a renderizacao.",
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
        const { getTrainingAssetPublicUrl } = await import("@/lib/training-asset-urls");
        const imageUrl = await getTrainingAssetPublicUrl(avatarImageAsset, imageUrlBase);

        if (!voiceId) {
          throw new Error(
            `${message} (fallback por imagem exige uma voz selecionada/clonada).`,
          );
        }

        const result = await heygenCreateVideoFromImage({
          image: { type: "url", url: imageUrl },
          voiceId,
          script: transcript,
          title: name ?? `Curador v2 (fallback imagem) - ${topic}`,
          aspectRatio: "9:16",
          resolution: "1080p",
          callbackUrl,
        });

        return NextResponse.json(
          {
            videoId: result.videoId,
            providerMode: "image_fallback",
            message:
              "O avatar treinado nao foi aceito pela HeyGen (provavel consent/estado do look). " +
              "Gerei via input direto de imagem para voce ver o resultado end-to-end.",
          },
          { status: 201 },
        );
      }
    });
  } catch (error) {
    return handleRouteError(new Error(formatHeyGenError(error)));
  }
}

