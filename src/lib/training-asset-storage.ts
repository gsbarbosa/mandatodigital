import { getFirebaseAdminBucket } from "@/lib/firebase/admin";
import { formatStorageUploadError } from "@/lib/training-asset-upload-client";
import {
  buildTrainingAssetObjectPath,
  getFirebaseTrainingAssetsBucket,
  resolveTrainingAssetsStorageProvider,
} from "@/lib/training-assets-provider";
import type { ProfileTrainingAsset } from "@/lib/types";

const UPLOAD_MAX_ATTEMPTS = 3;
const UPLOAD_RETRY_BASE_MS = 600;
const FIREBASE_SIGNED_URL_TTL_MS = 60 * 60 * 1000;

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isRetryableUploadError(message: string) {
  const lower = message.toLowerCase();
  return (
    lower.includes("fetch failed") ||
    lower.includes("econnreset") ||
    lower.includes("socket hang up") ||
    lower.includes("network error") ||
    lower.includes("timeout") ||
    lower.includes("etimedout") ||
    lower.includes("econnrefused")
  );
}

function sanitizeFilename(filename: string) {
  return filename
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function buildStorageUploadError(raw: string, sizeBytes: number) {
  return new Error(formatStorageUploadError(raw, sizeBytes));
}

async function uploadBufferToFirebase(input: {
  bucketName: string;
  storagePath: string;
  buffer: Buffer;
  mimeType: string;
}) {
  const bucket = getFirebaseAdminBucket(input.bucketName);
  const file = bucket.file(input.storagePath);
  await file.save(input.buffer, {
    resumable: false,
    contentType: input.mimeType,
    metadata: {
      contentType: input.mimeType,
      cacheControl: "private, max-age=3600",
    },
  });
  return input.storagePath;
}

export async function createFirebaseTrainingUploadUrl(input: {
  referenceId: string;
  filename: string;
  mimeType?: string;
}) {
  resolveTrainingAssetsStorageProvider();
  const bucketName = getFirebaseTrainingAssetsBucket();
  if (!bucketName) {
    throw new Error("Bucket Firebase Storage nao configurado.");
  }

  const safeName = sanitizeFilename(input.filename) || "arquivo.bin";
  const storagePath = buildTrainingAssetObjectPath(input.referenceId, safeName);
  const contentType = input.mimeType?.trim() || "application/octet-stream";
  const bucket = getFirebaseAdminBucket(bucketName);
  const file = bucket.file(storagePath);

  const [signedUrl] = await file.getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + 15 * 60 * 1000,
    contentType,
  });

  return {
    storageProvider: "firebase" as const,
    storageBucket: bucketName,
    storagePath,
    signedUrl,
    contentType,
  };
}

export async function createFirebaseTrainingReadUrl(
  storageBucket: string | null | undefined,
  storagePath: string,
  ttlMs = FIREBASE_SIGNED_URL_TTL_MS,
) {
  const bucketName = storageBucket?.trim() || getFirebaseTrainingAssetsBucket();
  const bucket = getFirebaseAdminBucket(bucketName);
  const file = bucket.file(storagePath);
  const [signedUrl] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + ttlMs,
  });
  return signedUrl;
}

export async function downloadTrainingAsset(asset: ProfileTrainingAsset) {
  return readTrainingAssetBytes(asset);
}

export async function readTrainingAssetBytes(asset: ProfileTrainingAsset) {
  const bucket = getFirebaseAdminBucket(asset.storageBucket);
  const [buffer] = await bucket.file(asset.storagePath).download();
  return {
    buffer,
    mimeType: asset.mimeType?.trim() || "application/octet-stream",
  };
}

export async function uploadTrainingAssetBuffer(input: {
  referenceId: string;
  filename: string;
  buffer: Buffer;
  mimeType: string;
}) {
  resolveTrainingAssetsStorageProvider();
  const bucketName = getFirebaseTrainingAssetsBucket();
  if (!bucketName) {
    throw new Error("Bucket Firebase Storage nao configurado.");
  }

  const safeName = sanitizeFilename(input.filename) || "arquivo.bin";
  const storagePath = buildTrainingAssetObjectPath(input.referenceId, safeName);

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= UPLOAD_MAX_ATTEMPTS; attempt += 1) {
    try {
      await uploadBufferToFirebase({
        bucketName,
        storagePath,
        buffer: input.buffer,
        mimeType: input.mimeType,
      });
      return {
        storageProvider: "firebase" as const,
        storageBucket: bucketName,
        storagePath,
        sizeBytes: input.buffer.length,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (!isRetryableUploadError(lastError.message) || attempt === UPLOAD_MAX_ATTEMPTS) {
        break;
      }
      await sleep(UPLOAD_RETRY_BASE_MS * attempt);
    }
  }

  throw buildStorageUploadError(lastError?.message ?? "fetch failed", input.buffer.length);
}

export async function deleteTrainingAssetObject(input: {
  storageProvider: ProfileTrainingAsset["storageProvider"];
  storageBucket: string | null;
  storagePath: string;
}) {
  const bucket = getFirebaseAdminBucket(input.storageBucket);
  await bucket.file(input.storagePath).delete({ ignoreNotFound: true });
}
