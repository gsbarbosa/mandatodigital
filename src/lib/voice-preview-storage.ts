import { getFirebaseAdminBucket } from "@/lib/firebase/admin";

/** Prévia de voz — URL assinada (GCS v4: máx. 7 dias). */
const PREVIEW_SIGNED_URL_TTL_MS = 60 * 60 * 24 * 7 * 1000; // 7 dias

export type StoredVoicePreviewAudio = {
  audioUrl: string;
  storagePath: string;
};

export async function storeVoicePreviewAudio(input: {
  profileId: string;
  voiceAudioAssetId: string;
  previewId: string;
  buffer: Buffer;
}): Promise<StoredVoicePreviewAudio> {
  const profileId =
    input.profileId.trim().replace(/[^a-zA-Z0-9_-]/g, "") || "profile";
  const assetId =
    input.voiceAudioAssetId.trim().replace(/[^a-zA-Z0-9_-]/g, "") || "asset";
  const previewId =
    input.previewId.trim().replace(/[^a-zA-Z0-9_-]/g, "") || "preview";
  const storagePath = `compliance/tts/previews/${profileId}/${assetId}/${previewId}.mp3`;
  const bucket = getFirebaseAdminBucket();
  const file = bucket.file(storagePath);

  await file.save(input.buffer, {
    resumable: false,
    contentType: "audio/mpeg",
    metadata: {
      contentType: "audio/mpeg",
      cacheControl: "private, max-age=3600",
    },
  });

  const [signedUrl] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + PREVIEW_SIGNED_URL_TTL_MS,
  });

  return {
    audioUrl: signedUrl,
    storagePath,
  };
}

export async function refreshVoicePreviewSignedUrl(storagePath: string) {
  const path = storagePath.trim();
  if (!path) {
    return null;
  }
  const bucket = getFirebaseAdminBucket();
  const file = bucket.file(path);
  const [exists] = await file.exists();
  if (!exists) {
    return null;
  }
  const [signedUrl] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + PREVIEW_SIGNED_URL_TTL_MS,
  });
  return signedUrl;
}

export async function deleteVoicePreviewAudio(storagePath: string) {
  const path = storagePath.trim();
  if (!path) {
    return;
  }
  const bucket = getFirebaseAdminBucket();
  await bucket.file(path).delete({ ignoreNotFound: true });
}
