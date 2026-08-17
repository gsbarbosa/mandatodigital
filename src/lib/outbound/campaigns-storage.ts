/** CRUD das campanhas (`marketingCampaigns`) e da trilha de envios (`marketingSends`). */

import type { DocumentData } from "firebase-admin/firestore";

import { COLLECTIONS, col } from "@/lib/firebase/collections";
import {
  isCampaignChannel,
  isCampaignStatus,
  isSendStatus,
  type CampaignChannel,
  type CampaignStats,
  type CampaignStatus,
  type MarketingCampaign,
  type MarketingSend,
} from "@/lib/outbound/types";

const SEND_BATCH_SIZE = 450;

function nowIso() {
  return new Date().toISOString();
}

function mapCampaign(id: string, data: DocumentData | undefined): MarketingCampaign | null {
  if (!data) {
    return null;
  }

  const stats = (data.stats ?? {}) as Partial<CampaignStats>;

  return {
    id,
    name: String(data.name ?? "").trim() || "Sem nome",
    channel: isCampaignChannel(data.channel) ? data.channel : "email",
    segmentId: String(data.segmentId ?? "").trim(),
    subject: String(data.subject ?? ""),
    body: String(data.body ?? ""),
    templateName: String(data.templateName ?? ""),
    templateLanguage: String(data.templateLanguage ?? "pt_BR"),
    templateParams: Array.isArray(data.templateParams)
      ? (data.templateParams as unknown[]).map((item) => String(item))
      : [],
    status: isCampaignStatus(data.status) ? data.status : "rascunho",
    stats: {
      total: Number(stats.total ?? 0),
      sent: Number(stats.sent ?? 0),
      failed: Number(stats.failed ?? 0),
    },
    lastError: String(data.lastError ?? ""),
    createdAt: String(data.createdAt ?? nowIso()),
    updatedAt: String(data.updatedAt ?? nowIso()),
    sentAt: String(data.sentAt ?? ""),
  };
}

export async function listMarketingCampaigns(): Promise<MarketingCampaign[]> {
  const snapshot = await col(COLLECTIONS.marketingCampaigns).get();
  return snapshot.docs
    .map((doc) => mapCampaign(doc.id, doc.data()))
    .filter((campaign): campaign is MarketingCampaign => Boolean(campaign))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getMarketingCampaign(id: string): Promise<MarketingCampaign | null> {
  const snapshot = await col(COLLECTIONS.marketingCampaigns).doc(id).get();
  return mapCampaign(snapshot.id, snapshot.data());
}

export type CampaignInput = {
  name: string;
  channel: CampaignChannel;
  segmentId: string;
  subject?: string;
  body?: string;
  templateName?: string;
  templateLanguage?: string;
  templateParams?: string[];
};

export async function createMarketingCampaign(input: CampaignInput): Promise<MarketingCampaign> {
  const name = input.name.trim();
  if (!name) {
    throw new Error("Nome da campanha é obrigatório.");
  }
  if (!input.segmentId.trim()) {
    throw new Error("Segmento é obrigatório.");
  }

  const now = nowIso();
  const ref = col(COLLECTIONS.marketingCampaigns).doc();
  const campaign: MarketingCampaign = {
    id: ref.id,
    name,
    channel: input.channel,
    segmentId: input.segmentId.trim(),
    subject: (input.subject ?? "").trim(),
    body: input.body ?? "",
    templateName: (input.templateName ?? "").trim(),
    templateLanguage: (input.templateLanguage ?? "pt_BR").trim() || "pt_BR",
    templateParams: input.templateParams ?? [],
    status: "rascunho",
    stats: { total: 0, sent: 0, failed: 0 },
    lastError: "",
    createdAt: now,
    updatedAt: now,
    sentAt: "",
  };

  await ref.set({
    name: campaign.name,
    channel: campaign.channel,
    segmentId: campaign.segmentId,
    subject: campaign.subject,
    body: campaign.body,
    templateName: campaign.templateName,
    templateLanguage: campaign.templateLanguage,
    templateParams: campaign.templateParams,
    status: campaign.status,
    stats: campaign.stats,
    lastError: campaign.lastError,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
    sentAt: campaign.sentAt,
  });

  return campaign;
}

export async function updateMarketingCampaign(
  id: string,
  patch: Partial<CampaignInput>,
): Promise<MarketingCampaign> {
  const ref = col(COLLECTIONS.marketingCampaigns).doc(id);
  const snapshot = await ref.get();
  const current = mapCampaign(id, snapshot.data());
  if (!snapshot.exists || !current) {
    throw new Error("Campanha não encontrada.");
  }
  if (current.status !== "rascunho") {
    throw new Error("Só campanha em rascunho pode ser editada.");
  }

  const next: MarketingCampaign = {
    ...current,
    name: patch.name !== undefined ? patch.name.trim() || current.name : current.name,
    channel: patch.channel !== undefined ? patch.channel : current.channel,
    segmentId:
      patch.segmentId !== undefined ? patch.segmentId.trim() || current.segmentId : current.segmentId,
    subject: patch.subject !== undefined ? patch.subject.trim() : current.subject,
    body: patch.body !== undefined ? patch.body : current.body,
    templateName:
      patch.templateName !== undefined ? patch.templateName.trim() : current.templateName,
    templateLanguage:
      patch.templateLanguage !== undefined
        ? patch.templateLanguage.trim() || current.templateLanguage
        : current.templateLanguage,
    templateParams:
      patch.templateParams !== undefined ? patch.templateParams : current.templateParams,
    updatedAt: nowIso(),
  };

  await ref.set(
    {
      name: next.name,
      channel: next.channel,
      segmentId: next.segmentId,
      subject: next.subject,
      body: next.body,
      templateName: next.templateName,
      templateLanguage: next.templateLanguage,
      templateParams: next.templateParams,
      updatedAt: next.updatedAt,
    },
    { merge: true },
  );

  return next;
}

export async function deleteMarketingCampaign(id: string): Promise<void> {
  const ref = col(COLLECTIONS.marketingCampaigns).doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    throw new Error("Campanha não encontrada.");
  }
  await ref.delete();
}

