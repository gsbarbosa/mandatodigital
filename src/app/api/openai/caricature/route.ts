import { NextResponse } from "next/server";

import { apiRoute } from "@/lib/auth/api-route";
import { handleRouteError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth/session";
import { isPremiumAccountMode } from "@/lib/dev-account-mode.server";
import {
  CARICATURE_VARIANT_FILENAMES,
  caricatureVariantLabel,
  type CaricatureVariant,
} from "@/lib/openai-caricature-prompts";
import {
  generateCaricatureFromPhoto,
  isOpenAiImageAuthorizationError,
} from "@/lib/openai-image";
import {
  downloadTrainingAsset,
  uploadTrainingAssetBuffer,
} from "@/lib/training-asset-storage";
import {
  getTrainingAssetPublicUrl,
  pickAvatarImageAndVoiceAudioAssets,
  resolveAppBaseUrl,
} from "@/lib/training-asset-urls";
import {
  guestCaricatureQuota,
  MAX_GUEST_CARICATURES_PER_VARIANT,
} from "@/lib/caricature-asset-variant";

export const maxDuration = 120;

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return NextResponse.json(
      {
        message:
          "OPENAI_API_KEY nao configurada no servidor. Adicione a chave nas variaveis da Vercel.",
      },
      { status: 503 },
    );
  }

  try {
    return apiRoute(async (repository) => {
      try {
        const body = (await request.json().catch(() => ({}))) as {
          sourceAssetId?: string;
          referenceId?: string;
          styleHint?: string;
          variant?: CaricatureVariant | string;
        };

        const variantRaw = String(body.variant ?? "editorial").trim();
        const variant: CaricatureVariant =
          variantRaw === "mascot_3d" ? "mascot_3d" : "editorial";

        const dashboard = await repository.getDashboard();
        const profileId = dashboard.profile?.id ?? null;
        const referenceId = String(body.referenceId ?? profileId ?? "").trim();

        if (!referenceId) {
          return NextResponse.json(
            {
              message:
                "Perfil nao encontrado. Salve o perfil e envie a foto antes de gerar.",
            },
            { status: 400 },
          );
        }

        const assets = await repository.listTrainingAssetsForReference(referenceId);
        const sessionUser = await getSessionUser();
        const premium = await isPremiumAccountMode(sessionUser?.email);
        if (!premium) {
          const quota = guestCaricatureQuota({ assets, variant });
          if (quota.reached) {
            const styleLabel = caricatureVariantLabel(variant);
            return NextResponse.json(
              {
                message: `Limite da versão para convidados atingido: no máximo ${MAX_GUEST_CARICATURES_PER_VARIANT} gerações de ${styleLabel} por conta.`,
                quota,
              },
              { status: 429 },
            );
          }
        }

        const sourceAssetId = String(body.sourceAssetId ?? "").trim();

        const sourceAsset = sourceAssetId
          ? assets.find(
              (asset) =>
                asset.id === sourceAssetId && asset.trainingRole === "avatar_image",
            )
          : pickAvatarImageAndVoiceAudioAssets(assets).avatarImageAsset;

        if (!sourceAsset) {
          return NextResponse.json(
            { message: "Envie uma foto do rosto antes de gerar a caricatura." },
            { status: 400 },
          );
        }

        const { buffer, mimeType } = await downloadTrainingAsset(sourceAsset);
        const caricature = await generateCaricatureFromPhoto({
          imageBuffer: buffer,
          mimeType,
          variant,
          styleHint: body.styleHint,
        });

        const storageReferenceId = profileId ?? referenceId;
        const uploaded = await uploadTrainingAssetBuffer({
          referenceId: storageReferenceId,
          filename: "caricatura.png",
          buffer: caricature.buffer,
          mimeType: caricature.mimeType,
        });

        const created = await repository.createTrainingAssets([
          {
            profileId,
            draftProfileId: profileId ? null : referenceId,
            sourceType: "upload",
            trainingRole: "avatar_caricature",
            storageProvider: uploaded.storageProvider,
            storageBucket: uploaded.storageBucket,
            storagePath: uploaded.storagePath,
            originalFilename: CARICATURE_VARIANT_FILENAMES[variant],
            mimeType: caricature.mimeType,
            sizeBytes: uploaded.sizeBytes,
            status: "uploaded",
            errorMessage: "",
          },
        ]);

        const asset = created[0];
        if (!asset) {
          throw new Error("Nao foi possivel registrar a caricatura gerada.");
        }

        const previewUrl = await getTrainingAssetPublicUrl(
          asset,
          resolveAppBaseUrl(request),
        );

        return NextResponse.json(
          {
            asset,
            previewUrl,
            model: caricature.model,
            variant,
            message:
              variant === "mascot_3d"
                ? "Mascote 3D gerado."
                : "Caricatura gerada.",
          },
          { status: 201 },
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Erro ao gerar caricatura com a IA.";

        if (isOpenAiImageAuthorizationError(message)) {
          return NextResponse.json(
            {
              message:
                "Não foi possível processar a imagem enviada. Tente outra foto ou tente novamente mais tarde.",
            },
            { status: 503 },
          );
        }

        return handleRouteError(error);
      }
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
