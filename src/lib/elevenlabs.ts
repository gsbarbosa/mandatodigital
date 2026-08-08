/**
 * Cliente ElevenLabs (conta única da plataforma).
 * IVC + TTS (eleven_v3) → áudio que a HeyGen consome via audio_url (sem clone HeyGen).
 */

function getEnv(name: string) {
  return (process.env[name] ?? "").trim();
}

export function getElevenLabsConfig() {
  const apiKey = getEnv("ELEVENLABS_API_KEY");
  const baseUrl = (getEnv("ELEVENLABS_BASE_URL") || "https://api.elevenlabs.io").replace(
    /\/$/,
    "",
  );
  const ttsModelId = getEnv("ELEVENLABS_TTS_MODEL_ID") || "eleven_v3";
  /** ISO 639-1 — força PT no v3 (ignorado em multilingual_v2). */
  const ttsLanguageCode = getEnv("ELEVENLABS_TTS_LANGUAGE_CODE") || "pt";
  /** mp3_44100_192 exige Creator+; default 128 cobre Starter. */
  const ttsOutputFormat =
    getEnv("ELEVENLABS_TTS_OUTPUT_FORMAT") || "mp3_44100_128";
  return { apiKey, baseUrl, ttsModelId, ttsLanguageCode, ttsOutputFormat };
}

async function resolveElevenLabsApiKey() {
  try {
    const { resolveProviderApiKey } = await import("@/lib/admin/provider-secrets");
    const resolved = await resolveProviderApiKey("elevenlabs");
    if (resolved.token) {
      return resolved.token;
    }
  } catch {
    // Firestore/admin indisponível em testes — cai no env.
  }
  return getElevenLabsConfig().apiKey;
}

export function formatElevenLabsError(error: unknown) {
  if (!error) return "Erro desconhecido na ElevenLabs.";
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Erro desconhecido na ElevenLabs.";
}

/** Plano da conta sem Instant Voice Cloning (IVC) — comum em freemium/starter. */
export function isElevenLabsIvcSubscriptionError(error: unknown) {
  const message = formatElevenLabsError(error).toLowerCase();
  return (
    message.includes("instant voice cloning") ||
    message.includes("does not include instant voice") ||
    (message.includes("upgrade your plan") && message.includes("voice"))
  );
}

/** Teto de custom voices (ex.: 10/10 no Starter) — típico com clones órfãos. */
export function isElevenLabsCustomVoiceLimitError(error: unknown) {
  const message = formatElevenLabsError(error).toLowerCase();
  return (
    message.includes("maximum amount of custom voices") ||
    message.includes("custom voice limit") ||
    (message.includes("custom voices") && message.includes("upgrade your subscription"))
  );
}

type ElevenLabsErrorBody = {
  detail?:
    | { status?: string; message?: string }
    | Array<{ msg?: string }>
    | string;
  message?: string;
};

function messageFromElevenLabsBody(json: unknown, status: number) {
  const payload = (json ?? {}) as ElevenLabsErrorBody;
  if (typeof payload.detail === "string" && payload.detail.trim()) {
    return payload.detail.trim();
  }
  if (payload.detail && typeof payload.detail === "object" && !Array.isArray(payload.detail)) {
    const detail = payload.detail as { message?: string; status?: string };
    if (detail.message?.trim()) {
      return detail.message.trim();
    }
  }
  if (Array.isArray(payload.detail) && payload.detail[0]?.msg) {
    return String(payload.detail[0].msg);
  }
  if (payload.message?.trim()) {
    return payload.message.trim();
  }
  return `ElevenLabs retornou erro HTTP ${status}.`;
}

