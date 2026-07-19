import {
  deleteTrainingAssetObject,
  readTrainingAssetBytes,
  uploadTrainingAssetBuffer,
} from "@/lib/training-asset-storage";
import { normalizeTrainingVideoBuffer } from "@/lib/training-video-transcode";

export async function normalizeDatasetVideoInStorage(input: {
  referenceId: string;
  storageProvider: "firebase";
  storageBucket: string | null;
  storagePath: string;
  originalFilename: string;
  mimeType: string;
}) {
  const { buffer } = await readTrainingAssetBytes({
    id: "normalize-temp",
    profileId: null,
    draftProfileId: null,
    sourceType: "upload",
    trainingRole: "dataset",
    storageProvider: "firebase",
    storageBucket: input.storageBucket,
    storagePath: input.storagePath,
    originalFilename: input.originalFilename,
    mimeType: input.mimeType,
    sizeBytes: 0,
    status: "uploaded",
    errorMessage: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const normalized = await normalizeTrainingVideoBuffer({
    buffer,
    mimeType: input.mimeType,
    filename: input.originalFilename,
  });

  if (!normalized.wasTranscoded) {
    return {
      storageProvider: "firebase" as const,
      storageBucket: input.storageBucket,
      storagePath: input.storagePath,
      originalFilename: normalized.filename,
      mimeType: normalized.mimeType,
      sizeBytes: normalized.sizeBytes,
      wasNormalized: false,
    };
  }

  const uploaded = await uploadTrainingAssetBuffer({
    referenceId: input.referenceId,
    filename: normalized.filename,
    buffer: normalized.buffer,
    mimeType: normalized.mimeType,
  });

  if (uploaded.storagePath !== input.storagePath) {
    await deleteTrainingAssetObject({
      storageProvider: "firebase",
      storageBucket: input.storageBucket,
      storagePath: input.storagePath,
    });
  }

  return {
    storageProvider: uploaded.storageProvider,
    storageBucket: uploaded.storageBucket,
    storagePath: uploaded.storagePath,
    originalFilename: normalized.filename,
    mimeType: normalized.mimeType,
    sizeBytes: normalized.sizeBytes,
    wasNormalized: true,
  };
}
