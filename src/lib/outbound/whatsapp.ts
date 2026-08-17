/**
 * Cliente da WhatsApp Cloud API (Meta) para o outbound.
 *
 * Dois modos de envio, com regras diferentes da plataforma:
 *
 * - **Template** (`sendTemplate`): único jeito de iniciar conversa com quem
 *   nunca respondeu. Exige template aprovado no Meta.
 * - **Texto livre** (`sendText`): só vale dentro da **janela de 24h** contada a
 *   partir da última mensagem do contato. É por aí que o agente de IA responde.
 *
 * Doc: docs/marketing-outbound.md
 */

import { appLogError } from "@/lib/observability/log";

/** Versão que o painel do Meta serve hoje nos exemplos de cURL (ago/2026). */
const GRAPH_VERSION = "v25.0";

export type WhatsappConfig = {
  phoneNumberId: string;
  accessToken: string;
  graphVersion: string;
};

export class WhatsappNotConfiguredError extends Error {}
export class WhatsappSendError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly code: string | null,
  ) {
    super(message);
  }
}

/**
 * `null` quando falta o essencial (fail-closed).
 *
 * Só env, diferente de Resend/HeyGen: o cofre de provider secrets tem catálogo
 * fechado e o token aqui é de system user (longa duração), então não vale
 * expandir o catálogo só por isso.
 */
export async function resolveWhatsappConfig(): Promise<WhatsappConfig | null> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim() || "";
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || "";
  if (!accessToken || !phoneNumberId) {
    return null;
  }

  return {
    phoneNumberId,
    accessToken,
    graphVersion: process.env.WHATSAPP_GRAPH_VERSION?.trim() || GRAPH_VERSION,
  };
}

export async function isWhatsappConfigured(): Promise<boolean> {
  return (await resolveWhatsappConfig()) !== null;
}

type GraphResponse = {
  error?: { message?: string; code?: number; error_subcode?: number; type?: string };
  messages?: Array<{ id?: string }>;
};

async function postToGraph(
  config: WhatsappConfig,
  payload: Record<string, unknown>,
): Promise<{ messageId: string }> {
  const url = `https://graph.facebook.com/${config.graphVersion}/${config.phoneNumberId}/messages`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    throw new WhatsappSendError(
      error instanceof Error ? error.message : "Falha de rede ao chamar a Cloud API.",
      null,
      null,
    );
  }

  const text = await response.text();
  let json: GraphResponse | null = null;
  try {
    json = text ? (JSON.parse(text) as GraphResponse) : null;
  } catch {
    // resposta não-JSON (ex.: HTML de erro de proxy)
  }

  if (!response.ok) {
    const message = json?.error?.message || `Cloud API respondeu ${response.status}.`;
    const code = json?.error?.code != null ? String(json.error.code) : null;
    appLogError("marketing", "whatsapp_send_failed", new Error(message), {
      status: response.status,
      code,
    });
    throw new WhatsappSendError(message, response.status, code);
  }

  const messageId = json?.messages?.[0]?.id;
  if (!messageId) {
    throw new WhatsappSendError("Cloud API não retornou id da mensagem.", response.status, null);
  }

  return { messageId };
}

/** Parâmetro posicional de template: `{{1}}` é o primeiro item da lista. */
export type TemplateParams = string[];

export async function sendTemplate(input: {
  config: WhatsappConfig;
  to: string;
  templateName: string;
  languageCode?: string;
  params?: TemplateParams;
}): Promise<{ messageId: string }> {
  const params = input.params ?? [];

  return postToGraph(input.config, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: input.to,
    type: "template",
    template: {
      name: input.templateName,
      language: { code: input.languageCode?.trim() || "pt_BR" },
      ...(params.length > 0
        ? {
            components: [
              {
                type: "body",
                parameters: params.map((text) => ({ type: "text", text })),
              },
            ],
          }
        : {}),
    },
  });
}

/**
 * Texto livre. Falha com código 131047 quando a janela de 24h expirou — nesse
 * caso só um template reabre a conversa.
 */
export async function sendText(input: {
  config: WhatsappConfig;
  to: string;
  body: string;
}): Promise<{ messageId: string }> {
  return postToGraph(input.config, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: input.to,
    type: "text",
    text: { preview_url: false, body: input.body },
  });
}

/** Erro da Meta indicando que a janela de atendimento de 24h fechou. */
export function isOutsideWindowError(error: unknown): boolean {
  return error instanceof WhatsappSendError && error.code === "131047";
}
