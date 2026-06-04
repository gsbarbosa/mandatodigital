import {
  resolveCaricaturePrompt,
  type CaricatureVariant,
} from "@/lib/openai-caricature-prompts";

const DEFAULT_CARICATURE_MODEL = "gpt-image-1.5";

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

  return `OpenAI falhou ao gerar caricatura (${status}).`;
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

  const extension = extensionForMime(input.mimeType);
  const formData = new FormData();
  formData.append("model", model);
  formData.append(
    "image",
    new Blob([new Uint8Array(input.imageBuffer)], {
      type: input.mimeType || "image/jpeg",
    }),
    `source.${extension}`,
  );
  formData.append("prompt", prompt);
  formData.append("size", "1024x1024");
  formData.append("quality", "high");
  formData.append("output_format", "png");

  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  const rawBody = await response.text();
  if (!response.ok) {
    throw new Error(parseOpenAiImageError(response.status, rawBody));
  }

  let json: {
    data?: Array<{ b64_json?: string; url?: string }>;
  };

  try {
    json = JSON.parse(rawBody) as typeof json;
  } catch {
    throw new Error("Resposta invalida da OpenAI ao gerar caricatura.");
  }

  const b64 = json.data?.[0]?.b64_json?.trim();
  if (b64) {
    return {
      buffer: Buffer.from(b64, "base64"),
      mimeType: "image/png",
      model,
    };
  }

  const imageUrl = json.data?.[0]?.url?.trim();
  if (imageUrl) {
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error("OpenAI retornou URL de caricatura, mas o download falhou.");
    }
    const buffer = Buffer.from(await imageResponse.arrayBuffer());
    const mimeType = imageResponse.headers.get("content-type")?.trim() || "image/png";
    return { buffer, mimeType, model };
  }

  throw new Error("OpenAI nao retornou imagem de caricatura.");
}
