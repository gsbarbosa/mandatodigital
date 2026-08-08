/**
 * Semáforo global para IVC ElevenLabs (conta única da plataforma).
 * Limita clones em paralelo para não estourar a cota de custom voices.
 */

import { randomUUID } from "node:crypto";

import { getFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS, col } from "@/lib/firebase/collections";

const LOCK_DOC_ID = "lock:elevenlabs-ivc";
const DEFAULT_MAX_CONCURRENT = 1;
const DEFAULT_LEASE_MS = 3 * 60 * 1000;
const DEFAULT_WAIT_MS = 2 * 60 * 1000;
const DEFAULT_POLL_MS = 1500;

type IvcLockDoc = {
  holders?: string[];
  expiresAtByHolder?: Record<string, number>;
  updatedAt?: string;
};

function lockRef() {
  return col(COLLECTIONS.guestCredits).doc(LOCK_DOC_ID);
}

function maxConcurrent() {
  const raw = Number(process.env.ELEVENLABS_IVC_MAX_CONCURRENT ?? DEFAULT_MAX_CONCURRENT);
  if (!Number.isFinite(raw) || raw < 1) {
    return DEFAULT_MAX_CONCURRENT;
  }
  return Math.min(Math.floor(raw), 5);
}

function pruneExpired(
  doc: IvcLockDoc,
  now: number,
): { holders: string[]; expiresAtByHolder: Record<string, number> } {
  const expiresAtByHolder = { ...(doc.expiresAtByHolder ?? {}) };
  const holders = (doc.holders ?? []).filter((id) => {
    const exp = Number(expiresAtByHolder[id] ?? 0);
    if (exp > now) {
      return true;
    }
    delete expiresAtByHolder[id];
    return false;
  });
  return { holders, expiresAtByHolder };
}

async function tryAcquire(holderId: string, leaseMs: number, now: number) {
  const db = getFirestore();
  const ref = lockRef();
  const max = maxConcurrent();

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = (snap.data() ?? {}) as IvcLockDoc;
    const { holders, expiresAtByHolder } = pruneExpired(current, now);

    if (holders.includes(holderId)) {
      expiresAtByHolder[holderId] = now + leaseMs;
      tx.set(
        ref,
        {
          holders,
          expiresAtByHolder,
          updatedAt: new Date(now).toISOString(),
        },
        { merge: true },
      );
      return true;
    }

    if (holders.length >= max) {
      tx.set(
        ref,
        { holders, expiresAtByHolder, updatedAt: new Date(now).toISOString() },
        { merge: true },
      );
      return false;
    }

    holders.push(holderId);
    expiresAtByHolder[holderId] = now + leaseMs;
    tx.set(
      ref,
      {
        holders,
        expiresAtByHolder,
        updatedAt: new Date(now).toISOString(),
      },
      { merge: true },
    );
    return true;
  });
}

async function releaseHolder(holderId: string) {
  const db = getFirestore();
  const ref = lockRef();
  const now = Date.now();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      return;
    }
    const current = (snap.data() ?? {}) as IvcLockDoc;
    const { holders, expiresAtByHolder } = pruneExpired(current, now);
    const nextHolders = holders.filter((id) => id !== holderId);
    delete expiresAtByHolder[holderId];
    tx.set(
      ref,
      {
        holders: nextHolders,
        expiresAtByHolder,
        updatedAt: new Date(now).toISOString(),
      },
      { merge: true },
    );
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executa `fn` com slot IVC adquirido. Libera no finally.
 * Se não conseguir o slot até o timeout, lança erro (job pode requeue).
 */
export async function withElevenLabsIvcSlot<T>(
  fn: () => Promise<T>,
  options?: {
    waitMs?: number;
    pollMs?: number;
    leaseMs?: number;
  },
): Promise<T> {
  const waitMs = options?.waitMs ?? DEFAULT_WAIT_MS;
  const pollMs = options?.pollMs ?? DEFAULT_POLL_MS;
  const leaseMs = options?.leaseMs ?? DEFAULT_LEASE_MS;
  const holderId = randomUUID();
  const deadline = Date.now() + waitMs;
  const { appLog, appLogError, startTimer } = await import("@/lib/observability/log");
  const elapsed = startTimer();

  let acquired = false;
  while (Date.now() <= deadline) {
    acquired = await tryAcquire(holderId, leaseMs, Date.now());
    if (acquired) {
      break;
    }
    await sleep(pollMs);
  }

  if (!acquired) {
    appLog(
      "voice",
      "elevenlabs_ivc_lock_timeout",
      { waitMs, maxConcurrent: maxConcurrent(), durationMs: elapsed() },
      "warn",
    );
    throw new Error(
      "Fila de voz ocupada (limite de clones ElevenLabs). Tente novamente em instantes.",
    );
  }

  appLog("voice", "elevenlabs_ivc_lock_acquired", {
    maxConcurrent: maxConcurrent(),
    waitMs: elapsed(),
  });

  try {
    return await fn();
  } finally {
    try {
      await releaseHolder(holderId);
      appLog("voice", "elevenlabs_ivc_lock_released", {
        durationMs: elapsed(),
      });
    } catch (error) {
      appLogError("voice", "elevenlabs_ivc_lock_release_failed", error);
    }
  }
}
