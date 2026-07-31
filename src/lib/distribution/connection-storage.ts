import { randomUUID } from "node:crypto";

import type { DocumentData } from "firebase-admin/firestore";

import {
  DISTRIBUTION_CHANNEL_IDS,
  type DistributionChannelId,
  isDistributionChannelId,
} from "@/lib/distribution/channels";
import type {
  ConnectedPlatformState,
  SocialConnection,
} from "@/lib/distribution/types";
import { COLLECTIONS, col } from "@/lib/firebase/collections";

function nowIso() {
  return new Date().toISOString();
}

function mapPlatforms(data: DocumentData): SocialConnection["platforms"] {
  const raw = data.platforms;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const platforms: SocialConnection["platforms"] = {};
  for (const id of DISTRIBUTION_CHANNEL_IDS) {
    const entry = (raw as Record<string, unknown>)[id];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      continue;
    }
    const row = entry as Record<string, unknown>;
    platforms[id] = {
      connected: Boolean(row.connected),
      displayName: row.displayName == null ? null : String(row.displayName),
      connectedAt: row.connectedAt == null ? null : String(row.connectedAt),
    };
  }
  return platforms;
}

function mapDoc(id: string, data: DocumentData): SocialConnection {
  return {
    id,
    profileId: String(data.profileId ?? id),
    ownerUserId: String(data.ownerUserId ?? ""),
    ayrshareProfileKey: String(data.ayrshareProfileKey ?? ""),
    ayrshareRefId: String(data.ayrshareRefId ?? ""),
    platforms: mapPlatforms(data),
    electionDate: data.electionDate ? String(data.electionDate) : null,
    createdAt: String(data.createdAt ?? nowIso()),
    updatedAt: String(data.updatedAt ?? nowIso()),
  };
}

export const socialConnectionStorage = {
  async getByProfileId(profileId: string): Promise<SocialConnection | null> {
    const snap = await col(COLLECTIONS.socialConnections).doc(profileId).get();
    if (!snap.exists) {
      return null;
    }
    return mapDoc(snap.id, snap.data()!);
  },

  async upsert(input: {
    profileId: string;
    ownerUserId: string;
    ayrshareProfileKey: string;
    ayrshareRefId: string;
    platforms?: SocialConnection["platforms"];
    electionDate?: string | null;
  }): Promise<SocialConnection> {
    const existing = await this.getByProfileId(input.profileId);
    const now = nowIso();
    const record: SocialConnection = {
      id: input.profileId,
      profileId: input.profileId,
      ownerUserId: input.ownerUserId,
      ayrshareProfileKey: input.ayrshareProfileKey,
      ayrshareRefId: input.ayrshareRefId,
      platforms: input.platforms ?? existing?.platforms ?? {},
      electionDate:
        input.electionDate !== undefined
          ? input.electionDate
          : (existing?.electionDate ?? null),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await col(COLLECTIONS.socialConnections).doc(input.profileId).set(record, {
      merge: true,
    });
    return record;
  },

  async updatePlatforms(
    profileId: string,
    platforms: Partial<Record<DistributionChannelId, ConnectedPlatformState>>,
  ): Promise<SocialConnection | null> {
    const existing = await this.getByProfileId(profileId);
    if (!existing) {
      return null;
    }
    const merged = { ...existing.platforms, ...platforms };
    const now = nowIso();
    await col(COLLECTIONS.socialConnections).doc(profileId).set(
      { platforms: merged, updatedAt: now },
      { merge: true },
    );
    return { ...existing, platforms: merged, updatedAt: now };
  },

  async setElectionDate(
    profileId: string,
    electionDate: string | null,
  ): Promise<SocialConnection | null> {
    const existing = await this.getByProfileId(profileId);
    if (!existing) {
      return null;
    }
    const now = nowIso();
    await col(COLLECTIONS.socialConnections).doc(profileId).set(
      { electionDate, updatedAt: now },
      { merge: true },
    );
    return { ...existing, electionDate, updatedAt: now };
  },
};

export function connectedChannelIds(
  connection: SocialConnection | null,
): DistributionChannelId[] {
  if (!connection) {
    return [];
  }
  return DISTRIBUTION_CHANNEL_IDS.filter((id) => connection.platforms[id]?.connected);
}

export function assertChannelIds(raw: string[]): DistributionChannelId[] {
  const ids: DistributionChannelId[] = [];
  for (const value of raw) {
    if (!isDistributionChannelId(value)) {
      throw new Error(`Canal invalido: ${value}`);
    }
    ids.push(value);
  }
  return ids;
}

export function newConnectionRefId(profileId: string) {
  return `md-${profileId.slice(0, 8)}-${randomUUID().slice(0, 8)}`;
}
