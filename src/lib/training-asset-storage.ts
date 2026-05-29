import crypto from "node:crypto";

import { createClient } from "@supabase/supabase-js";

import type { ProfileTrainingAsset } from "@/lib/types";

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

export async function downloadTrainingAsset(asset: ProfileTrainingAsset) {
  if (asset.storageProvider !== "supabase") {
    throw new Error("Download de asset local nao suportado neste fluxo.");
  }

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

export async function uploadTrainingAssetBuffer(input: {
  referenceId: string;
  filename: string;
  buffer: Buffer;
  mimeType: string;
}) {
  const client = getSupabaseAdminClient();
  const bucketName = getTrainingAssetBucketName();
  const safeName = sanitizeFilename(input.filename) || "arquivo.bin";
  const storagePath = `${input.referenceId}/${crypto.randomUUID()}-${safeName}`;

  const { error } = await client.storage.from(bucketName).upload(storagePath, input.buffer, {
    contentType: input.mimeType,
    upsert: false,
  });

  if (error) {
    throw new Error(`Nao foi possivel enviar o asset gerado: ${error.message}`);
  }

  return {
    storageProvider: "supabase" as const,
    storageBucket: bucketName,
    storagePath,
    sizeBytes: input.buffer.length,
  };
}
