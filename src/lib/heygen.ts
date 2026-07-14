import { AsyncLocalStorage } from "node:async_hooks";

export type HeyGenAssetInput =
  | { type: "url"; url: string }
  | { type: "asset_id"; asset_id: string };

const heygenApiKeyOverrideStore = new AsyncLocalStorage<string | undefined>();

/** Usa API key de teste (header do Distribuidor) nas chamadas HeyGen deste handler. */
export function runWithHeyGenApiKey<T>(apiKey: string, fn: () => T): T {
  return heygenApiKeyOverrideStore.run(apiKey.trim(), fn);
}

function resolveHeyGenApiKeyForFetch() {
  const override = heygenApiKeyOverrideStore.getStore()?.trim();
  if (override) {
    return override;
  }
  return getHeyGenConfig().apiKey;
}

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
  const apiKey = resolveHeyGenApiKeyForFetch();
  if (!apiKey) {
    throw new Error(
      "Serviço de geração de vídeo indisponível. Tente novamente mais tarde.",
    );
  }

  const response = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
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
      `A plataforma retornou um erro (${response.status}).`;
    throw new Error(message);
  }

  return (json ?? {}) as T;
}

export type HeyGenUserMeResponse = {
  code?: number;
  message?: string | null;
  data?: {
    username?: string;
    email?: string;
    billing_type?: string;
    wallet?: {
      currency?: string;
      remaining_balance?: number;
      auto_reload?: { enabled?: boolean };
    };
  };
};

export async function heygenGetUserMe() {
  // Docs: GET /v3/users/me (API Key guide)
  return heygenFetch<HeyGenUserMeResponse>("/v3/users/me", { method: "GET" });
}

export type HeyGenUploadAssetResponse = {
  data?: {
    asset_id?: string;
    id?: string;
    url?: string;
    mime_type?: string;
    size_bytes?: number;
  };
};

export async function heygenUploadAsset(input: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}) {
  const config = getHeyGenConfig();
  const apiKey = resolveHeyGenApiKeyForFetch();
  if (!apiKey) {
    throw new Error(
      "Servico de geracao de video indisponivel. Tente novamente mais tarde.",
    );
  }

  const form = new FormData();
  const blob = new Blob([new Uint8Array(input.buffer)], { type: input.mimeType });
  form.append("file", blob, input.filename);

  const response = await fetch(`${config.baseUrl}/v3/assets`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
    },
    body: form,
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
      `A plataforma retornou um erro (${response.status}).`;
    throw new Error(message);
  }

  const payload = (json ?? {}) as HeyGenUploadAssetResponse;
  const assetId =
    payload.data?.asset_id?.trim() || payload.data?.id?.trim() || "";

  if (!assetId) {
    throw new Error("Resposta invalida da HeyGen: asset_id ausente.");
  }

  return {
    assetId,
    url: payload.data?.url?.trim() || null,
    mimeType: payload.data?.mime_type?.trim() || input.mimeType,
    sizeBytes: Number(payload.data?.size_bytes ?? input.buffer.length),
    raw: payload,
  };
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

export type HeyGenAvatarGroupListItem = {
  id: string;
  name?: string | null;
  status?: string | null;
  consent_status?: string | null;
  looks_count?: number;
  preview_image_url?: string | null;
  created_at?: number;
};

export type HeyGenListAvatarGroupsResponse = {
  data?: HeyGenAvatarGroupListItem[];
  has_more?: boolean;
  next_token?: string | null;
};

export async function heygenListAvatarGroups(input?: {
  ownership?: "public" | "private";
  limit?: number;
  token?: string;
}) {
  const query = new URLSearchParams();
  if (input?.ownership) query.set("ownership", input.ownership);
  if (input?.limit) query.set("limit", String(input.limit));
  if (input?.token) query.set("token", input.token);

  const suffix = query.toString() ? `?${query.toString()}` : "";
  return heygenFetch<HeyGenListAvatarGroupsResponse>(`/v3/avatars${suffix}`, {
    method: "GET",
  });
}

export type HeyGenDeleteAvatarGroupResponse = {
  data?: { id?: string };
};

export async function heygenDeleteAvatarGroup(groupId: string) {
  return heygenFetch<HeyGenDeleteAvatarGroupResponse>(
    `/v3/avatars/${encodeURIComponent(groupId)}`,
    { method: "DELETE" },
  );
}

