import { randomUUID } from "node:crypto";

import type { DocumentData } from "firebase-admin/firestore";

import {
  type DistributionChannelId,
  isDistributionChannelId,
} from "@/lib/distribution/channels";
import type {
  ChannelDeliveryState,
  DistributionPost,
  DistributionPostStatus,
} from "@/lib/distribution/types";
import { COLLECTIONS, col } from "@/lib/firebase/collections";

function nowIso() {
  return new Date().toISOString();
}

function mapPerChannel(data: DocumentData): DistributionPost["perChannelStatus"] {
  const raw = data.perChannelStatus;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const result: DistributionPost["perChannelStatus"] = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isDistributionChannelId(key) || !value || typeof value !== "object") {
      continue;
    }
    const row = value as Record<string, unknown>;
    result[key] = {
      status: String(row.status ?? "pending") as ChannelDeliveryState["status"],
      externalPostId: row.externalPostId == null ? null : String(row.externalPostId),
      postUrl: row.postUrl == null ? null : String(row.postUrl),
      error: row.error == null ? null : String(row.error),
      updatedAt: String(row.updatedAt ?? nowIso()),
    };
  }
  return result;
}

function mapChannels(data: DocumentData): DistributionChannelId[] {
  if (!Array.isArray(data.channels)) {
    return [];
  }
  return data.channels.filter((item): item is DistributionChannelId =>
    isDistributionChannelId(String(item)),
  );
}

function mapCaptions(data: DocumentData): DistributionPost["captionsByChannel"] {
  const raw = data.captionsByChannel;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const result: DistributionPost["captionsByChannel"] = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (isDistributionChannelId(key) && typeof value === "string") {
      result[key] = value;
    }
  }
  return result;
}

function mapDoc(id: string, data: DocumentData): DistributionPost {
  return {
    id,
    ownerUserId: String(data.ownerUserId ?? ""),
    profileId: String(data.profileId ?? ""),
    creativeProjectId: String(data.creativeProjectId ?? ""),
    videoUrl: String(data.videoUrl ?? ""),
    videoStoragePath: String(data.videoStoragePath ?? ""),
    captionBase: String(data.captionBase ?? ""),
    captionsByChannel: mapCaptions(data),
    channels: mapChannels(data),
    scheduledAt: data.scheduledAt ? String(data.scheduledAt) : null,
    distributionWindow: data.distributionWindow
      ? String(data.distributionWindow)
      : null,
    status: String(data.status ?? "draft") as DistributionPostStatus,
    perChannelStatus: mapPerChannel(data),
    ayrsharePostId: data.ayrsharePostId == null ? null : String(data.ayrsharePostId),
    rejectReason: String(data.rejectReason ?? ""),
    approvedBy: data.approvedBy == null ? null : String(data.approvedBy),
    approvedAt: data.approvedAt == null ? null : String(data.approvedAt),
    lastError: String(data.lastError ?? ""),
    createdAt: String(data.createdAt ?? nowIso()),
    updatedAt: String(data.updatedAt ?? nowIso()),
  };
}

export type DistributionPostCreateInput = {
  ownerUserId: string;
  profileId: string;
  creativeProjectId: string;
  videoUrl: string;
  videoStoragePath?: string;
  captionBase: string;
  captionsByChannel?: DistributionPost["captionsByChannel"];
  channels: DistributionChannelId[];
  scheduledAt?: string | null;
  distributionWindow?: string | null;
  status?: DistributionPostStatus;
};

export const distributionPostStorage = {
  async create(input: DistributionPostCreateInput): Promise<DistributionPost> {
    const now = nowIso();
    const id = randomUUID();
    const perChannelStatus: DistributionPost["perChannelStatus"] = {};
    for (const channel of input.channels) {
      perChannelStatus[channel] = {
        status: "pending",
        externalPostId: null,
        postUrl: null,
        error: null,
        updatedAt: now,
      };
    }

    const record: DistributionPost = {
      id,
      ownerUserId: input.ownerUserId,
      profileId: input.profileId,
      creativeProjectId: input.creativeProjectId,
      videoUrl: input.videoUrl,
      videoStoragePath: input.videoStoragePath?.trim() || "",
      captionBase: input.captionBase,
      captionsByChannel: input.captionsByChannel ?? {},
      channels: input.channels,
      scheduledAt: input.scheduledAt ?? null,
      distributionWindow: input.distributionWindow ?? null,
      status: input.status ?? "draft",
      perChannelStatus,
      ayrsharePostId: null,
      rejectReason: "",
      approvedBy: null,
      approvedAt: null,
      lastError: "",
      createdAt: now,
      updatedAt: now,
    };

    await col(COLLECTIONS.distributionPosts).doc(id).set(record);
    return record;
  },

  async getById(id: string): Promise<DistributionPost | null> {
    const snap = await col(COLLECTIONS.distributionPosts).doc(id).get();
    if (!snap.exists) {
      return null;
    }
    return mapDoc(snap.id, snap.data()!);
  },

  async listByOwner(ownerUserId: string, limit = 50): Promise<DistributionPost[]> {
    const snap = await col(COLLECTIONS.distributionPosts)
      .where("ownerUserId", "==", ownerUserId)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();
    return snap.docs.map((doc) => mapDoc(doc.id, doc.data()));
  },

  /**
   * Pacotes que o publisher marcou como `scheduled` e cujo horário já chegou.
   * O Graph não agenda do lado da Meta — quem retoma é o worker de agendados.
   */
  async listScheduledDue(input?: {
    now?: Date;
    limit?: number;
  }): Promise<DistributionPost[]> {
    const cutoff = (input?.now ?? new Date()).toISOString();
    const snap = await col(COLLECTIONS.distributionPosts)
      .where("status", "==", "scheduled")
      .where("scheduledAt", "<=", cutoff)
      .orderBy("scheduledAt", "asc")
      .limit(input?.limit ?? 25)
      .get();
    return snap.docs.map((doc) => mapDoc(doc.id, doc.data()));
  },

  async update(
    id: string,
    patch: Partial<
      Pick<
        DistributionPost,
        | "captionBase"
        | "captionsByChannel"
        | "channels"
        | "videoUrl"
        | "videoStoragePath"
        | "scheduledAt"
        | "distributionWindow"
        | "status"
        | "perChannelStatus"
        | "ayrsharePostId"
        | "rejectReason"
        | "approvedBy"
        | "approvedAt"
        | "lastError"
      >
    >,
  ): Promise<DistributionPost | null> {
    const existing = await this.getById(id);
    if (!existing) {
      return null;
    }
    const updatedAt = nowIso();
    const next: DistributionPost = {
      ...existing,
      ...patch,
      updatedAt,
    };
    await col(COLLECTIONS.distributionPosts).doc(id).set(next, { merge: true });
    return next;
  },
};
