import type { PublishMediaInput, PublishResult, SocialPublisher } from "@/lib/distribution/providers/types";
import { publishInstagramReel } from "@/lib/distribution/instagram-graph-client";

export class InstagramGraphPublisher implements SocialPublisher {
  readonly name = "instagram-graph";

  async publish(input: PublishMediaInput): Promise<PublishResult> {
    const channels: PublishResult["channels"] = [];

    if (input.scheduledAt) {
      const when = new Date(input.scheduledAt).getTime();
      if (Number.isFinite(when) && when > Date.now() + 60_000) {
        for (const channel of input.channels) {
          channels.push({
            channel,
            status: channel === "instagram" ? "scheduled" : "failed",
            externalPostId: null,
            postUrl: null,
            error:
              channel === "instagram"
                ? null
                : "Canal fora do recorte Instagram.",
          });
        }
        return { provider: this.name, batchId: null, channels };
      }
    }

    const token = input.instagramAccessToken?.trim() || "";
    const igUserId = input.instagramUserId?.trim() || "";

    for (const channel of input.channels) {
      if (channel !== "instagram") {
        channels.push({
          channel,
          status: "failed",
          externalPostId: null,
          postUrl: null,
          error: "Canal fora do recorte Instagram.",
        });
        continue;
      }

      if (!token || !igUserId) {
        channels.push({
          channel,
          status: "failed",
          externalPostId: null,
          postUrl: null,
          error: "Conta Instagram nao conectada.",
        });
        continue;
      }

      try {
        const published = await publishInstagramReel({
          igUserId,
          accessToken: token,
          videoUrl: input.videoUrl,
          caption: input.captionsByChannel.instagram?.trim() || input.caption,
        });
        channels.push({
          channel,
          status: "published",
          externalPostId: published.mediaId,
          postUrl: published.permalink,
          error: null,
        });
      } catch (error) {
        channels.push({
          channel,
          status: "failed",
          externalPostId: null,
          postUrl: null,
          error: error instanceof Error ? error.message : "Falha ao publicar no Instagram.",
        });
      }
    }

    return { provider: this.name, batchId: channels[0]?.externalPostId ?? null, channels };
  }
}

export function getSocialPublisher(): SocialPublisher {
  return new InstagramGraphPublisher();
}
