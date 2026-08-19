/**
 * Parsing e autenticação do webhook da WhatsApp Cloud API.
 *
 * Funções puras (testáveis) — o efeito colateral (sugerir/enviar) fica na
 * rota. O payload da Meta é profundamente aninhado e mistura mensagens com
 * status de entrega no mesmo formato, daí o normalizador aqui.
 */

import crypto from "node:crypto";

export type InboundKind = "text" | "button" | "interactive" | "media";

export type InboundMessage = {
  from: string;
  text: string;
  providerMessageId: string;
  /** Nome do perfil do WhatsApp, quando a Meta envia. */
  profileName: string;
  /** Origem do inbound — botão de template vs texto digitado. */
  kind: InboundKind;
};

export type DeliveryStatus = {
  providerMessageId: string;
  status: string;
  recipient: string;
};

export type ParsedWebhook = {
  messages: InboundMessage[];
  statuses: DeliveryStatus[];
};

/**
 * Compara a assinatura `sha256=…` do header com o HMAC do corpo cru.
 *
 * Precisa do corpo exatamente como chegou — por isso a rota lê `request.text()`
 * antes de qualquer parse. Comparação em tempo constante para não vazar o
 * segredo por timing.
 */
export function isValidSignature(input: {
  rawBody: string;
  signatureHeader: string | null;
  appSecret: string;
}): boolean {
  if (!input.appSecret || !input.signatureHeader) {
    return false;
  }

  const expected = `sha256=${crypto
    .createHmac("sha256", input.appSecret)
    .update(input.rawBody, "utf8")
    .digest("hex")}`;

  const received = Buffer.from(input.signatureHeader);
  const computed = Buffer.from(expected);
  if (received.length !== computed.length) {
    return false;
  }

  return crypto.timingSafeEqual(received, computed);
}

type GraphChange = {
  value?: {
    contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
    messages?: Array<{
      from?: string;
      id?: string;
      type?: string;
      text?: { body?: string };
      button?: { text?: string };
      interactive?: {
        button_reply?: { title?: string };
        list_reply?: { title?: string };
      };
    }>;
    statuses?: Array<{ id?: string; status?: string; recipient_id?: string }>;
  };
};

/** Extrai o texto de mensagem simples, resposta de botão ou item de lista. */
function extractText(message: NonNullable<NonNullable<GraphChange["value"]>["messages"]>[number]) {
  return (
    message.text?.body ??
    message.button?.text ??
    message.interactive?.button_reply?.title ??
    message.interactive?.list_reply?.title ??
    ""
  ).trim();
}

function extractKind(
  message: NonNullable<NonNullable<GraphChange["value"]>["messages"]>[number],
): InboundKind {
  if (message.type === "button" || message.button) {
    return "button";
  }
  if (message.type === "interactive" || message.interactive) {
    return "interactive";
  }
  if (message.type === "text" || message.text) {
    return "text";
  }
  return "media";
}

export function parseWebhookPayload(payload: unknown): ParsedWebhook {
  const messages: InboundMessage[] = [];
  const statuses: DeliveryStatus[] = [];

  const entries = (payload as { entry?: Array<{ changes?: GraphChange[] }> })?.entry ?? [];

  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value) {
        continue;
      }

      const profileByWaId = new Map(
        (value.contacts ?? []).map((contact) => [contact.wa_id ?? "", contact.profile?.name ?? ""]),
      );

      for (const message of value.messages ?? []) {
        const from = (message.from ?? "").trim();
        const providerMessageId = (message.id ?? "").trim();
        const text = extractText(message);
        // Áudio, imagem e afins chegam sem texto: registramos a entrada, mas o
        // agente não tem o que responder — tratado como texto vazio adiante.
        if (from && providerMessageId) {
          messages.push({
            from,
            text,
            providerMessageId,
            profileName: profileByWaId.get(from) ?? "",
            kind: extractKind(message),
          });
        }
      }

      for (const status of value.statuses ?? []) {
        if (status.id) {
          statuses.push({
            providerMessageId: status.id,
            status: status.status ?? "",
            recipient: status.recipient_id ?? "",
          });
        }
      }
    }
  }

  return { messages, statuses };
}

/**
 * A Meta manda o número sem "+" e, em celular brasileiro, às vezes sem o 9º
 * dígito — o mesmo contato pode chegar como 5531988887777 e 553188887777.
 * Normaliza para a forma de 13 dígitos usada como id da thread.
 */
export function normalizeWaId(waId: string): string {
  const digits = waId.replace(/\D/g, "");
  if (!digits.startsWith("55")) {
    return digits;
  }

  const rest = digits.slice(2);
  if (rest.length === 10) {
    const ddd = rest.slice(0, 2);
    const subscriber = rest.slice(2);
    return `55${ddd}9${subscriber}`;
  }

  return digits;
}
