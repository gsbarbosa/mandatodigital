import type { HeyGenAssetInput } from "@/lib/heygen";
import { heygenUploadAsset } from "@/lib/heygen";
import { downloadTrainingAsset } from "@/lib/training-asset-storage";
import { normalizeTrainingVideoBuffer } from "@/lib/training-video-transcode";
import type { ProfileTrainingAsset } from "@/lib/types";

export async function resolveHeyGenDigitalTwinVideoInput(
  asset: ProfileTrainingAsset,
): Promise<HeyGenAssetInput> {
  const { buffer, mimeType } = await downloadTrainingAsset(asset);
  const normalized = await normalizeTrainingVideoBuffer({
    buffer,
    mimeType,
    filename: asset.originalFilename,
  });

  const uploaded = await heygenUploadAsset({
    buffer: normalized.buffer,
    filename: normalized.filename,
    mimeType: normalized.mimeType,
  });

  return {
    type: "asset_id",
    asset_id: uploaded.assetId,
  };
}
