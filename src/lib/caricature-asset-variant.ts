import {
  caricatureVariantFromFilename,
  caricatureVariantGeneratingLabel,
  caricatureVariantLabel,
  type CaricatureVariant,
} from "@/lib/openai-caricature-prompts";
import type { ProfileTrainingAsset } from "@/lib/types";

export { caricatureVariantGeneratingLabel, caricatureVariantLabel };

/** Limite da versão para convidados: gerações por estilo (Caricato / Mascote 3D). */
export const MAX_GUEST_CARICATURES_PER_VARIANT = 3;

export function caricatureAssetMatchesVariant(
  asset: ProfileTrainingAsset,
  variant: CaricatureVariant,
) {
  const detected = caricatureVariantFromFilename(asset.originalFilename);
  if (detected) {
    return detected === variant;
  }
  return variant === "editorial";
}

export function listCaricaturesForVariant(
  assets: readonly ProfileTrainingAsset[],
  variant: CaricatureVariant,
) {
  return assets.filter(
    (asset) =>
      asset.trainingRole === "avatar_caricature" &&
      caricatureAssetMatchesVariant(asset, variant),
  );
}

export function countCaricaturesForVariant(
  assets: readonly ProfileTrainingAsset[],
  variant: CaricatureVariant,
) {
  return listCaricaturesForVariant(assets, variant).length;
}

export function guestCaricatureQuota(input: {
  assets: readonly ProfileTrainingAsset[];
  variant: CaricatureVariant;
  limit?: number;
}) {
  const limit = input.limit ?? MAX_GUEST_CARICATURES_PER_VARIANT;
  const used = countCaricaturesForVariant(input.assets, input.variant);
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    reached: used >= limit,
  };
}

export function pickLatestCaricatureForVariant(
  assets: ProfileTrainingAsset[],
  variant: CaricatureVariant,
) {
  return (
    [...listCaricaturesForVariant(assets, variant)].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0] ?? null
  );
}
