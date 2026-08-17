/**
 * Fluxo de uma mensagem recebida: registra na thread, gera a resposta da IA e
 * envia de volta pelo WhatsApp.
 *
 * Separado da rota para poder ser exercitado sem HTTP (ver
 * `npm run whatsapp:test`).
 */

import { COLLECTIONS, col } from "@/lib/firebase/collections";
import { appLog, appLogError } from "@/lib/observability/log";
import { generateAgentReply } from "@/lib/outbound/conversation-agent";
import {
  appendAgentMessage,
  appendInboundMessage,
  setConversationError,
} from "@/lib/outbound/conversations-storage";
import { isWithinServiceWindow } from "@/lib/outbound/types";
import { resolveWhatsappConfig, sendText } from "@/lib/outbound/whatsapp";
import { normalizeWaId, type InboundMessage } from "@/lib/outbound/whatsapp-webhook";

export type InboundOutcome =
  | { status: "duplicada" }
  | { status: "sem_texto" }
  | { status: "agente_pausado" }
  | { status: "fora_da_janela" }
  | { status: "sem_resposta_llm" }
  | { status: "erro_envio"; error: string }
  | { status: "respondida"; reply: string };

/** Busca o contato pelo telefone para personalizar a conversa (best-effort). */
async function findContactByPhone(phoneE164: string) {
  const snapshot = await col(COLLECTIONS.marketingContacts)
    .where("phoneE164", "==", phoneE164)
    .limit(1)
    .get();

  const doc = snapshot.docs[0];
  return doc ? { id: doc.id, name: String(doc.data().name ?? "") } : null;
}

export async function handleInboundMessage(message: InboundMessage): Promise<InboundOutcome> {
  const phoneE164 = normalizeWaId(message.from);
  const contact = await findContactByPhone(phoneE164);

  const conversation = await appendInboundMessage({
    phoneE164,
    text: message.text,
    providerMessageId: message.providerMessageId,
    contactId: contact?.id,
    contactName: contact?.name || message.profileName,
  });

  // Já processada: a Meta reentrega o mesmo evento quando a resposta demora.
  if (!conversation) {
    appLog("marketing", "whatsapp_inbound_duplicada", {
      providerMessageId: message.providerMessageId,
    });
    return { status: "duplicada" };
  }

  if (!message.text) {
    // Áudio/imagem/sticker: fica registrado para atendimento humano.
    return { status: "sem_texto" };
  }

  if (conversation.agentPaused) {
    return { status: "agente_pausado" };
  }

  if (!isWithinServiceWindow(conversation.lastInboundAt)) {
    return { status: "fora_da_janela" };
  }

  const config = await resolveWhatsappConfig();
  if (!config) {
    await setConversationError(phoneE164, "WhatsApp não configurado para responder.");
    return { status: "erro_envio", error: "WhatsApp não configurado." };
  }

  const reply = await generateAgentReply(conversation);
  if (!reply) {
    await setConversationError(phoneE164, "LLM não retornou resposta.");
    return { status: "sem_resposta_llm" };
  }

  try {
    const { messageId } = await sendText({ config, to: phoneE164, body: reply.text });
    await appendAgentMessage({ phoneE164, text: reply.text, providerMessageId: messageId });
    appLog("marketing", "whatsapp_agente_respondeu", {
      phoneE164,
      provider: reply.provider,
      model: reply.model,
      chars: reply.text.length,
    });
    return { status: "respondida", reply: reply.text };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Falha ao enviar resposta.";
    await setConversationError(phoneE164, detail);
    appLogError("marketing", "whatsapp_agente_falhou", error, { phoneE164 });
    return { status: "erro_envio", error: detail };
  }
}