export async function setCampaignStatus(
  id: string,
  status: CampaignStatus,
  extra: { stats?: CampaignStats; lastError?: string; sentAt?: string } = {},
): Promise<void> {
  await col(COLLECTIONS.marketingCampaigns)
    .doc(id)
    .set(
      {
        status,
        updatedAt: nowIso(),
        ...(extra.stats ? { stats: extra.stats } : {}),
        ...(extra.lastError !== undefined ? { lastError: extra.lastError } : {}),
        ...(extra.sentAt !== undefined ? { sentAt: extra.sentAt } : {}),
      },
      { merge: true },
    );
}

function mapSend(id: string, data: DocumentData | undefined): MarketingSend | null {
  if (!data) {
    return null;
  }
  return {
    id,
    campaignId: String(data.campaignId ?? ""),
    contactId: String(data.contactId ?? ""),
    channel: isCampaignChannel(data.channel) ? data.channel : "email",
    destination: String(data.destination ?? ""),
    contactName: String(data.contactName ?? ""),
    status: isSendStatus(data.status) ? data.status : "falhou",
    error: String(data.error ?? ""),
    providerMessageId: String(data.providerMessageId ?? ""),
    createdAt: String(data.createdAt ?? nowIso()),
  };
}

export async function recordSends(sends: Omit<MarketingSend, "id">[]): Promise<void> {
  const collection = col(COLLECTIONS.marketingSends);

  for (let index = 0; index < sends.length; index += SEND_BATCH_SIZE) {
    const chunk = sends.slice(index, index + SEND_BATCH_SIZE);
    const batch = collection.firestore.batch();
    for (const send of chunk) {
      batch.set(collection.doc(), send);
    }
    await batch.commit();
  }
}

export async function listCampaignSends(campaignId: string): Promise<MarketingSend[]> {
  const snapshot = await col(COLLECTIONS.marketingSends)
    .where("campaignId", "==", campaignId)
    .get();

  return snapshot.docs
    .map((doc) => mapSend(doc.id, doc.data()))
    .filter((send): send is MarketingSend => Boolean(send))
    .sort((a, b) => a.contactName.localeCompare(b.contactName, "pt-BR"));
}
