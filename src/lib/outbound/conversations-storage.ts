/** Threads de conversa do WhatsApp (`marketingConversations`, doc id = E.164). */

import type { DocumentData } from "firebase-admin/firestore";

import { COLLECTIONS, col } from "@/lib/firebase/collections";
import type { ConversationMessage, MarketingConversation } from "@/lib/outbound/types";

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
        role: raw.role === "agente" ? ("agente" as const) : ("lead" as const),
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
  const ref = col(COLLECTIONS.marketingConversations).doc(input.phoneE164);
  const now = nowIso();

  await col(COLLECTIONS.marketingConversations).firestore.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const current = mapDoc(input.phoneE164, snapshot.data());
    const messages = [
      ...(current?.messages ?? []),
      {
        role: "agente" as const,
        text: input.text,
        providerMessageId: input.providerMessageId,
        at: now,
      },
    ].slice(-MAX_MESSAGES);

    tx.set(ref, { messages, updatedAt: now, lastError: "" }, { merge: true });
  });
}

export async function setConversationError(phoneE164: string, message: string): Promise<void> {
  await col(COLLECTIONS.marketingConversations)
    .doc(phoneE164)
    .set({ lastError: message, updatedAt: nowIso() }, { merge: true });
}

export async function setAgentPaused(phoneE164: string, paused: boolean): Promise<void> {
  await col(COLLECTIONS.marketingConversations)
    .doc(phoneE164)
    .set({ agentPaused: paused, updatedAt: nowIso() }, { merge: true });
}
