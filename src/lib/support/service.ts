import { getSessionUser } from "@/lib/auth/session";
import { recordAuditEventFireAndForget } from "@/lib/audit/record";
import { getStorageOwnerUserId } from "@/lib/storage-context";
import { learnFromClosedThread, saveLearningItems } from "@/lib/support/learning";
import { runSupportN1 } from "@/lib/support/n1-agent";
import {
  appendSupportMessage,
  findLatestSupportThread,
  findOpenSupportThread,
  getOrCreateOpenSupportThread,
  getSupportThread,
  getSupportThreadWithMessages,
  listSupportMessages,
  updateSupportThreadStatus,
} from "@/lib/support/storage";
import type {
  SupportEscalationReason,
  SupportThreadWithMessages,
} from "@/lib/support/types";

const SUPPORT_AUTHOR_LABEL = "Suporte";

function requireOwnerUserId() {
  const ownerUserId = getStorageOwnerUserId()?.trim() || "";
  if (!ownerUserId) {
    throw new Error("Sessão sem dono de armazenamento.");
  }
  return ownerUserId;
}

async function requireUserEmail() {
  const session = await getSessionUser();
  return session?.email?.trim() || "";
}

export async function loadUserSupportThread(): Promise<SupportThreadWithMessages | null> {
  const ownerUserId = requireOwnerUserId();
  const open = await findOpenSupportThread(ownerUserId);
  const latest = open ?? (await findLatestSupportThread(ownerUserId));
  if (!latest) {
    return null;
  }
  const messages = await listSupportMessages(latest.id);
  return { ...latest, messages };
}

export async function loadOrCreateUserSupportThread(): Promise<SupportThreadWithMessages> {
  const ownerUserId = requireOwnerUserId();
  const userEmail = await requireUserEmail();
  return getOrCreateOpenSupportThread({ ownerUserId, userEmail });
}

export async function sendUserSupportMessage(
  body: string,
): Promise<SupportThreadWithMessages> {
  const trimmed = body.trim();
  if (!trimmed) {
    throw new Error("Mensagem vazia.");
  }
  if (trimmed.length > 4000) {
    throw new Error("Mensagem muito longa (máx. 4000 caracteres).");
  }

  const ownerUserId = requireOwnerUserId();
  const open = await findOpenSupportThread(ownerUserId);
  const thread = open
    ? { ...(await getSupportThreadWithMessages(open.id))! }
    : await loadOrCreateUserSupportThread();

  await appendSupportMessage({
    threadId: thread.id,
    role: "user",
    body: trimmed,
    authorLabel: "Você",
  });

  const needsHuman =
    thread.status === "waiting_human" || thread.status === "human";

  if (needsHuman) {
    return (await getSupportThreadWithMessages(thread.id))!;
  }

  const history = await listSupportMessages(thread.id);
  const n1 = await runSupportN1({
    history: history.slice(0, -1),
    latestUserMessage: trimmed,
  });

  await appendSupportMessage({
    threadId: thread.id,
    role: "assistant",
    body: n1.reply,
    authorLabel: SUPPORT_AUTHOR_LABEL,
  });

  if (n1.shouldEscalate) {
    await escalateSupportThread({
      threadId: thread.id,
      reason: "ai",
      summary: n1.escalateReason || n1.reply.slice(0, 280),
    });
  } else {
    // Loop de aprendizado: cada resolução sem escalação alimenta o RAG
    void saveLearningItems([
      {
        question: trimmed,
        answer: n1.reply,
        source: "ai",
        threadId: thread.id,
      },
    ]).catch((error) => {
      console.error("[support] falha ao salvar aprendizado N1", error);
    });
  }

  return (await getSupportThreadWithMessages(thread.id))!;
}

