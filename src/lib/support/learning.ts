import { randomUUID } from "node:crypto";

import type { DocumentData } from "firebase-admin/firestore";

import { COLLECTIONS, col } from "@/lib/firebase/collections";
import { cosineSimilarity, embedText } from "@/lib/support/embeddings";
import type { SupportMessage } from "@/lib/support/types";

export type SupportLearningSource = "ai" | "human";

export type SupportLearningItem = {
  id: string;
  question: string;
  answer: string;
  source: SupportLearningSource;
  threadId: string;
  embedding: number[];
  createdAt: string;
  hitCount: number;
};

function nowIso() {
  return new Date().toISOString();
}

function mapItem(id: string, data: DocumentData): SupportLearningItem {
  return {
    id,
    question: String(data.question ?? ""),
    answer: String(data.answer ?? ""),
    source: (String(data.source ?? "ai") as SupportLearningSource) || "ai",
    threadId: String(data.threadId ?? ""),
    embedding: Array.isArray(data.embedding)
      ? (data.embedding as number[])
      : [],
    createdAt: String(data.createdAt ?? nowIso()),
    hitCount: Number(data.hitCount ?? 0),
  };
}

/**
 * Extrai pares pergunta→resposta de um transcript fechado.
 * Prefere respostas humanas (ouro); se não houver, usa só-IA.
 */
export function extractLearningPairs(input: {
  threadId: string;
  messages: SupportMessage[];
  hadHumanReply: boolean;
}): Array<{ question: string; answer: string; source: SupportLearningSource }> {
  const pairs: Array<{
    question: string;
    answer: string;
    source: SupportLearningSource;
  }> = [];

  const preferredRole = input.hadHumanReply ? "human" : "assistant";

  for (let i = 0; i < input.messages.length; i += 1) {
    const message = input.messages[i];
    if (message.role !== "user") {
      continue;
    }

    const question = message.body.trim();
    if (question.length < 8) {
      continue;
    }

    let answer: string | null = null;
    for (let j = i + 1; j < input.messages.length; j += 1) {
      const next = input.messages[j];
      if (next.role === "user") {
        break;
      }
      if (next.role === preferredRole) {
        answer = next.body.trim();
      }
    }

    if (!answer || answer.length < 12) {
      continue;
    }

    pairs.push({
      question,
      answer,
      source: preferredRole === "human" ? "human" : "ai",
    });
  }

  // Evita duplicar a mesma pergunta no mesmo thread
  const seen = new Set<string>();
  return pairs.filter((pair) => {
    const key = pair.question.toLowerCase().slice(0, 160);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export async function saveLearningItems(
  items: Array<{
    question: string;
    answer: string;
    source: SupportLearningSource;
    threadId: string;
  }>,
): Promise<number> {
  let saved = 0;

  for (const item of items) {
    const embedding = await embedText(`${item.question}\n${item.answer}`);
    if (!embedding) {
      continue;
    }

    const id = randomUUID();
    const row: SupportLearningItem = {
      id,
      question: item.question.slice(0, 2000),
      answer: item.answer.slice(0, 4000),
      source: item.source,
      threadId: item.threadId,
      embedding,
      createdAt: nowIso(),
      hitCount: 0,
    };

    await col(COLLECTIONS.supportLearningItems).doc(id).set(row);
    saved += 1;
  }

  return saved;
}

export async function learnFromClosedThread(input: {
  threadId: string;
  messages: SupportMessage[];
}): Promise<number> {
  const hadHumanReply = input.messages.some((m) => m.role === "human");
  const pairs = extractLearningPairs({
    threadId: input.threadId,
    messages: input.messages,
    hadHumanReply,
  });

  if (pairs.length === 0) {
    return 0;
  }

  // Limita por thread para não explodir custo de embeddings
  return saveLearningItems(
    pairs.slice(0, 6).map((pair) => ({
      ...pair,
      threadId: input.threadId,
    })),
  );
}

async function listLearningCandidates(limit = 200): Promise<SupportLearningItem[]> {
  const snap = await col(COLLECTIONS.supportLearningItems).limit(limit).get();
  return snap.docs
    .map((doc) => mapItem(doc.id, doc.data()))
    .filter((item) => item.embedding.length > 0 && item.question && item.answer);
}

export async function retrieveSimilarLearningCases(input: {
  question: string;
  topK?: number;
  minScore?: number;
}): Promise<
  Array<{ question: string; answer: string; source: SupportLearningSource; score: number }>
> {
  const queryEmbedding = await embedText(input.question);
  if (!queryEmbedding) {
    return [];
  }

  const candidates = await listLearningCandidates(200);
  if (candidates.length === 0) {
    return [];
  }

  const minScore = input.minScore ?? 0.72;
  const topK = input.topK ?? 4;

  const ranked = candidates
    .map((item) => {
      const raw = cosineSimilarity(queryEmbedding, item.embedding);
      // Respostas humanas (ouro) ganham leve prioridade no ranking
      const score = raw + (item.source === "human" ? 0.03 : 0);
      return {
        question: item.question,
        answer: item.answer,
        source: item.source,
        score,
        raw,
        id: item.id,
      };
    })
    .filter((item) => item.raw >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  // bump hitCount de forma best-effort (não bloqueia atendimento)
  void Promise.all(
    ranked.map(async (item) => {
      try {
        const ref = col(COLLECTIONS.supportLearningItems).doc(item.id);
        const snap = await ref.get();
        if (!snap.exists) {
          return;
        }
        await ref.update({ hitCount: Number(snap.data()?.hitCount ?? 0) + 1 });
      } catch {
        /* ignore */
      }
    }),
  );

  return ranked.map(({ question, answer, source, score }) => ({
    question,
    answer,
    source,
    score,
  }));
}

export function formatLearningCasesForPrompt(
  cases: Array<{ question: string; answer: string; source: SupportLearningSource }>,
): string {
  if (cases.length === 0) {
    return "";
  }

  return cases
    .map(
      (item, index) =>
        `${index + 1}. Pergunta: ${item.question}\n   Resposta útil: ${item.answer}`,
    )
    .join("\n\n");
}
