/**
 * Fluxo de uma mensagem recebida: registra na thread e, no caso geral, gera
 * sugestão da Marina (auto-envio em 3 min). Clique no botão positivo do
 * template com resposta pré-moldada envia na hora, sem LLM.
 */

import { appLog, appLogError } from "@/lib/observability/log";
import { generateAgentReply, type AgentContactContext } from "@/lib/outbound/conversation-agent";
import { resolveCannedPositiveReply } from "@/lib/outbound/canned-positive-reply";
import {
  appendAgentMessage,
  appendInboundMessage,
  setAgentPaused,
  setConversationError,
  setPendingSuggestion,
} from "@/lib/outbound/conversations-storage";
import { getContactByPhone, setContactOptOut } from "@/lib/outbound/contacts-storage";
import { isOptOutText } from "@/lib/outbound/opt-out";
import { isPartyPresidentRole } from "@/lib/outbound/relevance";
import { firstName, isWithinServiceWindow } from "@/lib/outbound/types";
import { resolveWhatsappConfig, sendText } from "@/lib/outbound/whatsapp";
import { normalizeWaId, type InboundMessage } from "@/lib/outbound/whatsapp-webhook";

export type InboundOutcome =
  | { status: "duplicada" }
  | { status: "sem_texto" }
  | { status: "fora_da_janela" }
  | { status: "opt_out" }
  | { status: "sem_resposta_llm" }
  | { status: "enviada"; reply: string }
  | { status: "sugerida"; reply: string; autoSendAt: string };

/** Busca o contato pelo telefone para personalizar a conversa (best-effort). */
async function findContactByPhone(phoneE164: string): Promise<{
  id: string;
  context: AgentContactContext;
  optOut: boolean;
  lastTemplate: string;
} | null> {
  const contact = await getContactByPhone(phoneE164);
  if (!contact) {
    return null;
  }
  return {
    id: contact.id,
    optOut: contact.optOut,
    lastTemplate: contact.lastTemplate,
    context: {
      name: contact.name,
      uf: contact.uf,
      parties: contact.parties,
      roles: contact.roles,
      candidateRole: contact.candidateRole,
      gender: contact.gender,
      isReelection: contact.isReelection,
      isPartyPresident: isPartyPresidentRole(contact.roles),
    },
  };
}

export async function handleInboundMessage(message: InboundMessage): Promise<InboundOutcome> {
  const phoneE164 = normalizeWaId(message.from);
  const contact = await findContactByPhone(phoneE164);

  const conversation = await appendInboundMessage({
    phoneE164,
    text: message.text,
    providerMessageId: message.providerMessageId,
    contactId: contact?.id,
    contactName: contact?.context.name || message.profileName,
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

  if (isOptOutText(message.text) || contact?.optOut) {
    await setContactOptOut(phoneE164, {
      name: contact?.context.name || message.profileName,
    });
    await setAgentPaused(phoneE164, true);
    appLog("marketing", "whatsapp_opt_out", { phoneE164 });
    return { status: "opt_out" };
  }

  if (!isWithinServiceWindow(conversation.lastInboundAt)) {
    return { status: "fora_da_janela" };
  }

  const leadMessageCount = conversation.messages.filter((item) => item.role === "lead").length;
  const canned = resolveCannedPositiveReply({
    kind: message.kind,
    buttonText: message.text,
    lastTemplate: contact?.lastTemplate ?? "",
    leadMessageCount,
    firstName: firstName(contact?.context.name || message.profileName),
  });

  const reply = canned
    ? { text: canned, provider: "canned", model: "positive-button" }
    : await generateAgentReply(conversation, contact?.context);
  if (!reply) {
    await setConversationError(phoneE164, "LLM não retornou resposta.");
    return { status: "sem_resposta_llm" };
  }

  if (canned) {
    const config = await resolveWhatsappConfig();
    if (!config) {
      await setConversationError(phoneE164, "WhatsApp não configurado para responder.");
      return { status: "sem_resposta_llm" };
    }
    try {
      const { messageId } = await sendText({ config, to: phoneE164, body: canned });
      await appendAgentMessage({
        phoneE164,
        text: canned,
        providerMessageId: messageId,
      });
      appLog("marketing", "whatsapp_canned_enviou", {
        phoneE164,
        chars: canned.length,
        lastTemplate: contact?.lastTemplate ?? "",
      });
      return { status: "enviada", reply: canned };
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Falha ao enviar resposta pronta.";
      await setConversationError(phoneE164, detail);
      appLogError("marketing", "whatsapp_canned_envio_falhou", error, { phoneE164 });
      return { status: "sem_resposta_llm" };
    }
  }

  try {
    const pending = await setPendingSuggestion(phoneE164, {
      text: reply.text,
      paused: conversation.agentPaused,
    });
    appLog("marketing", "whatsapp_agente_sugeriu", {
      phoneE164,
      provider: reply.provider,
      model: reply.model,
      chars: reply.text.length,
      autoSendAt: pending.autoSendAt || null,
      agentPaused: conversation.agentPaused,
      canned: Boolean(canned),
    });
    return { status: "sugerida", reply: reply.text, autoSendAt: pending.autoSendAt };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Falha ao gravar sugestão.";
    await setConversationError(phoneE164, detail);
    appLogError("marketing", "whatsapp_agente_sugestao_falhou", error, { phoneE164 });
    return { status: "sem_resposta_llm" };
  }
}
