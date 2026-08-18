/**
 * Envia sugestões da Marina cujo prazo de 3 min venceu e o humano não mandou.
 * Threads assumidas (`agentPaused`) nunca entram aqui — a IA só sugere.
 */

import { appLog, appLogError } from "@/lib/observability/log";
import {
  appendAgentMessage,
  claimDueSuggestion,
  listConversations,
  restoreSuggestion,
  setConversationError,
} from "@/lib/outbound/conversations-storage";
import { isSuggestionAutoSendDue, isWithinServiceWindow } from "@/lib/outbound/types";
import { resolveWhatsappConfig, sendText } from "@/lib/outbound/whatsapp";

export type FlushSuggestedRepliesResult = {
  examined: number;
  sent: number;
  skipped: number;
  failed: number;
};

export async function flushDueSuggestedReplies(
  nowMs = Date.now(),
): Promise<FlushSuggestedRepliesResult> {
  const due = (await listConversations()).filter((conversation) =>
    isSuggestionAutoSendDue(conversation, nowMs),
  );

  const result: FlushSuggestedRepliesResult = {
    examined: due.length,
    sent: 0,
    skipped: 0,
    failed: 0,
  };

  if (due.length === 0) {
    return result;
  }

  const config = await resolveWhatsappConfig();

  for (const conversation of due) {
    if (!isWithinServiceWindow(conversation.lastInboundAt, nowMs)) {
      result.skipped += 1;
      continue;
    }

    if (!config) {
      await setConversationError(conversation.phoneE164, "WhatsApp não configurado para responder.");
      result.failed += 1;
      continue;
    }

    const claimed = await claimDueSuggestion(conversation.phoneE164, nowMs);
    if (!claimed) {
      result.skipped += 1;
      continue;
    }

    try {
      const { messageId } = await sendText({
        config,
        to: conversation.phoneE164,
        body: claimed.text,
      });
      await appendAgentMessage({
        phoneE164: conversation.phoneE164,
        text: claimed.text,
        providerMessageId: messageId,
      });
      appLog("marketing", "whatsapp_agente_autoenviou", {
        phoneE164: conversation.phoneE164,
        chars: claimed.text.length,
      });
      result.sent += 1;
    } catch (error) {
      await restoreSuggestion(conversation.phoneE164, claimed);
      const detail = error instanceof Error ? error.message : "Falha ao enviar sugestão.";
      await setConversationError(conversation.phoneE164, detail);
      appLogError("marketing", "whatsapp_agente_autoenvio_falhou", error, {
        phoneE164: conversation.phoneE164,
      });
      result.failed += 1;
    }
  }

  return result;
}
