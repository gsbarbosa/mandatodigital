import { ayrsharePublishPerChannel } from "@/lib/distribution/ayrshare-client";
import type { PublishMediaInput, PublishResult, SocialPublisher } from "@/lib/distribution/providers/types";

export class AyrsharePublisher implements SocialPublisher {
  readonly name = "ayrshare";

  async publish(input: PublishMediaInput): Promise<PublishResult> {
    const { batchId, results } = await ayrsharePublishPerChannel({
      profileKey: input.profileKey ?? "",
      videoUrl: input.videoUrl,
      captionsByChannel: input.captionsByChannel,
      channels: input.channels,
      scheduledAt: input.scheduledAt,
      idempotencyKey: input.idempotencyKey,
    });

    return {
      provider: this.name,
      batchId,
      channels: results,
    };
  }
}
