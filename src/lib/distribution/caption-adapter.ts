import { buildCaptionsByChannel } from "@/lib/distribution/captions";
import {
  DISTRIBUTION_CHANNELS,
  getChannelDef,
  type DistributionChannelId,
} from "@/lib/distribution/channels";

/**
 * Adaptação nativa por rede. `buildCaptionsByChannel` só corta no limite de
 * caracteres; aqui o mesmo roteiro aprovado vira uma legenda com o tom e o
 * formato que cada rede exige (a promessa da página do Distribuidor).
 * Sem OpenAI configurada, cai no truncamento — nunca bloqueia o pacote.
 */

type ChannelStyle = {
  id: DistributionChannelId;
  /** Instrução de tom/formato passada ao modelo. */
  guidance: string;
};

const CHANNEL_STYLES: readonly ChannelStyle[] = [
  {
    id: "instagram",
    guidance:
      "Reels vertical. Gancho na primeira linha, 2 a 4 frases curtas, quebras de linha, 3 a 5 hashtags no fim.",
  },
  {
    id: "facebook",
    guidance:
      "Vídeo nativo. Legenda mais longa e explicativa, tom de conversa com o eleitor, sem hashtags em excesso (no máximo 2).",
  },
  {
    id: "tiktok",
    guidance:
      "Corte dinâmico. Gancho nos primeiros 2 segundos, linguagem direta e informal, 1 a 2 frases, 3 hashtags.",
  },
  {
    id: "youtube",
    guidance:
      "Shorts. Primeira linha funciona como título objetivo do vídeo, depois uma frase de contexto e #Shorts no fim.",
  },
  {
    id: "threads",
    guidance:
      "Post conversacional e leve, no máximo 2 frases curtas, sem hashtags.",
  },
  {
    id: "linkedin",
    guidance:
      "Post institucional. Tom formal, foco em política pública e impacto, 3 a 4 frases, sem gírias, sem hashtags de campanha.",
  },
  {
    id: "twitter",
    guidance:
      "Direto ao ponto em até 280 caracteres, uma ideia só, sem emoji decorativo, no máximo 1 hashtag.",
  },
] as const;

function styleFor(channel: DistributionChannelId): ChannelStyle {
  return (
    CHANNEL_STYLES.find((style) => style.id === channel) ?? {
      id: channel,
      guidance: "Legenda curta e objetiva.",
    }
  );
}

function buildSystemPrompt() {
  return [
    "Voce adapta legendas de video de campanha politica brasileira para redes sociais.",
    "Regras invioláveis:",
    "- Nao invente fatos, numeros, datas, promessas ou cargos que nao estejam no roteiro base.",
    "- Nao adicione pedido explicito de voto nem ataque a adversarios.",
    "- Mantenha o idioma portugues do Brasil e o sentido do roteiro base.",
    "- Respeite o limite de caracteres de cada rede.",
    'Responda apenas JSON no formato {"captions":{"<canal>":"<legenda>"}}.',
  ].join("\n");
}

function buildUserPrompt(input: {
  captionBase: string;
  channels: DistributionChannelId[];
}) {
  const lines = input.channels.map((channel) => {
    const def = getChannelDef(channel);
    const style = styleFor(channel);
    return `- ${channel} (${def.label}, limite ${def.captionLimit} caracteres): ${style.guidance}`;
  });

  return [
    "Roteiro base aprovado:",
    '"""',
    input.captionBase.trim(),
    '"""',
    "",
    "Gere uma legenda para cada canal abaixo, usando exatamente estas chaves:",
    ...lines,
  ].join("\n");
}

function parseCaptions(raw: string): Record<string, string> {
  try {
    const parsed = JSON.parse(raw) as { captions?: Record<string, unknown> };
    const captions = parsed.captions;
    if (!captions || typeof captions !== "object") {
      return {};
    }
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(captions)) {
      if (typeof value === "string" && value.trim()) {
        result[key] = value.trim();
      }
    }
    return result;
  } catch {
    return {};
  }
}

async function callOpenAiForCaptions(input: {
  captionBase: string;
  channels: DistributionChannelId[];
}): Promise<Record<string, string>> {
  const { runWithProviderKeyPool, ProviderHttpError } = await import(
    "@/lib/admin/provider-key-pool"
  );

  return runWithProviderKeyPool("openai", async (apiKey) => {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        temperature: 0.6,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: buildUserPrompt(input) },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new ProviderHttpError({
        providerId: "openai",
        status: response.status,
        message: "Falha ao adaptar legendas por rede.",
        body: body.slice(0, 400),
      });
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return parseCaptions(json.choices?.[0]?.message?.content ?? "");
  });
}

export type AdaptCaptionsResult = {
  captionsByChannel: Partial<Record<DistributionChannelId, string>>;
  adapted: boolean;
  reason?: string;
};

/**
 * Gera as legendas por canal. Overrides do usuário sempre vencem a adaptação.
 */
export async function adaptCaptionsByChannel(input: {
  captionBase: string;
  channels: DistributionChannelId[];
  overrides?: Partial<Record<DistributionChannelId, string>>;
}): Promise<AdaptCaptionsResult> {
  const fallback = buildCaptionsByChannel(
    input.captionBase,
    input.channels,
    input.overrides,
  );

  const base = input.captionBase.trim();
  const pending = input.channels.filter((channel) => !input.overrides?.[channel]?.trim());
  if (!base || pending.length === 0) {
    return { captionsByChannel: fallback, adapted: false, reason: "nada a adaptar" };
  }

  try {
    const generated = await callOpenAiForCaptions({
      captionBase: base,
      channels: pending,
    });

    const merged: Partial<Record<DistributionChannelId, string>> = { ...fallback };
    let adapted = false;
    for (const channel of pending) {
      const value = generated[channel]?.trim();
      if (!value) {
        continue;
      }
      const limit = getChannelDef(channel).captionLimit;
      merged[channel] =
        value.length <= limit ? value : `${value.slice(0, limit - 1).trimEnd()}…`;
      adapted = true;
    }

    return {
      captionsByChannel: merged,
      adapted,
      reason: adapted ? undefined : "modelo nao devolveu canais validos",
    };
  } catch (error) {
    return {
      captionsByChannel: fallback,
      adapted: false,
      reason: error instanceof Error ? error.message : "falha na adaptacao",
    };
  }
}

/** Guia de tom/formato por rede — usado na UI para explicar a adaptação. */
export function captionStyleHints(): Array<{
  id: DistributionChannelId;
  label: string;
  guidance: string;
}> {
  return DISTRIBUTION_CHANNELS.map((channel) => ({
    id: channel.id,
    label: channel.label,
    guidance: styleFor(channel.id).guidance,
  }));
}
