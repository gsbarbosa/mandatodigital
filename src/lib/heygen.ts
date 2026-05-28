export type HeyGenAssetInput =
  | { type: "url"; url: string }
  | { type: "asset_id"; asset_id: string };

type HeyGenStandardError = {
  error?: {
    code?: string;
    message?: string;
    param?: string | null;
    doc_url?: string | null;
  };
  code?: number;
  message?: string;
};

function getEnv(name: string) {
  return (process.env[name] ?? "").trim();
}

export function getHeyGenConfig() {
  const apiKey = getEnv("HEYGEN_API_KEY");
  const baseUrl = (getEnv("HEYGEN_BASE_URL") || "https://api.heygen.com").replace(
    /\/$/,
    "",
  );

  return { apiKey, baseUrl };
}

export function formatHeyGenError(error: unknown) {
  if (!error) return "Erro desconhecido.";
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Erro desconhecido.";
}

async function heygenFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const config = getHeyGenConfig();
  if (!config.apiKey) {
    throw new Error(
      "HEYGEN_API_KEY nao configurada no servidor. Configure na Vercel e/ou .env.local.",
    );
  }

  const response = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      ...(init?.headers ?? {}),
    },
  });

  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!response.ok) {
    const payload = (json ?? {}) as HeyGenStandardError;
    const message =
      payload.error?.message ||
      payload.message ||
      `HeyGen falhou (${response.status}).`;
    throw new Error(message);
  }

  return (json ?? {}) as T;
}

export type HeyGenCreatePhotoAvatarResponse = {
  data?: {
    avatar_item?: { id?: string };
    avatar_group?: { id?: string };
  };
};

export async function heygenCreatePhotoAvatar(input: {
  name: string;
  file: HeyGenAssetInput;
}) {
  const payload = { type: "photo", name: input.name, file: input.file };
  const response = await heygenFetch<HeyGenCreatePhotoAvatarResponse>("/v3/avatars", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const avatarId = response.data?.avatar_item?.id?.trim();
  if (!avatarId) {
    throw new Error("Resposta invalida da HeyGen: avatar_id ausente.");
  }

  return { avatarId, raw: response };
}

export type HeyGenCreateDigitalTwinResponse = {
  data?: {
    avatar_item?: { id?: string };
    avatar_group?: { id?: string };
  };
};

export async function heygenCreateDigitalTwin(input: {
  name: string;
  file: HeyGenAssetInput;
}) {
  const payload = { type: "digital_twin", name: input.name, file: input.file };
  const response = await heygenFetch<HeyGenCreateDigitalTwinResponse>("/v3/avatars", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const avatarId = response.data?.avatar_item?.id?.trim();
  const groupId = response.data?.avatar_group?.id?.trim();

  if (!avatarId || !groupId) {
    throw new Error("Resposta invalida da HeyGen: avatar_id/group_id ausente.");
  }

  return { avatarId, groupId, raw: response };
}

export type HeyGenCreateConsentResponse = {
  data?: {
    url?: string;
    avatar_group?: { id?: string; consent_status?: string; status?: string };
  };
};

export async function heygenCreateAvatarConsent(input: {
  groupId: string;
  rerouteUrl?: string;
}) {
  const payload = input.rerouteUrl ? { reroute_url: input.rerouteUrl } : {};
  const response = await heygenFetch<HeyGenCreateConsentResponse>(
    `/v3/avatars/${encodeURIComponent(input.groupId)}/consent`,
    { method: "POST", body: JSON.stringify(payload) },
  );

  const url = response.data?.url?.trim();
  if (!url) {
    throw new Error("Resposta invalida da HeyGen: URL de consentimento ausente.");
  }

  return { consentUrl: url, raw: response };
}

export type HeyGenAvatarGroupDetailsResponse = {
  data?: {
    avatar_group?: {
      id?: string;
      name?: string;
      status?: string | null;
      consent_status?: string | null;
    };
  };
};

export async function heygenGetAvatarGroup(groupId: string) {
  return heygenFetch<HeyGenAvatarGroupDetailsResponse>(
    `/v3/avatars/${encodeURIComponent(groupId)}`,
    { method: "GET" },
  );
}

export type HeyGenAvatarLookDetailsResponse = {
  data?: {
    avatar_look?: {
      id?: string;
      supported_api_engines?: string[];
    };
  };
};

export async function heygenGetAvatarLook(lookId: string) {
  return heygenFetch<HeyGenAvatarLookDetailsResponse>(
    `/v3/avatars/looks/${encodeURIComponent(lookId)}`,
    { method: "GET" },
  );
}

export type HeyGenVoiceDetailsResponse = {
  data?: {
    voice_id?: string;
    id?: string;
    status?: string;
  };
};

export type HeyGenCloneVoiceResponse = {
  data?: {
    voice_id?: string;
    voice_clone_id?: string;
    id?: string;
    status?: string;
  };
};

export async function heygenCloneVoice(input: { voiceName: string; audio: HeyGenAssetInput }) {
  const response = await heygenFetch<HeyGenCloneVoiceResponse>("/v3/voices/clone", {
    method: "POST",
    body: JSON.stringify({
      voice_name: input.voiceName,
      audio: input.audio,
    }),
  });

  const voiceId =
    response.data?.voice_id?.trim() ||
    response.data?.voice_clone_id?.trim() ||
    response.data?.id?.trim() ||
    "";

  if (!voiceId) {
    throw new Error("Resposta invalida da HeyGen: voice_id ausente.");
  }

  return { voiceId, raw: response };
}

export async function heygenGetVoice(voiceId: string) {
  return heygenFetch<HeyGenVoiceDetailsResponse>(`/v3/voices/${voiceId}`, {
    method: "GET",
  });
}

export type HeyGenCreateVideoResponse = {
  data?: { video_id?: string };
};

export async function heygenCreateVideo(input: {
  avatarId: string;
  voiceId: string;
  script?: string;
  title?: string;
  aspectRatio?: "9:16" | "16:9";
  resolution?: "720p" | "1080p" | "4k";
  callbackUrl?: string;
  motionPrompt?: string;
  expressiveness?: "low" | "medium" | "high";
  engine?: "avatar_iv" | "avatar_v";
}) {
  const payload: Record<string, unknown> = {
    type: "avatar",
    avatar_id: input.avatarId,
    voice_id: input.voiceId,
    script: input.script ?? "",
    title: input.title ?? undefined,
    aspect_ratio: input.aspectRatio ?? "9:16",
    resolution: input.resolution ?? "1080p",
    callback_url: input.callbackUrl ?? undefined,
    ...(input.engine ? { engine: { type: input.engine } } : null),
    ...(input.engine === "avatar_iv"
      ? {
          motion_prompt: input.motionPrompt ?? undefined,
          expressiveness: input.expressiveness ?? "low",
        }
      : null),
  };

  const response = await heygenFetch<HeyGenCreateVideoResponse>("/v3/videos", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const videoId = response.data?.video_id?.trim();
  if (!videoId) {
    throw new Error("Resposta invalida da HeyGen: video_id ausente.");
  }

  return { videoId, raw: response };
}

export type HeyGenVideoDetailsResponse = {
  data?: {
    status?: "pending" | "processing" | "completed" | "failed" | string;
    video_url?: string | null;
    failure_message?: string | null;
    caption_url?: string | null;
    id?: string;
  };
};

export async function heygenGetVideo(videoId: string) {
  return heygenFetch<HeyGenVideoDetailsResponse>(`/v3/videos/${videoId}`, {
    method: "GET",
  });
}

