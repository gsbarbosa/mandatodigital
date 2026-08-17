/** CRUD dos segmentos de público salvos (`marketingSegments`). */

import type { DocumentData } from "firebase-admin/firestore";

import { COLLECTIONS, col } from "@/lib/firebase/collections";
import { coerceSegmentFilter } from "@/lib/outbound/segment-filter";
import type { MarketingSegment, SegmentFilter } from "@/lib/outbound/types";

function nowIso() {
  return new Date().toISOString();
}

function mapDoc(id: string, data: DocumentData | undefined): MarketingSegment | null {
  if (!data) {
    return null;
  }
  return {
    id,
    name: String(data.name ?? "").trim() || "Sem nome",
    description: String(data.description ?? ""),
    filter: coerceSegmentFilter(data.filter),
    createdAt: String(data.createdAt ?? nowIso()),
    updatedAt: String(data.updatedAt ?? nowIso()),
  };
}

export async function listMarketingSegments(): Promise<MarketingSegment[]> {
  const snapshot = await col(COLLECTIONS.marketingSegments).get();
  return snapshot.docs
    .map((doc) => mapDoc(doc.id, doc.data()))
    .filter((segment): segment is MarketingSegment => Boolean(segment))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getMarketingSegment(id: string): Promise<MarketingSegment | null> {
  const snapshot = await col(COLLECTIONS.marketingSegments).doc(id).get();
  return mapDoc(snapshot.id, snapshot.data());
}

export async function createMarketingSegment(input: {
  name: string;
  description?: string;
  filter: SegmentFilter;
}): Promise<MarketingSegment> {
  const name = input.name.trim();
  if (!name) {
    throw new Error("Nome do segmento é obrigatório.");
  }

  const now = nowIso();
  const ref = col(COLLECTIONS.marketingSegments).doc();
  const segment: MarketingSegment = {
    id: ref.id,
    name,
    description: (input.description ?? "").trim(),
    filter: coerceSegmentFilter(input.filter),
    createdAt: now,
    updatedAt: now,
  };

  await ref.set({
    name: segment.name,
    description: segment.description,
    filter: segment.filter,
    createdAt: segment.createdAt,
    updatedAt: segment.updatedAt,
  });

  return segment;
}

export async function updateMarketingSegment(
  id: string,
  patch: { name?: string; description?: string; filter?: SegmentFilter },
): Promise<MarketingSegment> {
  const ref = col(COLLECTIONS.marketingSegments).doc(id);
  const snapshot = await ref.get();
  const current = mapDoc(id, snapshot.data());
  if (!snapshot.exists || !current) {
    throw new Error("Segmento não encontrado.");
  }

  const next: MarketingSegment = {
    ...current,
    name: patch.name !== undefined ? patch.name.trim() || current.name : current.name,
    description: patch.description !== undefined ? patch.description.trim() : current.description,
    filter: patch.filter !== undefined ? coerceSegmentFilter(patch.filter) : current.filter,
    updatedAt: nowIso(),
  };

  await ref.set(
    {
      name: next.name,
      description: next.description,
      filter: next.filter,
      updatedAt: next.updatedAt,
    },
    { merge: true },
  );

  return next;
}

export async function deleteMarketingSegment(id: string): Promise<void> {
  const ref = col(COLLECTIONS.marketingSegments).doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    throw new Error("Segmento não encontrado.");
  }
  await ref.delete();
}
