/**
 * Fluxo de uma mensagem recebida: registra na thread, gera a sugestão da IA e
 * deixa no painel para envio humano. O envio automático (se ninguém mandar em
 * 3 min) fica a cargo de `flushDueSuggestedReplies`.
 *
 * Separado da rota para poder ser exercitado sem HTTP (ver
 * `npm run whatsapp:test`).
 */

import { appLog, appLogError } from "@/lib/observability/log";
import { generateAgentReply, type AgentContactContext } from "@/lib/outbound/conversation-agent";
import { resolveCannedPositiveReply } from "@/lib/outbound/canned-positive-reply";
import {
  appendInboundMessage,
  setAgentPaused,
  setConversationError,
  setPendingSuggestion,
} from "@/lib/outbound/conversations-storage";
import { getContactByPhone, setContactOptOut } from "@/lib/outbound/contacts-storage";
import { isOptOutText } from "@/lib/outbound/opt-out";
import { isPartyPresidentRole } from "@/lib/outbound/relevance";
import { firstName, isWithinServiceWindow } from "@/lib/outbound/types";
import { normalizeWaId, type InboundMessage } from "@/lib/outbound/whatsapp-webhook";

export type InboundOutcome =
  | { status: "duplicada" }
  | { status: "sem_texto" }
  | { status: "fora_da_janela" }
  | { status: "opt_out" }
  | { status: "sem_resposta_llm" }
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
