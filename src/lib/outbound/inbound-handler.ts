/**
 * Fluxo de uma mensagem recebida: registra na thread, gera a sugestão da IA e
 * deixa no painel para envio humano. O envio automático (se ninguém mandar em
 * 3 min) fica a cargo de `flushDueSuggestedReplies`.
 *
 * Separado da rota para poder ser exercitado sem HTTP (ver
 * `npm run whatsapp:test`).
 */

import { COLLECTIONS, col } from "@/lib/firebase/collections";
import { appLog, appLogError } from "@/lib/observability/log";
import { generateAgentReply, type AgentContactContext } from "@/lib/outbound/conversation-agent";
import {
  appendInboundMessage,
  setConversationError,
  setPendingSuggestion,
} from "@/lib/outbound/conversations-storage";
import { isPartyPresidentRole } from "@/lib/outbound/relevance";
import { isWithinServiceWindow } from "@/lib/outbound/types";
import { normalizeWaId, type InboundMessage } from "@/lib/outbound/whatsapp-webhook";

export type InboundOutcome =
  | { status: "duplicada" }
  | { status: "sem_texto" }
  | { status: "fora_da_janela" }
  | { status: "sem_resposta_llm" }
  | { status: "sugerida"; reply: string; autoSendAt: string };

/** Busca o contato pelo telefone para personalizar a conversa (best-effort). */
async function findContactByPhone(phoneE164: string): Promise<{
  id: string;
  context: AgentContactContext;
} | null> {
  const snapshot = await col(COLLECTIONS.marketingContacts)
    .where("phoneE164", "==", phoneE164)
    .limit(1)
    .get();

  const doc = snapshot.docs[0];
  if (!doc) {
    return null;
  }
  const data = doc.data();
  const roles = Array.isArray(data.roles) ? data.roles.map((item) => String(item)) : [];
  const parties = Array.isArray(data.parties) ? data.parties.map((item) => String(item)) : [];
  return {
    id: doc.id,
    context: {
      name: String(data.name ?? ""),
      uf: String(data.uf ?? ""),
      parties,
      roles,
      candidateRole: String(data.candidateRole ?? ""),
      gender: String(data.gender ?? ""),
      isReelection: Boolean(data.isReelection),
      isPartyPresident: isPartyPresidentRole(roles),
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

  if (!isWithinServiceWindow(conversation.lastInboundAt)) {
    return { status: "fora_da_janela" };
  }

  const reply = await generateAgentReply(conversation, contact?.context);
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
    });
    return { status: "sugerida", reply: reply.text, autoSendAt: pending.autoSendAt };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Falha ao gravar sugestão.";
    await setConversationError(phoneE164, detail);
    appLogError("marketing", "whatsapp_agente_sugestao_falhou", error, { phoneE164 });
    return { status: "sem_resposta_llm" };
  }
}
