import FormData from "form-data";

import {
  resolveCaricaturePrompt,
  type CaricatureVariant,
} from "@/lib/openai-caricature-prompts";

const DEFAULT_CARICATURE_MODEL = "gpt-image-1.5";

function sanitizeOpenAiApiKey(raw: string) {
  return raw.trim().replace(/^Bearer\s+/i, "").replace(/^["']|["']$/g, "");
}

function getOpenAiApiKey() {
  const apiKey = sanitizeOpenAiApiKey(process.env.OPENAI_API_KEY ?? "");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY não configurada.");
  }
  return apiKey;
}

function getCaricatureModel() {
  return process.env.OPENAI_IMAGE_MODEL?.trim() || DEFAULT_CARICATURE_MODEL;
}

function buildOpenAiHeaders(apiKey: string, extra?: Record<string, string>) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    ...extra,
  };

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

function formDataToBuffer(form: FormData) {
  return form.getBuffer();
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

async function postOpenAiForm(
  path: string,
  apiKey: string,
  form: FormData,
) {
  const body = formDataToBuffer(form);
  const response = await fetch(`https://api.openai.com${path}`, {
    method: "POST",
    headers: buildOpenAiHeaders(apiKey, form.getHeaders() as Record<string, string>),
    body: new Uint8Array(body),
  });

  const rawBody = await response.text();
  if (!response.ok) {
    throw new Error(parseOpenAiImageError(response.status, rawBody));
  }

  return rawBody;
}

async function requestImageEdit(input: {
  apiKey: string;
  model: string;
  imageBuffer: Buffer;
  mimeType: string;
  prompt: string;
}) {
  if (input.imageBuffer.length < 512) {
    throw new Error("A foto enviada esta vazia ou corrompida. Envie a imagem novamente.");
  }

  const extension = extensionForMime(input.mimeType);
  const form = new FormData();
  form.append("model", input.model);
  form.append("prompt", input.prompt);
  form.append("size", "1024x1024");
  form.append("quality", "high");
  form.append("output_format", "png");
  form.append("image", input.imageBuffer, {
    filename: `source.${extension}`,
    contentType: input.mimeType || "image/jpeg",
  });

  const rawBody = await postOpenAiForm("/v1/images/edits", input.apiKey, form);
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

  throw new Error("OpenAI não retornou imagem de caricatura.");
}

async function describePortraitForCaricature(input: {
  apiKey: string;
  imageBuffer: Buffer;
  mimeType: string;
}) {
  const visionModel = process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";
  const dataUrl = `data:${input.mimeType || "image/jpeg"};base64,${input.imageBuffer.toString("base64")}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: buildOpenAiHeaders(input.apiKey, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      model: visionModel,
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
                "reconhecivel: formato do rosto, cabelo, barba, oculos, tom de pele e detalhes " +
                "marcantes. Seja objetivo em 3-5 frases.",
            },
            { type: "image_url", image_url: { url: dataUrl } },
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
    throw new Error("Não foi possível analisar a foto para gerar a caricatura.");
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
    headers: buildOpenAiHeaders(input.apiKey, { "Content-Type": "application/json" }),
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

  throw new Error("OpenAI não retornou imagem de caricatura.");
}

function shouldUseGenerationFallback(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("not authorized") ||
    normalized.includes("unauthorized") ||
    normalized.includes("invalid value") ||
    normalized.includes("must be 'dall-e-2'") ||
    normalized.includes("does not exist")
  );
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

export async function generateCaricatureFromPhoto(input: {
  imageBuffer: Buffer;
  mimeType: string;
  variant?: CaricatureVariant;
  styleHint?: string;
}) {
  const apiKey = getOpenAiApiKey();
  const model = getCaricatureModel();
  const prompt = resolveCaricaturePrompt({
    variant: input.variant,
    styleHint: input.styleHint,
  });

  try {
    const result = await requestImageEdit({
      apiKey,
      model,
      imageBuffer: input.imageBuffer,
      mimeType: input.mimeType,
      prompt,
    });
    return { ...result, model };
  } catch (editError) {
    const editMessage =
      editError instanceof Error ? editError.message : String(editError);

    if (!shouldUseGenerationFallback(editMessage)) {
      throw editError;
    }

    const portraitDescription = await describePortraitForCaricature({
      apiKey,
      imageBuffer: input.imageBuffer,
      mimeType: input.mimeType,
    });

    const generationPrompt =
      `${prompt} Retrato baseado nesta pessoa: ${portraitDescription}`;

    const result = await requestImageGeneration({
      apiKey,
      model,
      prompt: generationPrompt,
    });
    return { ...result, model };
  }
}
