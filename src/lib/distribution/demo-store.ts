/** Store client-only do Distribuidor enquanto o backend Ayrshare fica fail-closed. */

import { buildCaptionsByChannel } from "@/lib/distribution/captions";
import {
  DISTRIBUTION_CHANNEL_IDS,
  DISTRIBUTION_CHANNELS,
  type DistributionChannelId,
} from "@/lib/distribution/channels";
import type {
  ChannelDeliveryState,
  ConnectedPlatformState,
  DistributionPost,
} from "@/lib/distribution/types";

const STORAGE_KEY = "md-distribution-demo-v1";

/** UI usa store local enquanto publish real (Ayrshare) permanece desligado. */
export function isDistributionDemoMode() {
  const value = process.env.NEXT_PUBLIC_DISTRIBUTION_ENABLED?.trim().toLowerCase();
  return !(value === "1" || value === "true" || value === "yes" || value === "on");
}

export type DemoConnectionChannel = {
  id: DistributionChannelId;
  label: string;
  connected: boolean;
  displayName: string | null;
};

export type DemoConnectionsSnapshot = {
  electionDate: string | null;
  channels: DemoConnectionChannel[];
};

type DemoStoreState = {
  posts: DistributionPost[];
  electionDate: string | null;
  platforms: Partial<Record<DistributionChannelId, ConnectedPlatformState>>;
};

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  }
  return `${prefix}_${Date.now().toString(36)}`;
}

function defaultPlatforms(): Partial<Record<DistributionChannelId, ConnectedPlatformState>> {
  const platforms: Partial<Record<DistributionChannelId, ConnectedPlatformState>> = {};
  for (const id of DISTRIBUTION_CHANNEL_IDS) {
    platforms[id] = { connected: false, displayName: null, connectedAt: null };
  }
  return platforms;
}

