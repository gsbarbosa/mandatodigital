export type ArgilAspectRatio = "16:9" | "9:16";

export type ArgilAvatar = {
  id: string;
  name: string;
  status: string;
  voiceId?: string;
};

export type ArgilVoice = {
  id: string;
  name: string;
  status: string;
};

export type ArgilVideo = {
  id: string;
  name: string;
  status: string;
  previewUrl?: string;
  videoUrl?: string;
  videoUrlSubtitled?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ArgilWebhookEvent =
  | "VIDEO_GENERATION_SUCCESS"
  | "VIDEO_GENERATION_FAILED"
  | "AVATAR_TRAINING_SUCCESS"
  | "AVATAR_TRAINING_FAILED";

export type ArgilVideoWebhookPayload = {
  event: ArgilWebhookEvent;
  data: {
    videoId?: string;
    videoName?: string;
    videoUrl?: string;
    avatarId?: string;
    avatarName?: string;
    voiceId?: string;
    extras?: Record<string, string>;
  };
};
