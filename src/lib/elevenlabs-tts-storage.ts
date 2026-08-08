import { COLLECTIONS, col } from "@/lib/firebase/collections";
import { getFirebaseAdminBucket } from "@/lib/firebase/admin";

/** TTL de leitura do MP3 — HeyGen precisa baixar após o create; 48h cobre retries. */
const TTS_SIGNED_URL_TTL_MS = 60 * 60 * 48 * 1000;

export type StoredTtsAudio = {
  audioUrl: string;
  storagePath: string;
};

/** Persiste MP3 do TTS com URL que a HeyGen consegue baixar (signed). */
export async function storeElevenLabsTtsAudio(input: {
  mediaId: string;
  buffer: Buffer;
}): Promise<StoredTtsAudio> {
  const safeId = input.mediaId.trim().replace(/[^a-zA-Z0-9_-]/g, "") || "tts";
  const storagePath = `compliance/tts/temp/${safeId}-${Date.now()}.mp3`;
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
    expires: Date.now() + TTS_SIGNED_URL_TTL_MS,
  });

  return {
    audioUrl: signedUrl,
    storagePath,
  };
}

/** Remove MP3 temporário do bucket (best-effort). */
export async function deleteElevenLabsTtsAudio(storagePath: string) {
  const path = storagePath.trim();
  if (!path) {
    return;
  }
  const bucket = getFirebaseAdminBucket();
  await bucket.file(path).delete({ ignoreNotFound: true });
}

export type TtsAudioPendingRow = {
  videoId: string;
  storagePath: string;
  audioUrl: string;
  createdAt: string;
  cleanedAt?: string | null;
};

/** Associa MP3 ao videoId HeyGen para limpar quando o render terminar. */
export async function registerTtsAudioPendingCleanup(input: {
  videoId: string;
  storagePath: string;
  audioUrl: string;
}) {
  const videoId = input.videoId.trim();
  const storagePath = input.storagePath.trim();
  if (!videoId || !storagePath) {
    return;
  }

  const row: TtsAudioPendingRow = {
    videoId,
    storagePath,
    audioUrl: input.audioUrl,
    createdAt: new Date().toISOString(),
    cleanedAt: null,
  };
  await col(COLLECTIONS.ttsAudioPending).doc(videoId).set(row);
}

/**
 * Apaga MP3 do bucket quando o vídeo HeyGen completed/failed.
 * Idempotente se já limpou ou não houver registro.
 */
export async function cleanupTtsAudioForVideo(videoId: string) {
  const id = videoId.trim();
  if (!id) {
    return { deleted: false as const };
  }

  const ref = col(COLLECTIONS.ttsAudioPending).doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    return { deleted: false as const };
  }

  const row = snap.data() as TtsAudioPendingRow;
  if (row.cleanedAt) {
    return { deleted: false as const };
  }

  const storagePath = String(row.storagePath ?? "").trim();
  if (storagePath) {
    await deleteElevenLabsTtsAudio(storagePath);
  }

  await ref.set(
    {
      cleanedAt: new Date().toISOString(),
    },
    { merge: true },
  );

  return { deleted: true as const, storagePath };
}