async function elevenLabsFetch(path: string, init?: RequestInit) {
  const config = getElevenLabsConfig();
  const { appLog, appLogError, safeApiPath, startTimer } = await import(
    "@/lib/observability/log"
  );
  const elapsed = startTimer();
  const method = String(init?.method ?? "GET").toUpperCase();
  const apiPath = safeApiPath(path).replace(
    /\/text-to-speech\/[^/?]+/,
    "/text-to-speech/{voiceId}",
  );

  const execute = async (apiKey: string) => {
    if (!apiKey) {
      throw new Error(
        "Servico de voz (ElevenLabs) indisponivel. Configure ELEVENLABS_API_KEY.",
      );
    }

    const response = await fetch(`${config.baseUrl}${path}`, {
      ...init,
      headers: {
        "xi-api-key": apiKey,
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      const message = messageFromElevenLabsBody(
        (() => {
          try {
            return body ? JSON.parse(body) : null;
          } catch {
            return null;
          }
        })(),
        response.status,
      );
      appLogError("elevenlabs", "api_request_failed", message, {
        method,
        path: apiPath,
        httpStatus: response.status,
        durationMs: elapsed(),
      });
      const { ProviderHttpError } = await import("@/lib/admin/provider-key-pool");
      throw new ProviderHttpError({
        providerId: "elevenlabs",
        status: response.status,
        message,
        body: body.slice(0, 400),
      });
    }

    if (method !== "GET") {
      appLog("elevenlabs", "api_request_ok", {
        method,
        path: apiPath,
        httpStatus: response.status,
        durationMs: elapsed(),
      });
    }

    return response;
  };

  try {
    const { runWithProviderKeyPool } = await import("@/lib/admin/provider-key-pool");
    return await runWithProviderKeyPool("elevenlabs", async (token) => execute(token));
  } catch (error) {
    if (error instanceof Error && error.message.includes("Nenhuma API key")) {
      return execute(await resolveElevenLabsApiKey());
    }
    throw error;
  }
}

async function downloadAudioFromUrl(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Falha ao baixar amostra de voz (HTTP ${response.status}).`);
  }
  const contentType = response.headers.get("content-type") ?? "audio/mpeg";
  const buffer = Buffer.from(await response.arrayBuffer());
  const ext = contentType.includes("wav")
    ? "wav"
    : contentType.includes("ogg")
      ? "ogg"
      : "mp3";
  return { buffer, contentType, filename: `sample.${ext}` };
}

export type ElevenLabsCloneVoiceInput = {
  voiceName: string;
  /** URL publica da amostra (ex.: training asset). */
  audioUrl: string;
  removeBackgroundNoise?: boolean;
};

/** Instant Voice Clone — POST /v1/voices/add (multipart). */
export async function elevenLabsCloneVoice(input: ElevenLabsCloneVoiceInput) {
  const { buffer, contentType, filename } = await downloadAudioFromUrl(input.audioUrl);
  const form = new FormData();
  form.append("name", input.voiceName.trim() || "Mandato Voice");
  form.append(
    "files",
    new Blob([new Uint8Array(buffer)], { type: contentType }),
    filename,
  );
  if (input.removeBackgroundNoise !== false) {
    form.append("remove_background_noise", "true");
  }

  const response = await elevenLabsFetch("/v1/voices/add", {
    method: "POST",
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
    throw new Error(messageFromElevenLabsBody(json, response.status));
  }

  const voiceId = String(
    (json as { voice_id?: string } | null)?.voice_id ?? "",
  ).trim();
  if (!voiceId) {
    throw new Error("Resposta invalida da ElevenLabs: voice_id ausente.");
  }

  return {
    voiceId,
    requiresVerification: Boolean(
      (json as { requires_verification?: boolean } | null)?.requires_verification,
    ),
    raw: json,
  };
}

/** Remove custom voice — libera slot da cota (IVC efêmero). */
export async function elevenLabsDeleteVoice(voiceId: string) {
  const id = voiceId.trim();
  if (!id) {
    return { alreadyGone: true as const };
  }

  try {
    await elevenLabsFetch(`/v1/voices/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Accept: "application/json" },
    });
    return { alreadyGone: false as const };
  } catch (error) {
    const message = formatElevenLabsError(error).toLowerCase();
    const status =
      error && typeof error === "object" && "status" in error
        ? Number((error as { status?: number }).status)
        : 0;
    if (
      status === 404 ||
      message.includes("not found") ||
      message.includes("does not exist") ||
      message.includes("voice_does_not_exist")
    ) {
      return { alreadyGone: true as const };
    }
    throw error;
  }
}

