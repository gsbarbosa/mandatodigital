import {
  caricatureVariantFromFilename,
  caricatureVariantGeneratingLabel,
  caricatureVariantLabel,
  type CaricatureVariant,
} from "@/lib/openai-caricature-prompts";
import type { ProfileTrainingAsset } from "@/lib/types";

export { caricatureVariantGeneratingLabel, caricatureVariantLabel };

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

export function pickLatestCaricatureForVariant(
  assets: ProfileTrainingAsset[],
  variant: CaricatureVariant,
) {
  return (
    [...assets]
      .filter(
        (asset) =>
          asset.trainingRole === "avatar_caricature" &&
          caricatureAssetMatchesVariant(asset, variant),
      )
      .sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )[0] ?? null
  );
}
