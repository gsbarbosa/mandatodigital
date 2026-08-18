/**
 * Resposta humana pelo painel: texto livre via Cloud API, na janela de 24h.
 *
 * Enviar cancela a sugestão pendente (e o auto-envio de 3 min). Não pausa a
 * IA — isso só acontece em "Assumir".
 */

import {
  appendOutboundMessage,
  getConversation,
  setConversationError,
} from "@/lib/outbound/conversations-storage";
import { isWithinServiceWindow } from "@/lib/outbound/types";
import {
  isOutsideWindowError,
  resolveWhatsappConfig,
  sendText,
  WhatsappSendError,
} from "@/lib/outbound/whatsapp";

export class OperatorReplyError extends Error {}

export async function sendOperatorReply(
  phoneE164: string,
  text: string,
): Promise<{ messageId: string }> {
  const conversation = await getConversation(phoneE164);
  if (!conversation) {
    throw new OperatorReplyError("Conversa não encontrada.");
  }

  if (!isWithinServiceWindow(conversation.lastInboundAt)) {
    throw new OperatorReplyError(
      "A janela de 24h fechou. Só um template de campanha reabre a conversa.",
    );
  }

  const config = await resolveWhatsappConfig();
  if (!config) {
    throw new OperatorReplyError(
      "WhatsApp não configurado (WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN).",
    );
  }

  try {
    const { messageId } = await sendText({ config, to: phoneE164, body: text });
    await appendOutboundMessage({
      phoneE164,
      text,
      providerMessageId: messageId,
      role: "humano",
    });
    return { messageId };
  } catch (error) {
    const detail = isOutsideWindowError(error)
      ? "A janela de 24h fechou. Só um template de campanha reabre a conversa."
      : error instanceof WhatsappSendError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Falha ao enviar.";
    await setConversationError(phoneE164, detail);
    throw new OperatorReplyError(detail);
  }
}
