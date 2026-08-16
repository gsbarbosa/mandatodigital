import { describe, expect, it } from "vitest";

import { InstagramGraphPublisher } from "@/lib/distribution/providers/instagram-publisher";

describe("InstagramGraphPublisher", () => {
  const publisher = new InstagramGraphPublisher();

  it("marca canais fora do recorte como failed", async () => {
    const result = await publisher.publish({
      videoUrl: "https://cdn.example/video.mp4",
      caption: "oi",
      captionsByChannel: { facebook: "x" },
      channels: ["facebook"],
      scheduledAt: null,
      instagramAccessToken: "token",
      instagramUserId: "123",
      idempotencyKey: "k1",
    });
    expect(result.channels).toHaveLength(1);
    expect(result.channels[0]?.status).toBe("failed");
    expect(result.channels[0]?.error).toMatch(/recorte Instagram/i);
  });

  it("nao publica sem token", async () => {
    const result = await publisher.publish({
      videoUrl: "https://cdn.example/video.mp4",
      caption: "oi",
      captionsByChannel: { instagram: "oi" },
      channels: ["instagram"],
      scheduledAt: null,
      idempotencyKey: "k2",
    });
    expect(result.channels[0]?.status).toBe("failed");
    expect(result.channels[0]?.error).toMatch(/nao conectada/i);
  });

  it("agenda Reel no futuro sem chamar a Graph", async () => {
    const when = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const result = await publisher.publish({
      videoUrl: "https://cdn.example/video.mp4",
      caption: "oi",
      captionsByChannel: { instagram: "oi" },
      channels: ["instagram"],
      scheduledAt: when,
      instagramAccessToken: "token",
      instagramUserId: "123",
      idempotencyKey: "k3",
    });
    expect(result.channels[0]?.status).toBe("scheduled");
  });
});
