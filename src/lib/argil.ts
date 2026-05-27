import type {
  ArgilAspectRatio,
  ArgilAvatar,
  ArgilVideo,
  ArgilVoice,
} from "@/lib/argil-types";

export type { ArgilAspectRatio, ArgilAvatar, ArgilVideo, ArgilVoice };

function getEnv(name: string) {
  return (process.env[name] ?? "").trim();
}

function isDryRunEnabled() {
  const value = getEnv("ARGIL_DRY_RUN");
  return value === "" || value.toLowerCase() === "true" || value === "1";
}

export function getArgilConfig(overrides?: {
  avatarId?: string;
  voiceId?: string;
}) {
  const apiKey = getEnv("ARGIL_API_KEY");
  const avatarId =
    overrides?.avatarId?.trim() ||
    getEnv("ARGIL_AVATAR_ID") ||
    "dry-run-avatar-id";
  const voiceId = overrides?.voiceId?.trim() || getEnv("ARGIL_VOICE_ID");
  const aspectRatio = (getEnv("ARGIL_ASPECT_RATIO") || "9:16") as ArgilAspectRatio;
  const subtitlesEnabled = (getEnv("ARGIL_SUBTITLES_ENABLED") || "true")
    .toLowerCase()
    .trim();
  const baseUrl = getEnv("ARGIL_BASE_URL") || "https://api.argil.ai/v1";

  return {
    apiKey,
    avatarId,
    voiceId,
    aspectRatio,
    subtitlesEnabled: subtitlesEnabled === "true" || subtitlesEnabled === "1",
    baseUrl,
    dryRun: isDryRunEnabled(),
  };
}

export type ArgilCreateAndRenderInput = {
  topic: string;
  transcript: string;
  name?: string;
  callbackUrl?: string;
  avatarId?: string;
  voiceId?: string;
};

export type ArgilCreateAndRenderResult = {
  dryRun: boolean;
  request: {
    createUrl: string;
    createBody: unknown;
    renderUrl: string;
    renderBody: unknown;
    headers: Record<string, string>;
  };
  video: ArgilVideo;
};

export type ArgilCreateVoiceFromAudioInput = {
  name: string;
  audioUrl: string;
};

export type ArgilCreateVoiceFromAudioResult = {
  dryRun: boolean;
  request: {
    createUrl: string;
    createBody: unknown;
    headers: Record<string, string>;
  };
  voice: ArgilVoice;
};

export type ArgilCreateAvatarFromImageInput = {
  name: string;
  datasetImageUrl: string;
  voiceId?: string;
  extras?: Record<string, string>;
};

export type ArgilCreateAvatarFromImageResult = {
  dryRun: boolean;
  request: {
    createUrl: string;
    createBody: unknown;
    headers: Record<string, string>;
  };
  avatar: ArgilAvatar;
};

function buildHeaders(apiKey: string) {
  return {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
  };
}

function buildCreatePayload(
  input: ArgilCreateAndRenderInput,
  config: ReturnType<typeof getArgilConfig>,
) {
  const transcript = input.transcript.trim();
  const name =
    input.name?.trim() ||
    `Mandato Digital - ${input.topic.trim() || "video"} - ${new Date().toISOString()}`;

  return {
    name,
    moments: [
      {
        avatarId: config.avatarId,
        ...(config.voiceId ? { voiceId: config.voiceId } : {}),
        transcript,
      },
    ],
    aspectRatio: config.aspectRatio,
    subtitles: {
      enable: config.subtitlesEnabled,
    },
    extras: {
      source: "mandato-digital",
      topic: input.topic,
    },
  };
}

