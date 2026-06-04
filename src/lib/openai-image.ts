import {
  resolveCaricaturePrompt,
  type CaricatureVariant,
} from "@/lib/openai-caricature-prompts";

const DEFAULT_CARICATURE_MODEL = "gpt-image-1.5";
const CARICATURE_MODEL_FALLBACKS = ["gpt-image-1.5", "gpt-image-1", "gpt-image-1-mini"] as const;
const VISION_MODEL = process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";

function getOpenAiApiKey() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY nao configurada.");
  }
  return apiKey;
}

function getCaricatureModel() {
  return process.env.OPENAI_IMAGE_MODEL?.trim() || DEFAULT_CARICATURE_MODEL;
}

function buildOpenAiHeaders(apiKey: string, json = false): HeadersInit {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
  };

  if (json) {
    headers["Content-Type"] = "application/json";
  }

  const organization =
    process.env.OPENAI_ORG_ID?.trim() || process.env.OPENAI_ORGANIZATION?.trim();
  const project = process.env.OPENAI_PROJECT_ID?.trim();

  if (organization) {
    headers["OpenAI-Organization"] = organization;
  }
  if (project) {
    headers["OpenAI-Project"] = project;
  }

  return headers;
}

function extensionForMime(mimeType: string) {
  const mime = mimeType.toLowerCase();
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  return "jpg";
}

function parseOpenAiImageError(status: number, body: string) {
  try {
    const json = JSON.parse(body) as {
      error?: { message?: string; code?: string };
    };
    const message = json.error?.message?.trim();
    if (message) {
      return message;
    }
  } catch {
    // ignore
  }

  const trimmed = body.trim();
  if (trimmed && trimmed.length < 280) {
    return trimmed;
  }

  return `OpenAI falhou ao gerar caricatura (${status}).`;
}

function shouldFallbackFromImageEditError(message: string, status: number) {
  const normalized = message.toLowerCase();
  return (
    status === 401 ||
    status === 403 ||
    normalized.includes("not authorized") ||
    normalized.includes("unauthorized") ||
    normalized.includes("invalid value") ||
    normalized.includes("must be 'dall-e-2'") ||
    normalized.includes("does not exist") ||
    normalized.includes("response_format")
  );
}

function extractImageBuffer(json: {
  data?: Array<{ b64_json?: string; url?: string }>;
}) {
  const b64 = json.data?.[0]?.b64_json?.trim();
  if (b64) {
    return {
      buffer: Buffer.from(b64, "base64"),
      mimeType: "image/png",
    };
  }

  return null;
}

async function downloadImageFromUrl(imageUrl: string) {
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error("OpenAI retornou URL de caricatura, mas o download falhou.");
  }
  const buffer = Buffer.from(await imageResponse.arrayBuffer());
  const mimeType = imageResponse.headers.get("content-type")?.trim() || "image/png";
  return { buffer, mimeType };
}

async function requestImageEdit(input: {
  apiKey: string;
  model: string;
  imageBuffer: Buffer;
  mimeType: string;
  prompt: string;
}) {
  const extension = extensionForMime(input.mimeType);
  const formData = new FormData();
  formData.append("model", input.model);
  formData.append(
    "image",
    new Blob([new Uint8Array(input.imageBuffer)], {
      type: input.mimeType || "image/jpeg",
    }),
    `source.${extension}`,
  );
  formData.append("prompt", input.prompt);
  formData.append("size", "1024x1024");

  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: buildOpenAiHeaders(input.apiKey),
    body: formData,
  });

  const rawBody = await response.text();
  if (!response.ok) {
    const message = parseOpenAiImageError(response.status, rawBody);
    const error = new Error(message);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }

  const json = JSON.parse(rawBody) as {
    data?: Array<{ b64_json?: string; url?: string }>;
  };
  const extracted = extractImageBuffer(json);
  if (extracted) {
    return extracted;
  }

  const imageUrl = json.data?.[0]?.url?.trim();
  if (imageUrl) {
    return downloadImageFromUrl(imageUrl);
  }

  throw new Error("OpenAI nao retornou imagem de caricatura.");
}

