import { randomUUID } from "node:crypto";

import type { DocumentData } from "firebase-admin/firestore";

import type {
  AsyncJobRow,
  AsyncJobStatus,
  AsyncJobType,
} from "@/lib/async-jobs-types";
import { COLLECTIONS, col } from "@/lib/firebase/collections";
import { getFirestore } from "@/lib/firebase/admin";

function nowIso() {
  return new Date().toISOString();
}

function mapRow(id: string, data: DocumentData): AsyncJobRow {
  return {
    id,
    ownerUserId: String(data.ownerUserId ?? ""),
    type: String(data.type) as AsyncJobType,
    status: String(data.status) as AsyncJobStatus,
    payload: (data.payload as Record<string, unknown>) ?? {},
    result: (data.result as Record<string, unknown>) ?? {},
    attempts: Number(data.attempts ?? 0),
    maxAttempts: Number(data.maxAttempts ?? 3),
    lastError: String(data.lastError ?? ""),
    idempotencyKey: data.idempotencyKey ? String(data.idempotencyKey) : null,
    createdAt: String(data.createdAt ?? nowIso()),
    updatedAt: String(data.updatedAt ?? nowIso()),
    startedAt: data.startedAt ? String(data.startedAt) : null,
    finishedAt: data.finishedAt ? String(data.finishedAt) : null,
  };
}

export async function createAsyncJob(input: {
  ownerUserId: string;
  type: AsyncJobType;
  payload: Record<string, unknown>;
  idempotencyKey?: string | null;
  maxAttempts?: number;
}): Promise<AsyncJobRow> {
  const idempotencyKey = input.idempotencyKey?.trim() || null;

  if (idempotencyKey) {
    const existingSnap = await col(COLLECTIONS.asyncJobs)
      .where("idempotencyKey", "==", idempotencyKey)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      const doc = existingSnap.docs[0];
      return mapRow(doc.id, doc.data());
    }
  }

  const now = nowIso();
  const id = randomUUID();
  const row: AsyncJobRow = {
    id,
    ownerUserId: input.ownerUserId,
    type: input.type,
    status: "queued",
    payload: input.payload,
    result: {},
    attempts: 0,
    maxAttempts: input.maxAttempts ?? 3,
    lastError: "",
    idempotencyKey,
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    finishedAt: null,
  };

  await col(COLLECTIONS.asyncJobs).doc(id).set(row);
  return row;
}

export async function getAsyncJob(id: string): Promise<AsyncJobRow | null> {
  const snap = await col(COLLECTIONS.asyncJobs).doc(id).get();
  if (!snap.exists) {
    return null;
  }
  return mapRow(snap.id, snap.data()!);
}

export async function countInFlightJobsForOwner(input: {
  ownerUserId: string;
  types?: AsyncJobType[];
}): Promise<number> {
  const types = input.types ?? ["seal_video", "voice_tts"];
  const snap = await col(COLLECTIONS.asyncJobs)
    .where("ownerUserId", "==", input.ownerUserId)
    .where("status", "in", ["queued", "running"])
    .get();

  return snap.docs.filter((doc) => types.includes(String(doc.data().type) as AsyncJobType)).length;
}

/** Claim atômico queued → running (Pub/Sub at-least-once). */
export async function claimAsyncJob(id: string): Promise<AsyncJobRow | null> {
  const now = nowIso();
  const db = getFirestore();

  return db.runTransaction(async (tx) => {
    const ref = col(COLLECTIONS.asyncJobs).doc(id);
    const snap = await tx.get(ref);

    if (!snap.exists) {
      return null;
    }

    const current = mapRow(snap.id, snap.data()!);

    if (current.status === "running") {
      return current;
    }

    if (current.status !== "queued") {
      return null;
    }

    const updated: AsyncJobRow = {
      ...current,
      status: "running",
      attempts: current.attempts + 1,
      startedAt: current.startedAt ?? now,
      updatedAt: now,
    };

    tx.update(ref, {
      status: updated.status,
      attempts: updated.attempts,
      startedAt: updated.startedAt,
      updatedAt: updated.updatedAt,
    });

    return updated;
  });
}

export async function completeAsyncJob(
  id: string,
  result: Record<string, unknown>,
): Promise<AsyncJobRow> {
  const now = nowIso();
  const ref = col(COLLECTIONS.asyncJobs).doc(id);
  const snap = await ref.get();

  if (!snap.exists) {
    throw new Error(`Job ${id} nao encontrado.`);
  }

  const patch = {
    status: "succeeded" as const,
    result,
    lastError: "",
    finishedAt: now,
    updatedAt: now,
  };

  await ref.update(patch);
  return mapRow(snap.id, { ...snap.data()!, ...patch });
}

export async function failAsyncJob(
  id: string,
  errorMessage: string,
): Promise<AsyncJobRow> {
  const now = nowIso();
  const current = await getAsyncJob(id);

  if (!current) {
    throw new Error(`Job ${id} nao encontrado.`);
  }

  const dead = current.attempts >= current.maxAttempts;
  const status: AsyncJobStatus = dead ? "dead" : "failed";
  const patch = {
    status,
    lastError: errorMessage.slice(0, 2000),
    finishedAt: now,
    updatedAt: now,
  };

  await col(COLLECTIONS.asyncJobs).doc(id).update(patch);
  return { ...current, ...patch };
}

/** Requeue para retry manual / Pub/Sub retry. */
export async function requeueAsyncJob(id: string): Promise<AsyncJobRow> {
  const now = nowIso();
  const ref = col(COLLECTIONS.asyncJobs).doc(id);
  const snap = await ref.get();

  if (!snap.exists) {
    throw new Error(`Job ${id} nao encontrado.`);
  }

  const patch = {
    status: "queued" as const,
    updatedAt: now,
    finishedAt: null,
  };

  await ref.update(patch);
  return mapRow(snap.id, { ...snap.data()!, ...patch });
}
