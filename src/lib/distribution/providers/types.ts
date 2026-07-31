import type { DistributionChannelId } from "@/lib/distribution/channels";

export type PublishMediaInput = {
  videoUrl: string;
  /** Caption única quando o provider posta um batch; preferir captionsByChannel. */
  caption: string;
  captionsByChannel: Partial<Record<DistributionChannelId, string>>;
  channels: DistributionChannelId[];
  scheduledAt: string | null;
  /** Profile key do tenant (Ayrshare). */
  profileKey: string;
  idempotencyKey: string;
};

export type PublishChannelResult = {
  channel: DistributionChannelId;
  status: "published" | "scheduled" | "failed";
  externalPostId: string | null;
  postUrl: string | null;
  error: string | null;
};

export type PublishResult = {
  provider: string;
  batchId: string | null;
  channels: PublishChannelResult[];
};

export interface SocialPublisher {
  readonly name: string;
  publish(input: PublishMediaInput): Promise<PublishResult>;
}
