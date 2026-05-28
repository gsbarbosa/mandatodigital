import { NextResponse } from "next/server";

import { apiRoute } from "@/lib/auth/api-route";
import { handleRouteError } from "@/lib/api";
import { buildAvatarVideoTranscript } from "@/lib/avatar-video-script";
import {
  formatHeyGenError,
  heygenCreateVideo,
  heygenCreateVideoFromImage,
  heygenGetAvatarLook,
} from "@/lib/heygen";
import { resolveAppBaseUrl } from "@/lib/training-asset-urls";
import { pickAvatarImageAndVoiceAudioAssets } from "@/lib/training-asset-urls";

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
      };

      const topic = String(body.topic ?? "").trim();
      const avatarId = String(body.avatarId ?? "").trim();
      const voiceId = String(body.voiceId ?? "").trim() || undefined;
      const explicitTranscript = String(body.transcript ?? "").trim();
      const freePrompt = String(body.freePrompt ?? "").trim();
      const name = String(body.name ?? "").trim() || undefined;

      if (!topic) {
        return NextResponse.json({ message: "Informe o tema do video." }, { status: 400 });
      }
      if (!avatarId) {
        return NextResponse.json(
          { message: "Avatar HeyGen ausente. Clique em Treinar (HeyGen) primeiro." },
          { status: 400 },
        );
      }
      // voiceId e opcional: se omitido, a HeyGen usa a voz padrao do avatar look (quando existir).

      const dashboard = await repository.getDashboard();
      const baseTranscript =
        explicitTranscript ||
        (await buildAvatarVideoTranscript({
          topic,
          profile: dashboard.profile,
        }));

      const transcript = freePrompt
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

      try {
        // `motion_prompt`/`expressiveness` nao sao suportados para video avatars (Digital Twin).
        // Para evitar regressao quando nao conseguimos inferir o avatar_type, so habilitamos
        // motion_prompt quando o look for explicitamente photo_avatar.
        const supportsMotionPrompt = engine === "avatar_iv" && avatarType === "photo_avatar";

        const baseCreatePayload = {
          avatarId,
          voiceId,
          script: transcript,
          title: name ?? `Curador v2 - ${topic}`,
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
          // Se a HeyGen rejeitar motion_prompt, tenta novamente sem esse campo.
          if (message.includes("motion_prompt is not supported")) {
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

