import { NextResponse } from "next/server";

import { apiRoute } from "@/lib/auth/api-route";
import { handleRouteError } from "@/lib/api";
import {
  CARICATURE_VARIANT_FILENAMES,
  type CaricatureVariant,
} from "@/lib/openai-caricature-prompts";
import { generateCaricatureFromPhoto } from "@/lib/openai-image";
import {
  downloadTrainingAsset,
  uploadTrainingAssetBuffer,
} from "@/lib/training-asset-storage";
import {
  getTrainingAssetPublicUrl,
  pickAvatarImageAndVoiceAudioAssets,
  resolveAppBaseUrl,
} from "@/lib/training-asset-urls";

export async function POST(request: Request) {
  try {
    return apiRoute(async (repository) => {
      const body = (await request.json().catch(() => ({}))) as {
        sourceAssetId?: string;
        styleHint?: string;
        variant?: CaricatureVariant | string;
      };

      const variantRaw = String(body.variant ?? "editorial").trim();
      const variant: CaricatureVariant =
        variantRaw === "mascot_3d" ? "mascot_3d" : "editorial";

      const dashboard = await repository.getDashboard();
      const profileId = dashboard.profile?.id ?? null;
      if (!profileId) {
        return NextResponse.json({ message: "Perfil nao encontrado." }, { status: 400 });
      }

      const assets = await repository.listTrainingAssetsForReference(profileId);
      const sourceAssetId = String(body.sourceAssetId ?? "").trim();

      let sourceAsset =
        sourceAssetId
          ? assets.find((asset) => asset.id === sourceAssetId && asset.trainingRole === "avatar_image")
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

      const uploaded = await uploadTrainingAssetBuffer({
        referenceId: profileId,
        filename: "caricatura.png",
        buffer: caricature.buffer,
        mimeType: caricature.mimeType,
      });

      const created = await repository.createTrainingAssets([
        {
          profileId,
          draftProfileId: null,
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
              ? "Modelo mascote 3D gerado."
              : "Modelo editorial gerado.",
        },
        { status: 201 },
      );
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