export type HeyGenAvatarLookDetailsResponse = {
  data?: {
    avatar_look?: {
      id?: string;
      avatar_type?: string | null;
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

export type HeyGenAvatarLookListItem = {
  id: string;
  name?: string | null;
  avatar_type?: string | null;
  preview_image_url?: string | null;
  preview_video_url?: string | null;
  supported_api_engines?: string[];
  group_id?: string | null;
};

export type HeyGenListAvatarLooksResponse = {
  data?: HeyGenAvatarLookListItem[];
  has_more?: boolean;
  next_token?: string | null;
};

export async function heygenListAvatarLooks(input?: {
  ownership?: "public" | "private";
  avatarType?: "studio_avatar" | "digital_twin" | "photo_avatar";
  groupId?: string;
  limit?: number;
  token?: string;
}) {
  const query = new URLSearchParams();
  if (input?.ownership) query.set("ownership", input.ownership);
  if (input?.avatarType) query.set("avatar_type", input.avatarType);
  if (input?.groupId) query.set("group_id", input.groupId);
  if (input?.limit) query.set("limit", String(input.limit));
  if (input?.token) query.set("token", input.token);

  const suffix = query.toString() ? `?${query.toString()}` : "";
  return heygenFetch<HeyGenListAvatarLooksResponse>(`/v3/avatars/looks${suffix}`, {
    method: "GET",
  });
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
  return heygenFetch<HeyGenVoiceDetailsResponse>(
    `/v3/voices/${encodeURIComponent(voiceId)}`,
    {
      method: "GET",
    },
  );
}

/**
 * Remove um clone privado. 404 voice_not_found conta como sucesso
 * (docs HeyGen: delete-then-list deve tratar 404 como já removido).
 */
export async function heygenDeleteVoice(voiceId: string) {
  const id = voiceId.trim();
  if (!id) {
    throw new Error("voice_id ausente para exclusao.");
  }

  try {
    await heygenFetch<{ data?: { voice_id?: string } }>(
      `/v3/voices/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    return { voiceId: id, alreadyGone: false as const };
  } catch (error) {
    const message = formatHeyGenError(error).toLowerCase();
    if (message.includes("voice_not_found") || message.includes("not found")) {
      return { voiceId: id, alreadyGone: true as const };
    }
    throw error;
  }
}

export type HeyGenVoiceListItem = {
  voice_id?: string;
  name?: string;
  language?: string;
  gender?: string;
  type?: string;
};

export type HeyGenListVoicesResponse = {
  data?: HeyGenVoiceListItem[];
  has_more?: boolean;
  next_token?: string | null;
};

export async function heygenListVoices(input?: {
  type?: "public" | "private";
  limit?: number;
  token?: string;
}) {
  const query = new URLSearchParams();
  if (input?.type) query.set("type", input.type);
  if (input?.limit) query.set("limit", String(input.limit));
  if (input?.token) query.set("token", input.token);

  const suffix = query.toString() ? `?${query.toString()}` : "";
  return heygenFetch<HeyGenListVoicesResponse>(`/v3/voices${suffix}`, {
    method: "GET",
  });
}

/** Lista todos os clones privados (paginado). */
export async function heygenListAllPrivateVoices() {
  const voices: HeyGenVoiceListItem[] = [];
  let token: string | undefined;

  for (let page = 0; page < 20; page += 1) {
    const response = await heygenListVoices({
      type: "private",
      limit: 100,
      token,
    });
    voices.push(...(response.data ?? []));
    if (!response.has_more || !response.next_token) {
      break;
    }
    token = String(response.next_token);
  }

  return voices;
}

function isHeyGenVoiceLookupFailure(message: string) {
  const lower = message.toLowerCase();
  return (
    lower.includes("not found") ||
    lower.includes("voice_not_found") ||
    lower.includes("invalid voice_id")
  );
}

export type HeyGenVoiceReadiness = "ready" | "processing" | "missing" | "failed";

function mapHeyGenVoiceStatus(status: string): HeyGenVoiceReadiness {
  const normalized = status.trim().toLowerCase();
  if (!normalized || normalized === "complete" || normalized === "ready") {
    return "ready";
  }
  if (normalized === "processing" || normalized === "pending") {
    return "processing";
  }
  if (normalized === "failed" || normalized === "error") {
    return "failed";
  }
  return "ready";
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function heygenGetVoiceReadiness(voiceId: string): Promise<HeyGenVoiceReadiness> {
  const id = voiceId.trim();
  if (!id) {
    return "missing";
  }

  try {
    const detail = await heygenGetVoice(id);
    const resolvedId = String(detail.data?.voice_id ?? detail.data?.id ?? "").trim();
    if (!resolvedId) {
      return "missing";
    }

    return mapHeyGenVoiceStatus(String(detail.data?.status ?? ""));
  } catch (error) {
    const message = formatHeyGenError(error);
    if (isHeyGenVoiceLookupFailure(message)) {
      return "missing";
    }
    if (message.toLowerCase().includes("unauthorized")) {
      throw new Error(
        "Chave da API invalida para esta conta. Remova a chave de teste no painel ou atualize-a.",
      );
    }
    throw error;
  }
}

export async function heygenWaitForVoiceReady(
  voiceId: string,
  options?: { timeoutMs?: number; intervalMs?: number },
) {
  const id = voiceId.trim();
  if (!id) {
    throw new Error("Voz clonada ausente.");
  }

  const timeoutMs = options?.timeoutMs ?? 120_000;
  const intervalMs = options?.intervalMs ?? 2_000;
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const readiness = await heygenGetVoiceReadiness(id);
    if (readiness === "ready") {
      return id;
    }
    if (readiness === "failed") {
      throw new Error(
        "O clone de voz falhou na plataforma. Envie outro audio e tente novamente.",
      );
    }
    if (readiness === "missing") {
      throw new Error("A voz clonada nao foi encontrada na plataforma.");
    }

    await sleep(intervalMs);
  }

  throw new Error(
    "A voz clonada ainda esta sendo processada. Aguarde alguns segundos e tente gerar o video novamente.",
  );
}

export async function heygenVoiceExists(voiceId: string) {
  const readiness = await heygenGetVoiceReadiness(voiceId);
  return readiness === "ready";
}

export function isHeyGenVoiceGenerationError(error: unknown) {
  const message = formatHeyGenError(error).toLowerCase();
  return isHeyGenVoiceLookupFailure(message);
}

export type HeyGenCreateVideoResponse = {
  data?: { video_id?: string };
};

export async function heygenCreateVideo(input: {
  avatarId: string;
  voiceId?: string;
  script?: string;
  title?: string;
  aspectRatio?: "9:16" | "16:9";
  resolution?: "720p" | "1080p" | "4k";
  callbackUrl?: string;
  motionPrompt?: string;
  expressiveness?: "low" | "medium" | "high";
  engine?: "avatar_iv" | "avatar_v";
}) {
  const hasMotionControls =
    Boolean(input.motionPrompt?.trim()) || Boolean(input.expressiveness);
  const payload: Record<string, unknown> = {
    type: "avatar",
    avatar_id: input.avatarId,
    ...(input.voiceId ? { voice_id: input.voiceId } : null),
    script: input.script ?? "",
    title: input.title ?? undefined,
    aspect_ratio: input.aspectRatio ?? "9:16",
    resolution: input.resolution ?? "1080p",
    callback_url: input.callbackUrl ?? undefined,
    ...(input.engine ? { engine: { type: input.engine } } : null),
    ...(input.engine === "avatar_iv" && hasMotionControls
      ? {
          motion_prompt: input.motionPrompt ?? undefined,
          expressiveness: input.expressiveness ?? undefined,
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

export async function heygenCreateVideoFromImage(input: {
  image: HeyGenAssetInput;
  voiceId: string;
  script: string;
  title?: string;
  aspectRatio?: "9:16" | "16:9" | "auto";
  resolution?: "720p" | "1080p" | "4k";
  callbackUrl?: string;
}) {
  const payload: Record<string, unknown> = {
    type: "image",
    image: input.image,
    voice_id: input.voiceId,
    script: input.script,
    title: input.title ?? undefined,
    aspect_ratio: input.aspectRatio ?? "9:16",
    resolution: input.resolution ?? "1080p",
    callback_url: input.callbackUrl ?? undefined,
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

