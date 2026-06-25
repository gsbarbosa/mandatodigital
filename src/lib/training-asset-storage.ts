import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { formatStorageUploadError } from "@/lib/training-asset-upload-client";
import type { ProfileTrainingAsset } from "@/lib/types";

const LOCAL_TRAINING_ASSET_DIR = path.join(process.cwd(), "data", "training-assets");

const UPLOAD_MAX_ATTEMPTS = 3;
const UPLOAD_RETRY_BASE_MS = 600;

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

function getSupabaseAdminClient() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !key) {
    throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorios.");
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function getTrainingAssetBucketName() {
  return process.env.SUPABASE_TRAINING_ASSETS_BUCKET?.trim() || "persona-training-videos";
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

async function uploadBufferViaSignedUrl(
  client: SupabaseClient,
  bucketName: string,
  storagePath: string,
  buffer: Buffer,
  mimeType: string,
) {
  const { data, error } = await client.storage
    .from(bucketName)
    .createSignedUploadUrl(storagePath, { upsert: false });

  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Nao foi possivel criar URL assinada de upload.");
  }

  const response = await fetch(data.signedUrl, {
    method: "PUT",
    headers: {
      "Content-Type": mimeType,
      "x-upsert": "false",
    },
    body: new Uint8Array(buffer),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      body.trim() || `Upload assinado falhou com status ${response.status}.`,
    );
  }

  return data.path?.trim() || storagePath;
}

async function uploadBufferViaSdk(
  client: SupabaseClient,
  bucketName: string,
  storagePath: string,
  buffer: Buffer,
  mimeType: string,
) {
  const { error } = await client.storage.from(bucketName).upload(storagePath, buffer, {
    contentType: mimeType,
    upsert: false,
  });

  if (error) {
    throw new Error(error.message);
  }

  return storagePath;
}

async function uploadBufferWithRetry(input: {
  bucketName: string;
  storagePath: string;
  buffer: Buffer;
  mimeType: string;
}) {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= UPLOAD_MAX_ATTEMPTS; attempt += 1) {
    const client = getSupabaseAdminClient();

    try {
      const storagePath = await uploadBufferViaSignedUrl(
        client,
        input.bucketName,
        input.storagePath,
        input.buffer,
        input.mimeType,
      );
      return storagePath;
    } catch (signedError) {
      lastError =
        signedError instanceof Error
          ? signedError
          : new Error(String(signedError));

      try {
        const storagePath = await uploadBufferViaSdk(
          client,
          input.bucketName,
          input.storagePath,
          input.buffer,
          input.mimeType,
        );
        return storagePath;
      } catch (sdkError) {
        const sdkMessage =
          sdkError instanceof Error ? sdkError.message : String(sdkError);
        lastError = new Error(sdkMessage || lastError.message);

        if (!isRetryableUploadError(lastError.message) || attempt === UPLOAD_MAX_ATTEMPTS) {
          break;
        }

        await sleep(UPLOAD_RETRY_BASE_MS * attempt);
      }
    }
  }

  throw buildStorageUploadError(lastError?.message ?? "fetch failed", input.buffer.length);
}

export async function downloadTrainingAsset(asset: ProfileTrainingAsset) {
  return readTrainingAssetBytes(asset);
}

export async function readTrainingAssetBytes(asset: ProfileTrainingAsset) {
  if (asset.storageProvider === "supabase") {
    const client = getSupabaseAdminClient();
    const bucketName = asset.storageBucket ?? getTrainingAssetBucketName();
    const { data, error } = await client.storage.from(bucketName).download(asset.storagePath);

    if (error || !data) {
      throw new Error(
        `Nao foi possivel baixar o asset ${asset.id}: ${error?.message ?? "arquivo vazio"}`,
      );
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    const mimeType = asset.mimeType?.trim() || "application/octet-stream";

    return { buffer, mimeType };
  }

  const absolutePath = path.join(LOCAL_TRAINING_ASSET_DIR, asset.storagePath);
  const buffer = await fs.readFile(absolutePath);

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
  const bucketName = getTrainingAssetBucketName();
  const safeName = sanitizeFilename(input.filename) || "arquivo.bin";
  const storagePath = `${input.referenceId}/${crypto.randomUUID()}-${safeName}`;

  const uploadedPath = await uploadBufferWithRetry({
    bucketName,
    storagePath,
    buffer: input.buffer,
    mimeType: input.mimeType,
  });

  return {
    storageProvider: "supabase" as const,
    storageBucket: bucketName,
    storagePath: uploadedPath,
    sizeBytes: input.buffer.length,
  };
}
