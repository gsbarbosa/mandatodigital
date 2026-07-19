import { randomUUID } from "node:crypto";

import type { DocumentData } from "firebase-admin/firestore";

import { COLLECTIONS, col } from "@/lib/firebase/collections";
import type { CreativeProject, CreativeProjectStatus } from "@/lib/types";

export type CreativeProjectCreateInput = {
  profileId?: string | null;
  topic: string;
  personaArchetypes: string[];
  voiceTones: string[];
  scriptDraft: string;
  scriptApproved: boolean;
  freePrompt: string;
  useFreePrompt: boolean;
  avatarTrack: "realistic" | "caricature" | "photo_real";
  caricatureAssetId: string;
  heygenVideoId?: string | null;
  videoUrl?: string;
  captionUrl?: string;
  status: CreativeProjectStatus;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
};

function nowIso() {
  return new Date().toISOString();
}

function mapDoc(id: string, data: DocumentData): CreativeProject {
  const avatarTrack = data.avatarTrack;
  return {
    id,
    profileId: data.profileId === null || data.profileId === undefined ? null : String(data.profileId),
    topic: String(data.topic ?? ""),
    personaArchetypes: Array.isArray(data.personaArchetypes)
      ? data.personaArchetypes.map(String)
      : [],
    voiceTones: Array.isArray(data.voiceTones) ? data.voiceTones.map(String) : [],
    scriptDraft: String(data.scriptDraft ?? ""),
    scriptApproved: Boolean(data.scriptApproved ?? false),
    freePrompt: String(data.freePrompt ?? ""),
    useFreePrompt: Boolean(data.useFreePrompt ?? false),
    avatarTrack:
      avatarTrack === "caricature" || avatarTrack === "photo_real" ? avatarTrack : "realistic",
    caricatureAssetId: String(data.caricatureAssetId ?? ""),
    heygenVideoId:
      data.heygenVideoId === null || data.heygenVideoId === undefined
        ? null
        : String(data.heygenVideoId),
    videoUrl: String(data.videoUrl ?? ""),
    captionUrl: String(data.captionUrl ?? ""),
    status: String(data.status ?? "draft") as CreativeProjectStatus,
    errorMessage: String(data.errorMessage ?? ""),
    metadata:
      data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)
        ? (data.metadata as Record<string, unknown>)
        : {},
    createdAt: String(data.createdAt ?? nowIso()),
    updatedAt: String(data.updatedAt ?? nowIso()),
  };
}

export const creativeProjectStorage = {
  async create(input: CreativeProjectCreateInput) {
    const timestamp = nowIso();
    const record: CreativeProject = {
      id: randomUUID(),
      profileId: input.profileId ?? null,
      topic: input.topic,
      personaArchetypes: input.personaArchetypes,
      voiceTones: input.voiceTones,
      scriptDraft: input.scriptDraft,
      scriptApproved: input.scriptApproved,
      freePrompt: input.freePrompt,
      useFreePrompt: input.useFreePrompt,
      avatarTrack: input.avatarTrack,
      caricatureAssetId: input.caricatureAssetId,
      heygenVideoId: input.heygenVideoId ?? null,
      videoUrl: input.videoUrl ?? "",
      captionUrl: input.captionUrl ?? "",
      status: input.status,
      errorMessage: input.errorMessage ?? "",
      metadata: input.metadata ?? {},
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await col(COLLECTIONS.creativeProjects).doc(record.id).set(record);
    return record;
  },

  async listByProfileId(profileId: string, limit = 50) {
    const snap = await col(COLLECTIONS.creativeProjects)
      .where("profileId", "==", profileId)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();

    return snap.docs.map((doc) => mapDoc(doc.id, doc.data()));
  },
};
