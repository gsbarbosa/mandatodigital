export const ASYNC_JOB_TYPES = ["seal_video", "voice_tts"] as const;
export type AsyncJobType = (typeof ASYNC_JOB_TYPES)[number];

export const ASYNC_JOB_STATUSES = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "dead",
] as const;
export type AsyncJobStatus = (typeof ASYNC_JOB_STATUSES)[number];

export type AsyncJobRow = {
  id: string;
  ownerUserId: string;
  type: AsyncJobType;
  status: AsyncJobStatus;
  payload: Record<string, unknown>;
  result: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
  lastError: string;
  idempotencyKey: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

export type SealVideoPayload = {
  mediaId: string;
  videoUrl: string;
  guestTestWatermark?: boolean;
};

export type VoiceTtsPayload = {
  transcript: string;
  avatarName: string;
  voiceAudioAssetId: string;
  voiceAudioUrl: string;
  requestedElevenLabsVoiceId?: string;
  requestedHeygenVoiceId?: string;
  /** Quando true, após TTS cria vídeo HeyGen (image path). */
  createVideo?: {
    generateMode: "caricature" | "photo_real";
    imageUrl: string;
    title?: string;
    caricatureAssetId?: string;
  };
};
