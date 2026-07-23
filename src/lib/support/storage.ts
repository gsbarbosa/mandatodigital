import { randomUUID } from "node:crypto";

import type { DocumentData } from "firebase-admin/firestore";

import { COLLECTIONS, col } from "@/lib/firebase/collections";
import {
  HUMAN_QUEUE_STATUSES,
  OPEN_SUPPORT_STATUSES,
  type SupportEscalationReason,
  type SupportMessage,
  type SupportMessageRole,
  type SupportThread,
  type SupportThreadStatus,
  type SupportThreadWithMessages,
} from "@/lib/support/types";

function nowIso() {
  return new Date().toISOString();
}

function previewOf(body: string) {
  const trimmed = body.trim().replace(/\s+/g, " ");
  return trimmed.length > 140 ? `${trimmed.slice(0, 137)}…` : trimmed;
}

function mapThread(id: string, data: DocumentData): SupportThread {
  return {
    id,
    ownerUserId: String(data.ownerUserId ?? ""),
    userEmail: String(data.userEmail ?? ""),
    status: String(data.status ?? "ai") as SupportThreadStatus,
    escalationReason: data.escalationReason
      ? (String(data.escalationReason) as SupportEscalationReason)
      : null,
    escalationSummary: String(data.escalationSummary ?? ""),
    createdAt: String(data.createdAt ?? nowIso()),
    updatedAt: String(data.updatedAt ?? nowIso()),
    lastMessageAt: String(data.lastMessageAt ?? data.createdAt ?? nowIso()),
    lastMessagePreview: String(data.lastMessagePreview ?? ""),
  };
}

function mapMessage(id: string, data: DocumentData): SupportMessage {
  return {
    id,
    role: String(data.role ?? "user") as SupportMessageRole,
    body: String(data.body ?? ""),
    createdAt: String(data.createdAt ?? nowIso()),
    authorLabel: String(data.authorLabel ?? ""),
  };
}

function messagesCol(threadId: string) {
  return col(COLLECTIONS.supportThreads).doc(threadId).collection("messages");
}

export async function getSupportThread(
  threadId: string,
): Promise<SupportThread | null> {
  const snap = await col(COLLECTIONS.supportThreads).doc(threadId).get();
  if (!snap.exists) {
    return null;
  }
  return mapThread(snap.id, snap.data()!);
}

export async function listSupportMessages(
  threadId: string,
): Promise<SupportMessage[]> {
  const snap = await messagesCol(threadId).orderBy("createdAt", "asc").get();
  return snap.docs.map((doc) => mapMessage(doc.id, doc.data()));
}

export async function getSupportThreadWithMessages(
  threadId: string,
): Promise<SupportThreadWithMessages | null> {
  const thread = await getSupportThread(threadId);
  if (!thread) {
    return null;
  }
  const messages = await listSupportMessages(threadId);
  return { ...thread, messages };
}

export async function findOpenSupportThread(
  ownerUserId: string,
): Promise<SupportThread | null> {
  const snap = await col(COLLECTIONS.supportThreads)
    .where("ownerUserId", "==", ownerUserId)
    .limit(50)
    .get();

  if (snap.empty) {
    return null;
  }

  const threads = snap.docs
    .map((doc) => mapThread(doc.id, doc.data()))
    .filter((thread) => OPEN_SUPPORT_STATUSES.includes(thread.status));
  threads.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return threads[0] ?? null;
}

export async function findLatestSupportThread(
  ownerUserId: string,
): Promise<SupportThread | null> {
  const snap = await col(COLLECTIONS.supportThreads)
    .where("ownerUserId", "==", ownerUserId)
    .limit(50)
    .get();

  if (snap.empty) {
    return null;
  }

  const threads = snap.docs.map((doc) => mapThread(doc.id, doc.data()));
  threads.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return threads[0] ?? null;
}

export async function createSupportThread(input: {
  ownerUserId: string;
  userEmail: string;
}): Promise<SupportThread> {
  const now = nowIso();
  const id = randomUUID();
  const thread: SupportThread = {
    id,
    ownerUserId: input.ownerUserId,
    userEmail: input.userEmail,
    status: "ai",
    escalationReason: null,
    escalationSummary: "",
    createdAt: now,
    updatedAt: now,
    lastMessageAt: now,
    lastMessagePreview: "",
  };

  await col(COLLECTIONS.supportThreads).doc(id).set(thread);
  return thread;
}

export async function getOrCreateOpenSupportThread(input: {
  ownerUserId: string;
  userEmail: string;
}): Promise<SupportThreadWithMessages> {
  const existing = await findOpenSupportThread(input.ownerUserId);
  if (existing) {
    const messages = await listSupportMessages(existing.id);
    return { ...existing, messages };
  }

  const created = await createSupportThread(input);
  return { ...created, messages: [] };
}

export async function appendSupportMessage(input: {
  threadId: string;
  role: SupportMessageRole;
  body: string;
  authorLabel: string;
}): Promise<SupportMessage> {
  const now = nowIso();
  const id = randomUUID();
  const message: SupportMessage = {
    id,
    role: input.role,
    body: input.body.trim(),
    createdAt: now,
    authorLabel: input.authorLabel,
  };

  const threadRef = col(COLLECTIONS.supportThreads).doc(input.threadId);
  await messagesCol(input.threadId).doc(id).set(message);
  await threadRef.update({
    updatedAt: now,
    lastMessageAt: now,
    lastMessagePreview: previewOf(message.body),
  });

  return message;
}

export async function updateSupportThreadStatus(input: {
  threadId: string;
  status: SupportThreadStatus;
  escalationReason?: SupportEscalationReason | null;
  escalationSummary?: string;
}): Promise<SupportThread> {
  const now = nowIso();
  const ref = col(COLLECTIONS.supportThreads).doc(input.threadId);
  const patch: Record<string, unknown> = {
    status: input.status,
    updatedAt: now,
  };

  if (input.escalationReason !== undefined) {
    patch.escalationReason = input.escalationReason;
  }
  if (input.escalationSummary !== undefined) {
    patch.escalationSummary = input.escalationSummary;
  }

  await ref.update(patch);
  const snap = await ref.get();
  return mapThread(snap.id, snap.data()!);
}

export async function listAdminSupportThreads(
  limit = 100,
): Promise<SupportThread[]> {
  const snap = await col(COLLECTIONS.supportThreads).limit(300).get();

  const threads = snap.docs
    .map((doc) => mapThread(doc.id, doc.data()))
    .filter((thread) => HUMAN_QUEUE_STATUSES.includes(thread.status));

  threads.sort((a, b) => {
    const rank = (status: SupportThreadStatus) =>
      status === "waiting_human" ? 0 : 1;
    const byStatus = rank(a.status) - rank(b.status);
    if (byStatus !== 0) {
      return byStatus;
    }
    return b.lastMessageAt.localeCompare(a.lastMessageAt);
  });
  return threads.slice(0, limit);
}
