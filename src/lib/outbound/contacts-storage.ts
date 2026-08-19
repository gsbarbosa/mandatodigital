/**
 * Base de contatos do outbound (`marketingContacts`).
 *
 * Só entra quem já foi disparado (ou pediu opt-out). A lista de trabalho
 * continua no CSV até o envio. Doc: docs/marketing-outbound.md
 */

import type { DocumentData } from "firebase-admin/firestore";

import { COLLECTIONS, col } from "@/lib/firebase/collections";
import {
  contactIdFromPhone,
  EMPTY_DISPATCH_META,
  isContactSource,
  isRelevanceTier,
  isSendStatus,
  type ContactGender,
  type ContactSource,
  type MarketingContact,
  type SendStatus,
} from "@/lib/outbound/types";

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
    isReelection: Boolean(data.isReelection),
    instagramFollowers: Number.isFinite(Number(data.instagramFollowers))
      ? Math.max(0, Math.round(Number(data.instagramFollowers)))
      : 0,
    relevanceScore: Number.isFinite(Number(data.relevanceScore))
      ? Math.max(0, Math.min(99, Math.round(Number(data.relevanceScore))))
      : 0,
    relevanceTier: isRelevanceTier(data.relevanceTier) ? data.relevanceTier : "padrao",
    suspended: Boolean(data.suspended),
    origin: String(data.origin ?? "").trim(),
    instagram: String(data.instagram ?? "").replace(/^@/, "").trim(),
    optOut: Boolean(data.optOut),
    optOutAt: String(data.optOutAt ?? ""),
    lastTemplate: String(data.lastTemplate ?? ""),
    lastSentAt: String(data.lastSentAt ?? ""),
    lastStatus: isSendStatus(data.lastStatus) ? data.lastStatus : "",
    lastProviderMessageId: String(data.lastProviderMessageId ?? ""),
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
  optOut: number;
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
  let optOut = 0;

  for (const contact of contacts) {
    if (contact.email) withEmail += 1;
    if (contact.phoneE164) withWhatsapp += 1;
    if (contact.isCandidate2026) candidates2026 += 1;
    if (contact.suspended) suspended += 1;
    if (contact.optOut) optOut += 1;

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
    optOut,
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

export async function getContactByPhone(phoneE164: string): Promise<MarketingContact | null> {
  const id = contactIdFromPhone(phoneE164);
  if (id) {
    const byId = await col(COLLECTIONS.marketingContacts).doc(id).get();
    const mapped = mapDoc(byId.id, byId.data());
    if (mapped) {
      return mapped;
    }
  }

  const snapshot = await col(COLLECTIONS.marketingContacts)
    .where("phoneE164", "==", phoneE164)
    .limit(1)
    .get();
  const doc = snapshot.docs[0];
  return doc ? mapDoc(doc.id, doc.data()) : null;
}

/**
 * Grava (ou atualiza) o contato no disparo. Não reabre opt-out. Campos de
 * perfil só entram na criação — follow-up não apaga o que já estava.
 */
export async function recordDispatchContact(input: {
  contact: MarketingContact;
  templateName: string;
  status: SendStatus;
  providerMessageId: string;
}): Promise<void> {
  const id = input.contact.id || contactIdFromPhone(input.contact.phoneE164);
  if (!id) {
    throw new Error("Contato sem telefone — não grava disparo.");
  }

  const ref = col(COLLECTIONS.marketingContacts).doc(id);
  const now = nowIso();

  await ref.firestore.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const current = mapDoc(id, snapshot.data());
    const { id: _id, createdAt: _created, updatedAt: _updated, ...profile } = input.contact;

    const payload: Record<string, unknown> = {
      lastTemplate: input.templateName,
      lastSentAt: now,
      lastStatus: input.status,
      lastProviderMessageId: input.providerMessageId,
      updatedAt: now,
    };

    if (!current) {
      tx.set(ref, {
        ...EMPTY_DISPATCH_META,
        ...profile,
        ...payload,
        phoneE164: input.contact.phoneE164,
        source: input.contact.source || "whatsapp_disparo",
        createdAt: now,
      });
      return;
    }

    tx.set(
      ref,
      {
        ...payload,
        ...(current.optOut ? { optOut: true, optOutAt: current.optOutAt } : {}),
      },
      { merge: true },
    );
  });
}

export async function setContactOptOut(
  phoneE164: string,
  extras?: { name?: string },
): Promise<void> {
  const id = contactIdFromPhone(phoneE164);
  if (!id) return;

  const ref = col(COLLECTIONS.marketingContacts).doc(id);
  const now = nowIso();
  const snapshot = await ref.get();
  const current = mapDoc(id, snapshot.data());

  await ref.set(
    {
      phoneE164,
      optOut: true,
      optOutAt: current?.optOutAt || now,
      updatedAt: now,
      ...(snapshot.exists
        ? {}
        : {
            ...EMPTY_DISPATCH_META,
            name: extras?.name ?? "",
            email: "",
            source: "whatsapp_disparo",
            uf: "",
            parties: [],
            roles: [],
            municipality: "",
            isCandidate2026: false,
            candidateRole: "",
            gender: "",
            isReelection: false,
            instagramFollowers: 0,
            relevanceScore: 0,
            relevanceTier: "padrao",
            suspended: false,
            origin: "opt-out",
            optOut: true,
            optOutAt: now,
            createdAt: now,
          }),
    },
    { merge: true },
  );
}