function emptyState(): DemoStoreState {
  return {
    posts: [],
    electionDate: null,
    platforms: defaultPlatforms(),
  };
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readState(): DemoStoreState {
  if (!canUseStorage()) {
    return emptyState();
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return emptyState();
    }
    const parsed = JSON.parse(raw) as Partial<DemoStoreState>;
    return {
      posts: Array.isArray(parsed.posts) ? parsed.posts : [],
      electionDate: typeof parsed.electionDate === "string" ? parsed.electionDate : null,
      platforms: { ...defaultPlatforms(), ...(parsed.platforms ?? {}) },
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: DemoStoreState) {
  if (!canUseStorage()) {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function pendingDelivery(channels: DistributionChannelId[]): DistributionPost["perChannelStatus"] {
  const stamp = nowIso();
  const map: DistributionPost["perChannelStatus"] = {};
  for (const channel of channels) {
    map[channel] = {
      status: "pending",
      externalPostId: null,
      postUrl: null,
      error: null,
      updatedAt: stamp,
    };
  }
  return map;
}

function publishedDelivery(channels: DistributionChannelId[]): DistributionPost["perChannelStatus"] {
  const stamp = nowIso();
  const map: DistributionPost["perChannelStatus"] = {};
  for (const channel of channels) {
    map[channel] = {
      status: "published",
      externalPostId: `demo_${channel}`,
      postUrl: null,
      error: null,
      updatedAt: stamp,
    };
  }
  return map;
}

function scheduledDelivery(channels: DistributionChannelId[]): DistributionPost["perChannelStatus"] {
  const stamp = nowIso();
  const map: DistributionPost["perChannelStatus"] = {};
  for (const channel of channels) {
    map[channel] = {
      status: "scheduled",
      externalPostId: `demo_${channel}`,
      postUrl: null,
      error: null,
      updatedAt: stamp,
    };
  }
  return map;
}

function mutatePost(
  id: string,
  updater: (post: DistributionPost, state: DemoStoreState) => DistributionPost,
): DistributionPost {
  const state = readState();
  const index = state.posts.findIndex((post) => post.id === id);
  if (index < 0) {
    throw new Error("Pacote nao encontrado.");
  }
  const updated = updater(state.posts[index], state);
  const next = {
    ...state,
    posts: [...state.posts],
  };
  next.posts[index] = updated;
  writeState(next);
  return updated;
}

export function listDemoPosts(): DistributionPost[] {
  return [...readState().posts].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function getDemoConnections(): DemoConnectionsSnapshot {
  const state = readState();
  return {
    electionDate: state.electionDate,
    channels: DISTRIBUTION_CHANNELS.map((channel) => {
      const row = state.platforms[channel.id];
      return {
        id: channel.id,
        label: channel.label,
        connected: Boolean(row?.connected),
        displayName: row?.displayName ?? null,
      };
    }),
  };
}

export function setDemoElectionDate(electionDate: string | null) {
  const state = readState();
  writeState({ ...state, electionDate });
}

export function connectDemoAccounts() {
  const stamp = nowIso();
  const state = readState();
  const platforms: Partial<Record<DistributionChannelId, ConnectedPlatformState>> = {
    ...state.platforms,
  };
  for (const channel of DISTRIBUTION_CHANNELS) {
    platforms[channel.id] = {
      connected: true,
      displayName: `Conta demo · ${channel.label}`,
      connectedAt: stamp,
    };
  }
  writeState({ ...state, platforms });
  return getDemoConnections();
}

export type CreateDemoPostInput = {
  creativeProjectId: string;
  videoUrl: string;
  captionBase: string;
  channels?: DistributionChannelId[];
};

export function createDemoPost(input: CreateDemoPostInput): DistributionPost {
  const channels = input.channels?.length
    ? input.channels
    : [...DISTRIBUTION_CHANNEL_IDS];
  const stamp = nowIso();
  const captionBase = input.captionBase.trim() || "Pacote pronto para revisão Go/No-go.";
  const post: DistributionPost = {
    id: createId("dpost"),
    ownerUserId: "demo",
    profileId: "demo",
    creativeProjectId: input.creativeProjectId,
    videoUrl: input.videoUrl,
    captionBase,
    captionsByChannel: buildCaptionsByChannel(captionBase, channels),
    channels,
    scheduledAt: null,
    distributionWindow: null,
    status: "pending_approval",
    perChannelStatus: pendingDelivery(channels),
    ayrsharePostId: null,
    rejectReason: "",
    approvedBy: null,
    approvedAt: null,
    lastError: "",
    createdAt: stamp,
    updatedAt: stamp,
  };

  const state = readState();
  writeState({
    ...state,
    posts: [post, ...state.posts.filter((item) => item.creativeProjectId !== input.creativeProjectId)],
  });
  return post;
}

export function updateDemoPost(
  id: string,
  patch: {
    captionBase?: string;
    channels?: DistributionChannelId[];
    scheduledAt?: string | null;
  },
): DistributionPost {
  return mutatePost(id, (post) => {
    const channels = patch.channels?.length ? patch.channels : post.channels;
    const captionBase =
      typeof patch.captionBase === "string" ? patch.captionBase : post.captionBase;
    const nextStatus =
      post.status === "rejected" || post.status === "draft"
        ? "pending_approval"
        : post.status;

    const perChannelStatus: DistributionPost["perChannelStatus"] = { ...post.perChannelStatus };
    for (const channel of channels) {
      if (!perChannelStatus[channel]) {
        perChannelStatus[channel] = {
          status: "pending",
          externalPostId: null,
          postUrl: null,
          error: null,
          updatedAt: nowIso(),
        } satisfies ChannelDeliveryState;
      }
    }

    return {
      ...post,
      captionBase,
      channels,
      captionsByChannel: buildCaptionsByChannel(captionBase, channels, post.captionsByChannel),
      scheduledAt:
        patch.scheduledAt === undefined ? post.scheduledAt : patch.scheduledAt,
      status: nextStatus,
      perChannelStatus,
      updatedAt: nowIso(),
      lastError: "",
    };
  });
}

export function approveDemoPost(id: string): DistributionPost {
  return mutatePost(id, (post, state) => {
    const connected = DISTRIBUTION_CHANNEL_IDS.filter(
      (channel) => state.platforms[channel]?.connected,
    );
    const targets = post.channels.filter((channel) => connected.includes(channel));
    if (targets.length === 0) {
      throw new Error("Conecte ao menos uma rede em Contas antes do Go.");
    }

    const stamp = nowIso();
    const scheduled =
      Boolean(post.scheduledAt) && new Date(post.scheduledAt!).getTime() > Date.now();

    return {
      ...post,
      channels: targets,
      captionsByChannel: buildCaptionsByChannel(post.captionBase, targets, post.captionsByChannel),
      status: scheduled ? "scheduled" : "published",
      perChannelStatus: scheduled
        ? scheduledDelivery(targets)
        : publishedDelivery(targets),
      approvedBy: "demo",
      approvedAt: stamp,
      updatedAt: stamp,
      lastError: "",
      rejectReason: "",
    };
  });
}

export function rejectDemoPost(id: string, reason: string): DistributionPost {
  return mutatePost(id, (post) => ({
    ...post,
    status: "rejected",
    rejectReason: reason.trim(),
    lastError: reason.trim() ? `No-go: ${reason.trim()}` : "No-go",
    updatedAt: nowIso(),
  }));
}

export function retryDemoPost(id: string): DistributionPost {
  return mutatePost(id, (post) => {
    const stamp = nowIso();
    return {
      ...post,
      status: "published",
      perChannelStatus: publishedDelivery(post.channels),
      lastError: "",
      updatedAt: stamp,
    };
  });
}
