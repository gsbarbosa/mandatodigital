import { storeComplianceBuffer } from "@/lib/legal/contract-storage";

/** Persiste MP3 do TTS com URL que a HeyGen consegue baixar (signed longa ou pública). */
export async function storeElevenLabsTtsAudio(input: {
  mediaId: string;
  buffer: Buffer;
}) {
  const safeId = input.mediaId.trim().replace(/[^a-zA-Z0-9_-]/g, "") || "tts";
  const stored = await storeComplianceBuffer({
    relativePath: `tts/${safeId}-${Date.now()}.mp3`,
    buffer: input.buffer,
    mimeType: "audio/mpeg",
  });
  return {
    audioUrl: stored.publicUrl,
    storagePath: stored.storagePath,
  };
}
