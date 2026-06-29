import type {
  ContentRequestInput,
  LlmExecutionOptionsInput,
} from "@/lib/schemas";
import type {
  GeneratedContentVariant,
  LlmExecutionResult,
  LlmProvider,
  PoliticianProfile,
  PromptTemplateMetadata,
  TokenUsage,
} from "@/lib/types";

import { buildFallbackVariants } from "@/lib/fallback-generator";
import { buildGenerationPrompt } from "@/lib/prompt-builder";

export type GeneratedVariant = GeneratedContentVariant & {
  promptPreview: string;
  provider: string;
  model: string;
  templateId: string;
  promptVersion: string;
  rawResponse: string;
  latencyMs: number;
  tokenUsage: TokenUsage | null;
};

export type ContentGenerationResult = {
  prompt: PromptTemplateMetadata & {
    system: string;
    user: string;
    fingerprint: string;
  };
  variants: GeneratedVariant[];
  rawText: string | null;
  provider: string;
  model: string;
  latencyMs: number;
  tokenUsage: TokenUsage | null;
  usedFallback: boolean;
};

type ParsedResponse = {
  versions: Array<{
    title?: string;
    angle?: string;
    body?: string;
  }>;
};

type ProviderRequestOptions = {
  model: string;
  temperature?: number;
  maxTokens?: number;
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
  prompt: PromptTemplateMetadata,
  execution: LlmExecutionResult,
): GeneratedVariant[] | null {
  if (!payload?.versions?.length) {
    return null;
  }

  const versions = payload.versions
    .map((item, index) => ({
      title: item.title?.trim() || `Versao ${index + 1}`,
      angle: item.angle?.trim() || `Abordagem ${index + 1}`,
      body: item.body?.trim() || "",
      promptPreview: prompt.preview,
      provider: execution.provider || "desconhecido",
      model: execution.model || "desconhecido",
      templateId: prompt.templateId,
      promptVersion: prompt.promptVersion,
      rawResponse: execution.rawText || "",
      latencyMs: execution.latencyMs ?? 0,
      tokenUsage: execution.tokenUsage,
    }))
    .filter((item) => item.body.length >= 20);

  return versions.length ? versions.slice(0, 3) : null;
}

function normalizeTokenUsage(inputTokens = 0, outputTokens = 0): TokenUsage {
  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
  };
}

function getConfiguredProvider(provider: Exclude<LlmProvider, "fallback-local">) {
  if (provider === "openai") {
    return {
      apiKey: process.env.OPENAI_API_KEY,
      defaultModel: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    };
  }

  return {
    apiKey: process.env.ANTHROPIC_API_KEY,
    defaultModel: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest",
  };
}

function resolveExecutionProvider(
  requestedProvider?: Exclude<LlmProvider, "fallback-local">,
) {
  if (requestedProvider) {
    const configured = getConfiguredProvider(requestedProvider);
    if (!configured.apiKey) {
      return null;
    }

    return requestedProvider;
  }

  if (process.env.OPENAI_API_KEY) {
    return "openai" as const;
  }

  if (process.env.ANTHROPIC_API_KEY) {
    return "anthropic" as const;
  }

  return null;
}

async function callOpenAI(
  system: string,
  user: string,
  options: ProviderRequestOptions,
): Promise<LlmExecutionResult> {
  const { apiKey } = getConfiguredProvider("openai");

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY não configurada.");
  }

  const startedAt = Date.now();

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: options.model,
      temperature: options?.temperature ?? 0.8,
      max_tokens: options?.maxTokens,
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
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };

  const tokenUsage = json.usage
    ? normalizeTokenUsage(
        json.usage.prompt_tokens ?? 0,
        json.usage.completion_tokens ?? 0,
      )
    : null;

  return {
    rawText: json.choices?.[0]?.message?.content ?? null,
    provider: "openai",
    model: options.model,
    latencyMs: Date.now() - startedAt,
    tokenUsage: tokenUsage
      ? {
          ...tokenUsage,
          totalTokens: json.usage?.total_tokens ?? tokenUsage.totalTokens,
        }
      : null,
  };
}

async function callAnthropic(
  system: string,
  user: string,
  options: ProviderRequestOptions,
): Promise<LlmExecutionResult> {
  const { apiKey } = getConfiguredProvider("anthropic");

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY não configurada.");
  }

  const startedAt = Date.now();

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: options.model,
      max_tokens: options?.maxTokens ?? 1400,
      temperature: options?.temperature ?? 0.4,
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
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
    };
  };

  return {
    rawText: json.content?.find((item) => item.type === "text")?.text ?? null,
    provider: "anthropic",
    model: options.model,
    latencyMs: Date.now() - startedAt,
    tokenUsage: json.usage
      ? normalizeTokenUsage(
          json.usage.input_tokens ?? 0,
          json.usage.output_tokens ?? 0,
        )
      : null,
  };
}

export function parseJsonResponse<T>(text: string): T | null {
  return parseMaybeJson(text) as T | null;
}