async function describePortraitForCaricature(input: {
  apiKey: string;
  imageBuffer: Buffer;
  mimeType: string;
}) {
  const dataUrl = `data:${input.mimeType || "image/jpeg"};base64,${input.imageBuffer.toString("base64")}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: buildOpenAiHeaders(input.apiKey, true),
    body: JSON.stringify({
      model: VISION_MODEL,
      temperature: 0.2,
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Descreva em portugues os tracos faciais desta pessoa para gerar uma caricatura " +
                "reconhecivel: formato do rosto, cabelo, barba, oculos, tom de pele, idade aparente " +
                "e detalhes marcantes. Seja objetivo em 3-5 frases.",
            },
            {
              type: "image_url",
              image_url: { url: dataUrl },
            },
          ],
        },
      ],
    }),
  });

  const rawBody = await response.text();
  if (!response.ok) {
    throw new Error(parseOpenAiImageError(response.status, rawBody));
  }

  const json = JSON.parse(rawBody) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const description = json.choices?.[0]?.message?.content?.trim();
  if (!description) {
    throw new Error("Nao foi possivel analisar a foto para gerar a caricatura.");
  }

  return description;
}

async function requestImageGeneration(input: {
  apiKey: string;
  model: string;
  prompt: string;
}) {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: buildOpenAiHeaders(input.apiKey, true),
    body: JSON.stringify({
      model: input.model,
      prompt: input.prompt,
      size: "1024x1024",
      quality: "high",
      output_format: "png",
    }),
  });

  const rawBody = await response.text();
  if (!response.ok) {
    throw new Error(parseOpenAiImageError(response.status, rawBody));
  }

  const json = JSON.parse(rawBody) as {
    data?: Array<{ b64_json?: string; url?: string }>;
  };
  const extracted = extractImageBuffer(json);
  if (extracted) {
    return extracted;
  }

  const imageUrl = json.data?.[0]?.url?.trim();
  if (imageUrl) {
    return downloadImageFromUrl(imageUrl);
  }

  throw new Error("OpenAI nao retornou imagem de caricatura.");
}

async function generateCaricatureViaGenerationFallback(input: {
  apiKey: string;
  imageBuffer: Buffer;
  mimeType: string;
  prompt: string;
}) {
  const portraitDescription = await describePortraitForCaricature({
    apiKey: input.apiKey,
    imageBuffer: input.imageBuffer,
    mimeType: input.mimeType,
  });

  const generationPrompt =
    `${input.prompt} Retrato baseado nesta pessoa: ${portraitDescription}`;

  const preferred = getCaricatureModel();
  const models = [
    preferred,
    ...CARICATURE_MODEL_FALLBACKS.filter((model) => model !== preferred),
  ];

  let lastError: Error | null = null;

  for (const model of models) {
    try {
      const result = await requestImageGeneration({
        apiKey: input.apiKey,
        model,
        prompt: generationPrompt,
      });
      return { ...result, model };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw (
    lastError ??
    new Error(
      "Nao foi possivel gerar caricatura. Verifique OPENAI_API_KEY e o acesso aos modelos GPT Image no painel OpenAI.",
    )
  );
}

export async function generateCaricatureFromPhoto(input: {
  imageBuffer: Buffer;
  mimeType: string;
  variant?: CaricatureVariant;
  styleHint?: string;
}) {
  const apiKey = getOpenAiApiKey();
  const prompt = resolveCaricaturePrompt({
    variant: input.variant,
    styleHint: input.styleHint,
  });

  const preferred = getCaricatureModel();
  const editModels = [
    preferred,
    ...CARICATURE_MODEL_FALLBACKS.filter((model) => model !== preferred),
  ];

  let lastEditError: (Error & { status?: number }) | null = null;

  for (const model of editModels) {
    try {
      const result = await requestImageEdit({
        apiKey,
        model,
        imageBuffer: input.imageBuffer,
        mimeType: input.mimeType,
        prompt,
      });
      return { ...result, model };
    } catch (error) {
      const normalized =
        error instanceof Error
          ? (error as Error & { status?: number })
          : new Error(String(error));
      lastEditError = normalized;
      const status = normalized.status ?? 400;
      if (!shouldFallbackFromImageEditError(normalized.message, status)) {
        throw normalized;
      }
    }
  }

  if (lastEditError) {
    try {
      return await generateCaricatureViaGenerationFallback({
        apiKey,
        imageBuffer: input.imageBuffer,
        mimeType: input.mimeType,
        prompt,
      });
    } catch (fallbackError) {
      const fallbackMessage =
        fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      throw new Error(
        `Edicao de imagem indisponivel (${lastEditError.message}). Fallback tambem falhou: ${fallbackMessage}`,
      );
    }
  }

  throw new Error("Nao foi possivel gerar caricatura.");
}

export function isOpenAiImageAuthorizationError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("401: not authorized") ||
    normalized.includes("not authorized") ||
    normalized.includes("incorrect api key") ||
    normalized.includes("invalid_api_key") ||
    normalized.includes("openai_api_key")
  );
}
