import { enqueueAsyncJob } from "@/lib/async-jobs-enqueue";
import type { DistributionChannelId } from "@/lib/distribution/channels";

export async function enqueuePublishPostJob(input: {
  ownerUserId: string;
  distributionPostId: string;
  channels: DistributionChannelId[];
  scheduledAt?: string | null;
  retryFailedOnly?: boolean;
}) {
  const channelKey = [...input.channels].sort().join(",");
  const idempotencyKey = input.retryFailedOnly
    ? `publish-retry:${input.distributionPostId}:${channelKey}:${Date.now()}`
    : `publish:${input.distributionPostId}:${channelKey}`;

  return enqueueAsyncJob({
    ownerUserId: input.ownerUserId,
    type: "publish_post",
    idempotencyKey: input.retryFailedOnly ? idempotencyKey : idempotencyKey,
    payload: {
      distributionPostId: input.distributionPostId,
      channels: input.channels,
      scheduledAt: input.scheduledAt ?? null,
      retryFailedOnly: Boolean(input.retryFailedOnly),
    },
  });
}
