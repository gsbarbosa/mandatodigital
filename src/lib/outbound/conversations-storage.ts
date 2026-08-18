/** Threads de conversa do WhatsApp (`marketingConversations`, doc id = E.164). */

import type { DocumentData } from "firebase-admin/firestore";

import { COLLECTIONS, col } from "@/lib/firebase/collections";
import {
  computeSuggestionAutoSendAt,
  isConversationRole,
  isSuggestionAutoSendDue,
  type ConversationMessage,
  type ConversationRole,
  type MarketingConversation,
} from "@/lib/outbound/types";

/** Corta o histórico para não crescer sem limite no doc nem no prompt. */
const MAX_MESSAGES = 40;

function nowIso() {
  return new Date().toISOString();
}

function mapDoc(id: string, data: DocumentData | undefined): MarketingConversation | null {
  if (!data) {
    return null;
  }

  const messages = Array.isArray(data.messages)
    ? (data.messages as DocumentData[]).map((raw) => ({
        role: isConversationRole(raw.role) ? raw.role : ("lead" as const),
        text: String(raw.text ?? ""),
        providerMessageId: String(raw.providerMessageId ?? ""),
        at: String(raw.at ?? nowIso()),
      }))
    : [];

  return {
    id,
    contactId: String(data.contactId ?? ""),
    contactName: String(data.contactName ?? ""),
    phoneE164: String(data.phoneE164 ?? id),
    campaignId: String(data.campaignId ?? ""),
    messages,
    lastInboundAt: String(data.lastInboundAt ?? ""),
    agentPaused: Boolean(data.agentPaused),
    suggestedReply: String(data.suggestedReply ?? ""),
    suggestedAt: String(data.suggestedAt ?? ""),
    autoSendAt: String(data.autoSendAt ?? ""),
    lastError: String(data.lastError ?? ""),
    createdAt: String(data.createdAt ?? nowIso()),
    updatedAt: String(data.updatedAt ?? nowIso()),
  };
}

export async function getConversation(phoneE164: string): Promise<MarketingConversation | null> {
  const snapshot = await col(COLLECTIONS.marketingConversations).doc(phoneE164).get();
  return mapDoc(snapshot.id, snapshot.data());
}

export async function listConversations(): Promise<MarketingConversation[]> {
  const snapshot = await col(COLLECTIONS.marketingConversations).get();
  return snapshot.docs
    .map((doc) => mapDoc(doc.id, doc.data()))
    .filter((item): item is MarketingConversation => Boolean(item))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * Registra mensagem recebida do lead. Idempotente por `providerMessageId`: a
 * Meta reentrega o mesmo evento em caso de timeout, e sem isso o agente
 * responderia duas vezes à mesma frase.
 *
 * Retorna `null` quando a mensagem já tinha sido processada.
 */
export async function appendInboundMessage(input: {
  phoneE164: string;
  text: string;
  providerMessageId: string;
  contactId?: string;
  contactName?: string;
  campaignId?: string;
}): Promise<MarketingConversation | null> {
  const ref = col(COLLECTIONS.marketingConversations).doc(input.phoneE164);
  const now = nowIso();

  return col(COLLECTIONS.marketingConversations).firestore.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const current = mapDoc(input.phoneE164, snapshot.data());

    if (current?.messages.some((m) => m.providerMessageId === input.providerMessageId)) {
      return null;
    }

    const message: ConversationMessage = {
      role: "lead",
      text: input.text,
      providerMessageId: input.providerMessageId,
      at: now,
    };

    const next: MarketingConversation = {
      id: input.phoneE164,
      contactId: input.contactId ?? current?.contactId ?? "",
      contactName: input.contactName ?? current?.contactName ?? "",
      phoneE164: input.phoneE164,
      campaignId: input.campaignId ?? current?.campaignId ?? "",
      messages: [...(current?.messages ?? []), message].slice(-MAX_MESSAGES),
      lastInboundAt: now,
      agentPaused: current?.agentPaused ?? false,
      suggestedReply: "",
      suggestedAt: "",
      autoSendAt: "",
      lastError: "",
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
    };

    const { id: _id, ...payload } = next;
    tx.set(ref, payload, { merge: true });
    return next;
  });
}

