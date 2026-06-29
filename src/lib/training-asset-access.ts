import type { ProfileTrainingAsset } from "@/lib/types";
import type { Repository } from "@/lib/storage";

export async function resolveAccessibleTrainingAsset(
  repository: Repository,
  assetId: string,
  profileId: string | null,
): Promise<
  | { ok: true; asset: ProfileTrainingAsset }
  | { ok: false; status: number; message: string }
> {
  const normalizedId = assetId.trim();
  if (!normalizedId) {
    return { ok: false, status: 400, message: "Asset id ausente." };
  }

  const asset = await repository.getTrainingAssetById(normalizedId);
  if (!asset) {
    return { ok: false, status: 404, message: "Asset não encontrado." };
  }

  const referenceIds = new Set(
    [profileId, asset.profileId, asset.draftProfileId].filter(Boolean) as string[],
  );

  for (const referenceId of referenceIds) {
    const assets = await repository.listTrainingAssetsForReference(referenceId);
    if (assets.some((item) => item.id === normalizedId)) {
      return { ok: true, asset };
    }
  }

  return {
    ok: false,
    status: 403,
    message: "Asset não pertence ao perfil atual.",
  };
}