export async function elevenLabsGetVoice(voiceId: string) {
  const id = voiceId.trim();
  const response = await elevenLabsFetch(`/v1/voices/${encodeURIComponent(id)}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!response.ok) {
    throw new Error(messageFromElevenLabsBody(json, response.status));
  }
  return json as { voice_id?: string; name?: string };
}

export type ElevenLabsVoiceListItem = {
  voice_id?: string;
  name?: string;
  category?: string;
};

/** Lista as vozes da conta (inclui clones IVC). */
export async function elevenLabsListVoices() {
  const response = await elevenLabsFetch("/v1/voices", {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!response.ok) {
    throw new Error(messageFromElevenLabsBody(json, response.status));
  }
  return (json as { voices?: ElevenLabsVoiceListItem[] } | null)?.voices ?? [];
}

export async function elevenLabsVoiceExists(voiceId: string) {
  const id = voiceId.trim();
  if (!id) return false;
  try {
    await elevenLabsGetVoice(id);
    return true;
  } catch (error) {
    const message = formatElevenLabsError(error).toLowerCase();
    if (
      message.includes("not found") ||
      message.includes("does not exist") ||
      message.includes("voice_does_not_exist")
    ) {
      return false;
    }
    throw error;
  }
}

/** Nomes gerados por buildElevenLabsCloneVoiceName: "Avatar (deadbeef)". */
export function isEphemeralElevenLabsVoiceName(name: string) {
  return /\([0-9a-f]{8}\)\s*$/i.test(name.trim());
}

/**
 * Apaga clones IVC efêmeros órfãos (padrão de nome do Mandato).
 * Usado como recuperação quando a cota 10/10 ainda tem restos.
 */
export async function elevenLabsPurgeEphemeralVoices(options?: { limit?: number }) {
  const limit = Math.max(1, Math.min(options?.limit ?? 10, 30));
  const voices = await elevenLabsListVoices();
  const targets = voices.filter((voice) => {
    const id = voice.voice_id?.trim();
    const name = String(voice.name ?? "");
    return Boolean(id) && isEphemeralElevenLabsVoiceName(name);
  });

  let deleted = 0;
  for (const voice of targets.slice(0, limit)) {
    const id = voice.voice_id!.trim();
    try {
      await elevenLabsDeleteVoice(id);
      deleted += 1;
    } catch {
      // segue tentando os demais
    }
  }
  return { scanned: targets.length, deleted };
}

export type ElevenLabsTtsInput = {
  voiceId: string;
  text: string;
  modelId?: string;
  languageCode?: string;
};

/** Defaults afinados para clone IVC + discurso político (PT). */
const DEFAULT_VOICE_SETTINGS = {
  stability: 0.45,
  similarity_boost: 0.8,
  style: 0.15,
  use_speaker_boost: true,
};

/** TTS — POST /v1/text-to-speech/{voice_id} → buffer MP3. */
export async function elevenLabsTextToSpeech(input: ElevenLabsTtsInput) {
  const config = getElevenLabsConfig();
  const voiceId = input.voiceId.trim();
  const text = input.text.trim();
  if (!voiceId) {
    throw new Error("voice_id ElevenLabs ausente para TTS.");
  }
  if (!text) {
    throw new Error("Texto vazio para TTS ElevenLabs.");
  }

  const modelId = input.modelId?.trim() || config.ttsModelId;
  const languageCode =
    input.languageCode?.trim() || config.ttsLanguageCode || undefined;
  const outputFormat = encodeURIComponent(config.ttsOutputFormat);

  const body: Record<string, unknown> = {
    text,
    model_id: modelId,
    voice_settings: DEFAULT_VOICE_SETTINGS,
    apply_text_normalization: "auto",
  };
  // language_code é suportado no v3; multilingual_v2 ignora.
  if (languageCode && modelId !== "eleven_multilingual_v2") {
    body.language_code = languageCode;
  }

  const response = await elevenLabsFetch(
    `/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${outputFormat}`,
    {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const textBody = await response.text();
    let json: unknown = null;
    try {
      json = textBody ? JSON.parse(textBody) : null;
    } catch {
      json = null;
    }
    throw new Error(messageFromElevenLabsBody(json, response.status));
  }

  return Buffer.from(await response.arrayBuffer());
}