export async function escalateSupportThread(input: {
  threadId: string;
  reason: SupportEscalationReason;
  summary?: string;
}): Promise<SupportThreadWithMessages> {
  const thread = await getSupportThread(input.threadId);
  if (!thread) {
    throw new Error("Atendimento não encontrado.");
  }

  if (thread.status === "closed") {
    throw new Error("Este atendimento já foi encerrado.");
  }

  if (thread.status === "waiting_human" || thread.status === "human") {
    return (await getSupportThreadWithMessages(thread.id))!;
  }

  const summary =
    input.summary?.trim() ||
    (input.reason === "user"
      ? "Usuário indicou que não conseguiu resolver o problema."
      : "Caso encaminhado para aprofundamento.");

  await updateSupportThreadStatus({
    threadId: thread.id,
    status: "waiting_human",
    escalationReason: input.reason,
    escalationSummary: summary,
  });

  await appendSupportMessage({
    threadId: thread.id,
    role: "system",
    body: "Vamos aprofundar seu caso por aqui. Em breve seguimos com a melhor orientação.",
    authorLabel: "Sistema",
  });

  recordAuditEventFireAndForget({
    ownerUserId: thread.ownerUserId,
    action: "support_escalated",
    payload: {
      threadId: thread.id,
      reason: input.reason,
      summary: summary.slice(0, 280),
    },
  });

  return (await getSupportThreadWithMessages(thread.id))!;
}

export async function escalateCurrentUserThread(): Promise<SupportThreadWithMessages> {
  const ownerUserId = requireOwnerUserId();
  const open = await findOpenSupportThread(ownerUserId);
  if (!open) {
    throw new Error("Nenhum atendimento aberto para encaminhar.");
  }
  const thread = (await getSupportThreadWithMessages(open.id))!;
  const hasAssistantExchange = thread.messages.some(
    (message) => message.role === "assistant",
  );
  if (!hasAssistantExchange) {
    throw new Error(
      "Envie uma dúvida ao suporte antes de pedir para aprofundar o caso.",
    );
  }
  return escalateSupportThread({
    threadId: thread.id,
    reason: "user",
  });
}

export async function adminReplyToSupportThread(input: {
  threadId: string;
  body: string;
}): Promise<SupportThreadWithMessages> {
  const trimmed = input.body.trim();
  if (!trimmed) {
    throw new Error("Mensagem vazia.");
  }

  const thread = await getSupportThread(input.threadId);
  if (!thread) {
    throw new Error("Atendimento não encontrado.");
  }
  if (thread.status === "closed") {
    throw new Error("Este atendimento já foi encerrado.");
  }

  await appendSupportMessage({
    threadId: thread.id,
    role: "human",
    body: trimmed,
    authorLabel: SUPPORT_AUTHOR_LABEL,
  });

  if (thread.status !== "human") {
    await updateSupportThreadStatus({
      threadId: thread.id,
      status: "human",
    });
  }

  return (await getSupportThreadWithMessages(thread.id))!;
}

export async function adminCloseSupportThread(
  threadId: string,
): Promise<SupportThreadWithMessages> {
  const thread = await getSupportThread(threadId);
  if (!thread) {
    throw new Error("Atendimento não encontrado.");
  }
  if (thread.status === "closed") {
    return (await getSupportThreadWithMessages(threadId))!;
  }

  await appendSupportMessage({
    threadId,
    role: "system",
    body: "Atendimento encerrado. Se precisar de novo, é só abrir o suporte.",
    authorLabel: "Sistema",
  });

  await updateSupportThreadStatus({
    threadId,
    status: "closed",
  });

  const closed = (await getSupportThreadWithMessages(threadId))!;

  recordAuditEventFireAndForget({
    ownerUserId: closed.ownerUserId,
    action: "support_closed",
    payload: { threadId },
  });

  // Aprendizado contínuo: respostas humanas (ouro) ou só-IA viram casos RAG
  void learnFromClosedThread({
    threadId,
    messages: closed.messages,
  }).catch((error) => {
    console.error("[support] falha ao aprender do thread", threadId, error);
  });

  return closed;
}