export async function appendAgentMessage(input: {
  phoneE164: string;
  text: string;
  providerMessageId: string;
}): Promise<void> {
  await appendOutboundMessage({ ...input, role: "agente" });
}

export async function appendOutboundMessage(input: {
  phoneE164: string;
  text: string;
  providerMessageId: string;
  role: Exclude<ConversationRole, "lead">;
  pauseAgent?: boolean;
}): Promise<void> {
  const ref = col(COLLECTIONS.marketingConversations).doc(input.phoneE164);
  const now = nowIso();

  await col(COLLECTIONS.marketingConversations).firestore.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const current = mapDoc(input.phoneE164, snapshot.data());
    const messages = [
      ...(current?.messages ?? []),
      {
        role: input.role,
        text: input.text,
        providerMessageId: input.providerMessageId,
        at: now,
      },
    ].slice(-MAX_MESSAGES);

    tx.set(
      ref,
      {
        messages,
        updatedAt: now,
        lastError: "",
        suggestedReply: "",
        suggestedAt: "",
        autoSendAt: "",
        ...(input.pauseAgent ? { agentPaused: true } : {}),
      },
      { merge: true },
    );
  });
}

export async function setConversationError(phoneE164: string, message: string): Promise<void> {
  await col(COLLECTIONS.marketingConversations)
    .doc(phoneE164)
    .set({ lastError: message, updatedAt: nowIso() }, { merge: true });
}

export async function setAgentPaused(phoneE164: string, paused: boolean): Promise<void> {
  const ref = col(COLLECTIONS.marketingConversations).doc(phoneE164);
  const now = nowIso();

  await col(COLLECTIONS.marketingConversations).firestore.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const current = mapDoc(phoneE164, snapshot.data());
    const autoSendAt =
      paused || !current?.suggestedReply.trim()
        ? ""
        : computeSuggestionAutoSendAt(false, Date.parse(now));

    tx.set(
      ref,
      {
        agentPaused: paused,
        autoSendAt,
        updatedAt: now,
      },
      { merge: true },
    );
  });
}

export async function setPendingSuggestion(
  phoneE164: string,
  input: { text: string; paused: boolean; nowMs?: number },
): Promise<{ suggestedAt: string; autoSendAt: string }> {
  const nowMs = input.nowMs ?? Date.now();
  const suggestedAt = new Date(nowMs).toISOString();
  const autoSendAt = computeSuggestionAutoSendAt(input.paused, nowMs);

  await col(COLLECTIONS.marketingConversations)
    .doc(phoneE164)
    .set(
      {
        suggestedReply: input.text,
        suggestedAt,
        autoSendAt,
        lastError: "",
        updatedAt: nowIso(),
      },
      { merge: true },
    );

  return { suggestedAt, autoSendAt };
}

/**
 * Tira a sugestão da fila de auto-envio (transação). `null` se outro processo
 * já enviou, o humano assumiu, ou o prazo ainda não venceu.
 */
export async function claimDueSuggestion(
  phoneE164: string,
  nowMs = Date.now(),
): Promise<{ text: string; suggestedAt: string; autoSendAt: string } | null> {
  const ref = col(COLLECTIONS.marketingConversations).doc(phoneE164);

  return col(COLLECTIONS.marketingConversations).firestore.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const current = mapDoc(phoneE164, snapshot.data());
    if (!current || !isSuggestionAutoSendDue(current, nowMs)) {
      return null;
    }

    const claimed = {
      text: current.suggestedReply,
      suggestedAt: current.suggestedAt,
      autoSendAt: current.autoSendAt,
    };

    tx.set(
      ref,
      {
        suggestedReply: "",
        suggestedAt: "",
        autoSendAt: "",
        updatedAt: nowIso(),
      },
      { merge: true },
    );

    return claimed;
  });
}

export async function restoreSuggestion(
  phoneE164: string,
  suggestion: { text: string; suggestedAt: string; autoSendAt: string },
): Promise<void> {
  await col(COLLECTIONS.marketingConversations)
    .doc(phoneE164)
    .set(
      {
        suggestedReply: suggestion.text,
        suggestedAt: suggestion.suggestedAt,
        autoSendAt: suggestion.autoSendAt,
        updatedAt: nowIso(),
      },
      { merge: true },
    );
}
