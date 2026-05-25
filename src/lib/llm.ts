import type { ContentRequestInput } from "@/lib/schemas";
import type { PoliticianProfile } from "@/lib/types";

import { buildFallbackVariants } from "@/lib/fallback-generator";
import { buildGenerationPrompt } from "@/lib/prompt-builder";

type GeneratedVariant = {
  title: string;
  angle: string;
  body: string;
  promptPreview: string;
  provider: string;
};

type ParsedResponse = {
  versions: Array<{
    title?: string;
    angle?: string;
    body?: string;
  }>;
};

function parseMaybeJson(text: string): ParsedResponse | null {
  try {
    return JSON.parse(text) as ParsedResponse;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return null;
    }

    try {
      return JSON.parse(match[0]) as ParsedResponse;
    } catch {
      return null;
    }
  }
}

function normalizeResponse(
  payload: ParsedResponse | null,
  promptPreview: string,
  provider: string,
) {
  if (!payload?.versions?.length) {
    return null;
  }

  const versions = payload.versions
    .map((item, index) => ({
      title: item.title?.trim() || `Versao ${index + 1}`,
      angle: item.angle?.trim() || `Abordagem ${index + 1}`,
      body: item.body?.trim() || "",
      promptPreview,
      provider,
    }))
    .filter((item) => item.body.length >= 20);

  return versions.length ? versions.slice(0, 3) : null;
}

async function callOpenAI(system: string, user: string) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return null;
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      temperature: 0.8,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    throw new Error("Falha ao consultar OpenAI.");
  }

  const json = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  return json.choices?.[0]?.message?.content ?? null;
}

async function callAnthropic(system: string, user: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return null;
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest",
      max_tokens: 1400,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!response.ok) {
    throw new Error("Falha ao consultar Anthropic.");
  }

  const json = (await response.json()) as {
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  };

  return json.content?.find((item) => item.type === "text")?.text ?? null;
}

export async function generateContentVariants(
  profile: PoliticianProfile,
  request: ContentRequestInput,
): Promise<GeneratedVariant[]> {
  const prompt = buildGenerationPrompt(profile, request);

  try {
    const provider = process.env.OPENAI_API_KEY ? "openai" : process.env.ANTHROPIC_API_KEY ? "anthropic" : null;
    const rawText = process.env.OPENAI_API_KEY
      ? await callOpenAI(prompt.system, prompt.user)
      : process.env.ANTHROPIC_API_KEY
        ? await callAnthropic(prompt.system, prompt.user)
        : null;

    if (!rawText || !provider) {
      return buildFallbackVariants(profile, request, prompt.preview);
    }

    const normalized = normalizeResponse(
      parseMaybeJson(rawText),
      prompt.preview,
      provider,
    );

    if (!normalized) {
      return buildFallbackVariants(profile, request, prompt.preview);
    }

    return normalized;
  } catch {
    return buildFallbackVariants(profile, request, prompt.preview);
  }
}