async function callOpenAIPlainText(
  system: string,
  user: string,
  options: ProviderRequestOptions,
): Promise<LlmExecutionResult> {
  const { apiKey } = getConfiguredProvider("openai");

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY não configurada.");
  }

  const startedAt = Date.now();

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: options.model,
      temperature: options?.temperature ?? 0.8,
      max_tokens: options?.maxTokens ?? 400,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
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
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };

  const tokenUsage = json.usage
    ? normalizeTokenUsage(
        json.usage.prompt_tokens ?? 0,
        json.usage.completion_tokens ?? 0,
      )
    : null;

  return {
    rawText: json.choices?.[0]?.message?.content ?? null,
    provider: "openai",
    model: options.model,
    latencyMs: Date.now() - startedAt,
    tokenUsage: tokenUsage
      ? {
          ...tokenUsage,
          totalTokens: json.usage?.total_tokens ?? tokenUsage.totalTokens,
        }
      : null,
  };
}

export async function requestPlainText(
  system: string,
  user: string,
  options?: LlmExecutionOptionsInput,
): Promise<LlmExecutionResult> {
  const provider = resolveExecutionProvider(options?.provider);

  if (!provider) {
    if (options?.strict) {
      throw new Error("Nenhum provider de LLM configurado para esta execução.");
    }

    return {
      rawText: null,
      provider: null,
      model: null,
      latencyMs: null,
      tokenUsage: null,
    };
  }

  const { defaultModel } = getConfiguredProvider(provider);
  const requestOptions = {
    model: options?.model?.trim() || defaultModel,
    temperature: options?.temperature,
    maxTokens: options?.maxTokens,
  };

  return provider === "openai"
    ? callOpenAIPlainText(system, user, requestOptions)
    : callAnthropic(system, user, requestOptions);
}

export async function requestStructuredJson(
  system: string,
  user: string,
  options?: LlmExecutionOptionsInput,
): Promise<LlmExecutionResult> {
  const provider = resolveExecutionProvider(options?.provider);

  if (!provider) {
    if (options?.strict) {
      throw new Error("Nenhum provider de LLM configurado para esta execução.");
    }

    return {
      rawText: null,
      provider: null,
      model: null,
      latencyMs: null,
      tokenUsage: null,
    };
  }

  const { defaultModel } = getConfiguredProvider(provider);
  const requestOptions = {
    model: options?.model?.trim() || defaultModel,
    temperature: options?.temperature,
    maxTokens: options?.maxTokens,
  };

  return provider === "openai"
    ? callOpenAI(system, user, requestOptions)
    : callAnthropic(system, user, requestOptions);
}

function buildFallbackGenerationResult(
  profile: PoliticianProfile,
  request: ContentRequestInput,
  prompt: ContentGenerationResult["prompt"],
): ContentGenerationResult {
  const variants = buildFallbackVariants(profile, request, prompt.preview).map(
    (item) => ({
      ...item,
      model: "fallback-local",
      templateId: prompt.templateId,
      promptVersion: prompt.promptVersion,
      rawResponse: "",
      latencyMs: 0,
      tokenUsage: null,
    }),
  );

  return {
    prompt,
    variants,
    rawText: null,
    provider: "fallback-local",
    model: "fallback-local",
    latencyMs: 0,
    tokenUsage: null,
    usedFallback: true,
  };
}

export async function generateContentVariants(
  profile: PoliticianProfile,
  request: ContentRequestInput,
  options?: {
    prompt?: {
      templateId?: string;
      promptVersion?: string;
      systemAddendum?: string;
      userAddendum?: string;
    };
    execution?: LlmExecutionOptionsInput;
    allowFallback?: boolean;
  },
): Promise<ContentGenerationResult> {
  const prompt = buildGenerationPrompt(profile, request, options?.prompt);
  const allowFallback = options?.allowFallback ?? true;

  try {
    const execution = await requestStructuredJson(
      prompt.system,
      prompt.user,
      {
        temperature: options?.execution?.temperature ?? 0.8,
        maxTokens: options?.execution?.maxTokens ?? 1800,
        provider: options?.execution?.provider,
        model: options?.execution?.model,
        strict: options?.execution?.strict,
      },
    );

    if (!execution.rawText || !execution.provider || !execution.model) {
      if (!allowFallback) {
        throw new Error("A execução da LLM não retornou resposta utilizavel.");
      }

      return buildFallbackGenerationResult(profile, request, prompt);
    }

    const normalized = normalizeResponse(parseMaybeJson(execution.rawText), prompt, execution);

    if (!normalized) {
      if (!allowFallback) {
        throw new Error("A resposta da LLM não respeitou o contrato esperado.");
      }

      return buildFallbackGenerationResult(profile, request, prompt);
    }

    return {
      prompt,
      variants: normalized,
      rawText: execution.rawText,
      provider: execution.provider,
      model: execution.model,
      latencyMs: execution.latencyMs ?? 0,
      tokenUsage: execution.tokenUsage,
      usedFallback: false,
    };
  } catch (error) {
    if (!allowFallback) {
      throw error;
    }

    return buildFallbackGenerationResult(profile, request, prompt);
  }
}