async function argilFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const config = getArgilConfig();

  if (!config.apiKey) {
    throw new Error("ARGIL_API_KEY nao configurado.");
  }

  const response = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers: {
      ...buildHeaders(config.apiKey),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Argil ${path} falhou (${response.status}): ${text}`);
  }

  return (await response.json()) as T;
}

export async function argilGetAvatar(avatarId: string) {
  const config = getArgilConfig();

  if (config.dryRun) {
    return {
      id: avatarId,
      name: "Dry-run avatar",
      status: "IDLE",
      voiceId: "dry-run-voice-id",
    } satisfies ArgilAvatar;
  }

  return argilFetch<ArgilAvatar>(`/avatars/${avatarId}`);
}

export async function argilGetVideo(videoId: string) {
  const config = getArgilConfig();

  if (config.dryRun) {
    return {
      id: videoId,
      name: "Dry-run video",
      status: "DONE",
      previewUrl: "https://example.com/argil-preview-dry-run",
      videoUrl: "https://example.com/argil-video-dry-run.mp4",
    } satisfies ArgilVideo;
  }

  return argilFetch<ArgilVideo>(`/videos/${videoId}`);
}

export async function argilCreateVoiceFromAudio(
  input: ArgilCreateVoiceFromAudioInput,
): Promise<ArgilCreateVoiceFromAudioResult> {
  const config = getArgilConfig();
  const name = input.name.trim();

  if (!name) {
    throw new Error("Informe um nome para a voz.");
  }

  if (!config.dryRun && !config.apiKey) {
    throw new Error("ARGIL_API_KEY nao configurado.");
  }

  const headers = config.apiKey
    ? buildHeaders(config.apiKey)
    : { "Content-Type": "application/json" };
  const createUrl = `${config.baseUrl}/voices`;
  const createBody = {
    name,
    audioUrl: input.audioUrl,
  };

  if (config.dryRun) {
    const fakeVoice: ArgilVoice = {
      id: crypto.randomUUID(),
      name,
      status: "IDLE",
    };

    return {
      dryRun: true,
      request: {
        createUrl,
        createBody,
        headers,
      },
      voice: fakeVoice,
    };
  }

  const voice = await argilFetch<ArgilVoice>("/voices", {
    method: "POST",
    body: JSON.stringify(createBody),
  });

  return {
    dryRun: false,
    request: {
      createUrl,
      createBody,
      headers,
    },
    voice,
  };
}

export async function argilCreateAvatarFromImage(
  input: ArgilCreateAvatarFromImageInput,
): Promise<ArgilCreateAvatarFromImageResult> {
  const config = getArgilConfig();
  const name = input.name.trim();

  if (!name) {
    throw new Error("Informe um nome para o avatar.");
  }

  if (!config.dryRun && !config.apiKey) {
    throw new Error("ARGIL_API_KEY nao configurado.");
  }

  const headers = config.apiKey
    ? buildHeaders(config.apiKey)
    : { "Content-Type": "application/json" };
  const createUrl = `${config.baseUrl}/avatars`;
  const createBody = {
    type: "IMAGE",
    name,
    datasetImage: {
      url: input.datasetImageUrl,
    },
    ...(input.voiceId ? { voiceId: input.voiceId } : {}),
    ...(input.extras ? { extras: input.extras } : {}),
  };

  if (config.dryRun) {
    const fakeAvatar: ArgilAvatar = {
      id: crypto.randomUUID(),
      name,
      status: "TRAINING",
    };

    return {
      dryRun: true,
      request: {
        createUrl,
        createBody,
        headers,
      },
      avatar: fakeAvatar,
    };
  }

  const avatar = await argilFetch<ArgilAvatar>("/avatars", {
    method: "POST",
    body: JSON.stringify(createBody),
  });

  return {
    dryRun: false,
    request: {
      createUrl,
      createBody,
      headers,
    },
    avatar,
  };
}

export async function argilCreateAndRenderVideo(
  input: ArgilCreateAndRenderInput,
): Promise<ArgilCreateAndRenderResult> {
  const config = getArgilConfig({
    avatarId: input.avatarId,
    voiceId: input.voiceId,
  });
  const transcript = input.transcript.trim();

  if (!transcript) {
    throw new Error("Transcricao (script) vazia.");
  }

  if (!config.dryRun && !config.apiKey) {
    throw new Error("ARGIL_API_KEY nao configurado.");
  }

  const avatar = await argilGetAvatar(config.avatarId);
  if (avatar.status !== "IDLE" && !config.dryRun) {
    throw new Error(
      `Avatar Argil indisponivel (status ${avatar.status}). Treine o avatar antes de gerar videos.`,
    );
  }

  const headers = config.apiKey
    ? buildHeaders(config.apiKey)
    : { "Content-Type": "application/json" };
  const createUrl = `${config.baseUrl}/videos`;
  const createBody = buildCreatePayload(input, config);

  if (config.dryRun) {
    const fakeVideo: ArgilVideo = {
      id: crypto.randomUUID(),
      name: createBody.name,
      status: "GENERATING_VIDEO",
      previewUrl: "https://example.com/argil-preview-dry-run",
    };

    return {
      dryRun: true,
      request: {
        createUrl,
        createBody,
        renderUrl: `${config.baseUrl}/videos/${fakeVideo.id}/render`,
        renderBody: input.callbackUrl ? { callbackUrl: input.callbackUrl } : {},
        headers,
      },
      video: fakeVideo,
    };
  }

  const created = await argilFetch<ArgilVideo>("/videos", {
    method: "POST",
    body: JSON.stringify(createBody),
  });

  const renderUrl = `/videos/${created.id}/render`;
  const renderBody = input.callbackUrl ? { callbackUrl: input.callbackUrl } : {};

  const rendered = await argilFetch<ArgilVideo>(renderUrl, {
    method: "POST",
    body: JSON.stringify(renderBody),
  });

  return {
    dryRun: false,
    request: {
      createUrl,
      createBody,
      renderUrl: `${config.baseUrl}${renderUrl}`,
      renderBody,
      headers,
    },
    video: rendered,
  };
}

export function mapArgilVideoToGenerationUpdate(video: ArgilVideo) {
  return {
    argilVideoId: video.id,
    status: video.status,
    previewUrl: video.previewUrl ?? "",
    videoUrl: video.videoUrl ?? "",
    videoUrlSubtitled: video.videoUrlSubtitled ?? "",
    errorMessage: video.status === "FAILED" ? "Geracao falhou na Argil." : "",
  };
}

export function isArgilVideoTerminal(status: string) {
  return status === "DONE" || status === "FAILED";
}

/** Lip-sync so fica pronto com status DONE e videoUrl preenchido (preview e so imagem parada). */
export function isArgilVideoReady(video: {
  status?: string;
  videoUrl?: string | null;
}) {
  return (
    video.status === "DONE" &&
    Boolean(String(video.videoUrl ?? "").trim())
  );
}

export function isArgilVideoProcessing(status: string) {
  return (
    status === "IDLE" ||
    status === "GENERATING_AUDIO" ||
    status === "GENERATING_VIDEO"
  );
}

export function isArgilAvatarTerminal(status: string) {
  return status === "IDLE" || status === "TRAINING_FAILED" || status === "REFUSED";
}
