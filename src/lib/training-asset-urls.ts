import { createHmac, timingSafeEqual } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

import type { ProfileTrainingAsset } from "@/lib/types";

const TOKEN_TTL_SECONDS = 3600;

function getAccessSecret() {
  return (
    process.env.TRAINING_ASSET_ACCESS_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    "mandato-digital-dev-secret"
  );
}

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorios.");
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function getTrainingAssetBucketName() {
  return process.env.SUPABASE_TRAINING_ASSETS_BUCKET || "persona-training-videos";
}

export function resolveAppBaseUrl(request?: Request) {
  const configured = process.env.APP_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  if (request) {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    const protocol = request.headers.get("x-forwarded-proto") ?? "http";
    if (host) {
      return `${protocol}://${host}`;
    }
  }

  return "http://127.0.0.1:3001";
}

export function createTrainingAssetAccessToken(assetId: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const payload = `${assetId}:${expiresAt}`;
  const signature = createHmac("sha256", getAccessSecret())
    .update(payload)
    .digest("hex");
  return Buffer.from(`${payload}:${signature}`).toString("base64url");
}

export function verifyTrainingAssetAccessToken(assetId: string, token: string) {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const [tokenAssetId, expiresAtRaw, signature] = decoded.split(":");

    if (!tokenAssetId || !expiresAtRaw || !signature || tokenAssetId !== assetId) {
      return false;
    }

    const expiresAt = Number(expiresAtRaw);
    if (!Number.isFinite(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) {
      return false;
    }

    const payload = `${tokenAssetId}:${expiresAtRaw}`;
    const expected = createHmac("sha256", getAccessSecret())
      .update(payload)
      .digest("hex");

    const actualBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expected, "hex");

    if (actualBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(actualBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

export async function getTrainingAssetPublicUrl(
  asset: ProfileTrainingAsset,
  baseUrl: string,
) {
  if (asset.storageProvider === "supabase") {
    const client = getSupabaseClient();
    const bucketName = asset.storageBucket ?? getTrainingAssetBucketName();
    const { data, error } = await client.storage
      .from(bucketName)
      .createSignedUrl(asset.storagePath, TOKEN_TTL_SECONDS);

    if (error || !data?.signedUrl) {
      throw new Error(
        `Nao foi possivel gerar URL assinada para o asset ${asset.id}: ${error?.message ?? "URL vazia"}`,
      );
    }

    return data.signedUrl;
  }

  const token = createTrainingAssetAccessToken(asset.id);
  return `${baseUrl}/api/profile/training-assets/${asset.id}/stream?token=${encodeURIComponent(token)}`;
}

function pickLatestAsset(assets: ProfileTrainingAsset[]) {
  return [...assets].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0] ?? null;
}

/** Foto (IMAGE) + audio de voz (clone via POST /voices) para treino na Argil. */
export function pickAvatarImageAndVoiceAudioAssets(assets: ProfileTrainingAsset[]) {
  const avatarImageAssets = assets.filter(
    (asset) => asset.trainingRole === "avatar_image",
  );
  const voiceAudioAssets = assets.filter(
    (asset) => asset.trainingRole === "voice_audio",
  );

  return {
    avatarImageAsset: pickLatestAsset(avatarImageAssets),
    voiceAudioAsset: pickLatestAsset(voiceAudioAssets),
  };
}

export function pickCaricatureAsset(assets: ProfileTrainingAsset[]) {
  return pickLatestAsset(
    assets.filter((asset) => asset.trainingRole === "avatar_caricature"),
  );
}

export function resolveCaricatureAsset(
  assets: ProfileTrainingAsset[],
  preferredAssetId?: string | null,
) {
  const assetId = String(preferredAssetId ?? "").trim();
  if (assetId) {
    const match = assets.find(
      (asset) => asset.id === assetId && asset.trainingRole === "avatar_caricature",
    );
    if (match) {
      return match;
    }
  }

  return pickCaricatureAsset(assets);
}

/** @deprecated Use pickAvatarImageAndVoiceAudioAssets */
export function pickAvatarImageAndConsentAssets(assets: ProfileTrainingAsset[]) {
  return pickAvatarImageAndVoiceAudioAssets(assets);
}

/** @deprecated Use pickAvatarImageAndVoiceAudioAssets */
export function pickDatasetAndConsentAssets(assets: ProfileTrainingAsset[]) {
  const { avatarImageAsset, voiceAudioAsset } = pickAvatarImageAndVoiceAudioAssets(assets);
  const datasetAssets = assets.filter((asset) => asset.trainingRole === "dataset");
  const datasetAsset =
    avatarImageAsset ?? pickLatestAsset(datasetAssets);

  return { datasetAsset, consentAsset: voiceAudioAsset };
}
