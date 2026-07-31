import { createHmac, timingSafeEqual } from "node:crypto";

import { createFirebaseTrainingReadUrl } from "@/lib/training-asset-storage";
import type { ProfileTrainingAsset, TrainingAssetRole } from "@/lib/types";

const TOKEN_TTL_SECONDS = 3600;

function getAccessSecret() {
  return (
    process.env.TRAINING_ASSET_ACCESS_SECRET?.trim() ||
    process.env.FIREBASE_TRAINING_ASSETS_BUCKET?.trim() ||
    "mandato-digital-dev-secret"
  );
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

  return "http://127.0.0.1:3000";
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
  _baseUrl: string,
) {
  return createFirebaseTrainingReadUrl(
    asset.storageBucket,
    asset.storagePath,
    TOKEN_TTL_SECONDS * 1000,
  );
}

function pickLatestAsset(assets: ProfileTrainingAsset[]) {
  return [...assets].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0] ?? null;
}

/** Foto (IMAGE) + audio de voz — só para listagens/UI. Geração deve usar requireOwnedTrainingAsset. */
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

/**
 * @deprecated Prefer requireOwnedTrainingAsset for generation/train.
 * When preferredAssetId is set and not found, returns null (no silent fallback).
 * When preferredAssetId is empty, returns latest caricature for list/UI helpers.
 */
export function resolveCaricatureAsset(
  assets: ProfileTrainingAsset[],
  preferredAssetId?: string | null,
) {
  const assetId = String(preferredAssetId ?? "").trim();
  if (assetId) {
    return (
      assets.find(
        (asset) => asset.id === assetId && asset.trainingRole === "avatar_caricature",
      ) ?? null
    );
  }

  return pickCaricatureAsset(assets);
}

const ROLE_LABELS: Record<TrainingAssetRole, string> = {
  avatar_image: "foto do avatar",
  avatar_caricature: "caricatura",
  voice_audio: "áudio de voz",
  consent: "termo de consentimento",
  dataset: "dataset de treino",
};

export type RequireTrainingAssetResult =
  | { ok: true; asset: ProfileTrainingAsset }
  | { ok: false; message: string; status: 400 };

/**
 * Resolve um training asset por ID explícito + role.
 * Sem fallback para “mais recente”: ID ausente/errado/role errada → falha.
 * `assets` deve ser a lista já escopada ao perfil/referência do usuário.
 */
export function requireOwnedTrainingAsset(
  assets: ProfileTrainingAsset[],
  input: {
    id?: string | null;
    role: TrainingAssetRole;
    label?: string;
  },
): RequireTrainingAssetResult {
  const assetId = String(input.id ?? "").trim();
  const label = input.label?.trim() || ROLE_LABELS[input.role];

  if (!assetId) {
    return {
      ok: false,
      status: 400,
      message: `Selecione ${label} antes de continuar.`,
    };
  }

  const match = assets.find((asset) => asset.id === assetId);
  if (!match) {
    return {
      ok: false,
      status: 400,
      message: `O asset de ${label} selecionado não pertence a este perfil ou não existe mais. Atualize a página e tente de novo.`,
    };
  }

  if (match.trainingRole !== input.role) {
    return {
      ok: false,
      status: 400,
      message: `O asset selecionado não é um(a) ${label} válido(a).`,
    };
  }

  return { ok: true, asset: match };
}
