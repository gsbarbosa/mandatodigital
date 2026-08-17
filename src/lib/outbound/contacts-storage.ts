/**
 * Leitura/escrita da base de prospects do outbound (`marketingContacts`).
 *
 * Dado público (dirigentes partidários do TSE + parlamentares em exercício),
 * mas as rules negam o client — só Admin SDK lê. Escrita vem do seed
 * (scripts/seed-marketing-contacts.ts), não do painel.
 */

import type { DocumentData } from "firebase-admin/firestore";

import { COLLECTIONS, col } from "@/lib/firebase/collections";
import { isContactSource, type ContactGender, type ContactSource, type MarketingContact } from "@/lib/outbound/types";

const UPSERT_BATCH_SIZE = 450; // Firestore aceita 500 writes por batch.

function nowIso() {
  return new Date().toISOString();
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

function mapDoc(id: string, data: DocumentData | undefined): MarketingContact | null {
  if (!data) {
    return null;
  }

  const source: ContactSource = isContactSource(data.source) ? data.source : "diretorio_partidario";

  return {
    id,
    name: String(data.name ?? "").trim(),
    email: String(data.email ?? "").trim().toLowerCase(),
    phoneE164: String(data.phoneE164 ?? "").trim(),
    source,
    uf: String(data.uf ?? "").trim().toUpperCase(),
    parties: stringArray(data.parties),
    roles: stringArray(data.roles),
    municipality: String(data.municipality ?? "").trim(),
    isCandidate2026: Boolean(data.isCandidate2026),
    candidateRole: String(data.candidateRole ?? "").trim(),
    gender: data.gender === "F" || data.gender === "M" ? (data.gender as ContactGender) : "",
    suspended: Boolean(data.suspended),
    origin: String(data.origin ?? "").trim(),
    createdAt: String(data.createdAt ?? nowIso()),
    updatedAt: String(data.updatedAt ?? nowIso()),
  };
}

/**
 * Carrega a base inteira. O filtro de segmento roda em memória — ver
 * segment-filter.ts para o porquê e o limite dessa escolha.
 */
export async function listMarketingContacts(): Promise<MarketingContact[]> {
  const snapshot = await col(COLLECTIONS.marketingContacts).get();
  return snapshot.docs
    .map((doc) => mapDoc(doc.id, doc.data()))
    .filter((contact): contact is MarketingContact => Boolean(contact))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export type MarketingContactStats = {
  total: number;
  withEmail: number;
  withWhatsapp: number;
  candidates2026: number;
  suspended: number;
  bySource: Record<string, number>;
  byUf: Record<string, number>;
  parties: string[];
};

export function summarizeContacts(contacts: MarketingContact[]): MarketingContactStats {
  const bySource: Record<string, number> = {};
  const byUf: Record<string, number> = {};
  const parties = new Set<string>();

  let withEmail = 0;
  let withWhatsapp = 0;
  let candidates2026 = 0;
  let suspended = 0;

  for (const contact of contacts) {
    if (contact.email) withEmail += 1;
    if (contact.phoneE164) withWhatsapp += 1;
    if (contact.isCandidate2026) candidates2026 += 1;
    if (contact.suspended) suspended += 1;

    bySource[contact.source] = (bySource[contact.source] ?? 0) + 1;
    if (contact.uf) {
      byUf[contact.uf] = (byUf[contact.uf] ?? 0) + 1;
    }
    for (const party of contact.parties) {
      parties.add(party);
    }
  }

  return {
    total: contacts.length,
    withEmail,
    withWhatsapp,
    candidates2026,
    suspended,
    bySource,
    byUf,
    parties: [...parties].sort((a, b) => a.localeCompare(b, "pt-BR")),
  };
}

export type MarketingContactSeed = Omit<MarketingContact, "createdAt" | "updatedAt">;

/**
 * Upsert idempotente do seed: reimportar a mesma fonte atualiza os campos sem
 * duplicar. `createdAt` só é gravado em doc novo — com `merge: true` qualquer
 * campo enviado sobrescreve, então a data de criação precisa ficar de fora do
 * payload de quem já existe.
 */
export async function upsertMarketingContacts(
  contacts: MarketingContactSeed[],
): Promise<{ created: number; updated: number }> {
  const collection = col(COLLECTIONS.marketingContacts);
  const now = nowIso();

  const existingSnapshot = await collection.select().get();
  const existingIds = new Set(existingSnapshot.docs.map((doc) => doc.id));

  let created = 0;
  let updated = 0;

  for (let index = 0; index < contacts.length; index += UPSERT_BATCH_SIZE) {
    const chunk = contacts.slice(index, index + UPSERT_BATCH_SIZE);
    const batch = collection.firestore.batch();

    for (const contact of chunk) {
      const { id, ...rest } = contact;
      const isNew = !existingIds.has(id);
      batch.set(
        collection.doc(id),
        isNew ? { ...rest, createdAt: now, updatedAt: now } : { ...rest, updatedAt: now },
        { merge: true },
      );
      if (isNew) {
        created += 1;
      } else {
        updated += 1;
      }
    }

    await batch.commit();
  }

  return { created, updated };
}
