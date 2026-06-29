import { createClient } from "@supabase/supabase-js";

import { uploadTrainingAssetBuffer } from "@/lib/training-asset-storage";
import { normalizeTrainingVideoBuffer } from "@/lib/training-video-transcode";

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

export async function normalizeDatasetVideoInStorage(input: {
  referenceId: string;
  storageBucket: string;
  storagePath: string;
  originalFilename: string;
  mimeType: string;
}) {
  const client = getSupabaseAdminClient();
  const { data, error } = await client.storage
    .from(input.storageBucket)
    .download(input.storagePath);

  if (error || !data) {
    throw new Error(
      `Não foi possível baixar o video de treino: ${error?.message ?? "arquivo vazio"}`,
    );
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  const normalized = await normalizeTrainingVideoBuffer({
    buffer,
    mimeType: input.mimeType,
    filename: input.originalFilename,
  });

  if (!normalized.wasTranscoded) {
    return {
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
    await client.storage.from(input.storageBucket).remove([input.storagePath]);
  }

  return {
    storageBucket: uploaded.storageBucket,
    storagePath: uploaded.storagePath,
    originalFilename: normalized.filename,
    mimeType: normalized.mimeType,
    sizeBytes: normalized.sizeBytes,
    wasNormalized: true,
  };
}
