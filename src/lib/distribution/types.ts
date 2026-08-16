import type { DistributionChannelId } from "@/lib/distribution/channels";

export const DISTRIBUTION_POST_STATUSES = [
  "draft",
  "pending_approval",
  "approved",
  "publishing",
  "scheduled",
  "published",
  "partial_failure",
  "failed",
  "rejected",
  "blocked_blackout",
] as const;

export type DistributionPostStatus = (typeof DISTRIBUTION_POST_STATUSES)[number];

export const CHANNEL_DELIVERY_STATUSES = [
  "pending",
  "queued",
  "scheduled",
  "publishing",
  "published",
  "failed",
  "skipped",
] as const;

export type ChannelDeliveryStatus = (typeof CHANNEL_DELIVERY_STATUSES)[number];

export type ChannelDeliveryState = {
  status: ChannelDeliveryStatus;
  externalPostId: string | null;
  postUrl: string | null;
  error: string | null;
  updatedAt: string;
};

export type DistributionPost = {
  id: string;
  ownerUserId: string;
  profileId: string;
  creativeProjectId: string;
  videoUrl: string;
  captionBase: string;
  captionsByChannel: Partial<Record<DistributionChannelId, string>>;
  channels: DistributionChannelId[];
  /** ISO datetime; null = publicar assim que aprovado. */
  scheduledAt: string | null;
  /** Janela legada do onboarding (opcional). */
  distributionWindow: string | null;
  status: DistributionPostStatus;
  perChannelStatus: Partial<Record<DistributionChannelId, ChannelDeliveryState>>;
  ayrsharePostId: string | null;
  rejectReason: string;
  approvedBy: string | null;
  approvedAt: string | null;
  lastError: string;
  createdAt: string;
  updatedAt: string;
};

export type ConnectedPlatformState = {
  connected: boolean;
  displayName: string | null;
  connectedAt: string | null;
};

export type SocialConnection = {
  id: string;
  profileId: string;
  ownerUserId: string;
  ayrshareProfileKey: string;
  ayrshareRefId: string;
  instagramUserId: string;
  instagramUsername: string;
  instagramTokenEncrypted: string;
  instagramTokenExpiresAt: string | null;
  platforms: Partial<Record<DistributionChannelId, ConnectedPlatformState>>;
  /** Data da eleição (YYYY-MM-DD) para blackout; null = sem blackout. */
  electionDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DistributionAuditEntry = {
  id: string;
  ownerUserId: string;
  profileId: string;
  distributionPostId: string;
  action: string;
  actorUserId: string | null;
  channels: DistributionChannelId[];
  payload: Record<string, unknown>;
  createdAt: string;
};

export type PublishPostPayload = {
  distributionPostId: string;
  channels: DistributionChannelId[];
  scheduledAt?: string | null;
  retryFailedOnly?: boolean;
};
