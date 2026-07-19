/**
 * Cliente ElevenLabs (conta única da plataforma).
 * IVC + TTS → áudio que a HeyGen consome via audio_url (sem clone HeyGen).
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
  const ttsModelId =
    getEnv("ELEVENLABS_TTS_MODEL_ID") || "eleven_multilingual_v2";
  return { apiKey, baseUrl, ttsModelId };
}

export function formatElevenLabsError(error: unknown) {
  if (!error) return "Erro desconhecido na ElevenLabs.";
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Erro desconhecido na ElevenLabs.";
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
  if (!config.apiKey) {
    throw new Error(
      "Servico de voz (ElevenLabs) indisponivel. Configure ELEVENLABS_API_KEY.",
    );
  }

  const response = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers: {
      "xi-api-key": config.apiKey,
      ...(init?.headers ?? {}),
    },
  });

  return response;
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

export type ElevenLabsTtsInput = {
  voiceId: string;
  text: string;
  modelId?: string;
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

  const response = await elevenLabsFetch(
    `/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: input.modelId?.trim() || config.ttsModelId,
      }),
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
