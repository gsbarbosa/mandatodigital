import { NextResponse } from "next/server";

import { isApiUser, requireApiUser } from "@/lib/auth/api";
import { handleRouteError } from "@/lib/api";
import { runWithStorageOwner } from "@/lib/storage-context";
import { getRepository } from "@/lib/storage";
import { isSupabaseAuthConfigured } from "@/lib/supabase/env";
import {
  CARICATURE_VARIANT_FILENAMES,
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

function resolveOpenAiCaricatureError(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Erro ao gerar caricatura com a IA.";

  if (isOpenAiImageAuthorizationError(message)) {
    return NextResponse.json(
      {
        message:
          "OpenAI recusou a geracao de imagem (401). Confira OPENAI_API_KEY na Vercel, habilite GPT Image em https://platform.openai.com e, se usar projeto/organizacao, defina OPENAI_PROJECT_ID ou OPENAI_ORG_ID.",
      },
      { status: 503 },
    );
  }

  return handleRouteError(error);
}

async function runCaricatureHandler(
  repository: Awaited<ReturnType<typeof getRepository>>,
  request: Request,
) {
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
      { message: "Perfil nao encontrado. Salve o perfil e envie a foto antes de gerar." },
      { status: 400 },
    );
  }

  const assets = await repository.listTrainingAssetsForReference(referenceId);
  const sourceAssetId = String(body.sourceAssetId ?? "").trim();

  let sourceAsset =
    sourceAssetId
      ? assets.find(
          (asset) => asset.id === sourceAssetId && asset.trainingRole === "avatar_image",
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
          ? "Modelo mascote 3D gerado."
          : "Modelo editorial gerado.",
    },
    { status: 201 },
  );
}

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
    if (!isSupabaseAuthConfigured()) {
      try {
        return await runCaricatureHandler(getRepository(), request);
      } catch (error) {
        return resolveOpenAiCaricatureError(error);
      }
    }

    const auth = await requireApiUser();
    if (!isApiUser(auth)) {
      return auth;
    }

    return runWithStorageOwner(auth.id, async () => {
      try {
        return await runCaricatureHandler(getRepository(), request);
      } catch (error) {
        return resolveOpenAiCaricatureError(error);
      }
    });
  } catch (error) {
    return resolveOpenAiCaricatureError(error);
  }
}
