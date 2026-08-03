import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getApifyToken,
  isApifyConfigured,
  normalizeApifyInstagramItems,
  normalizeInstagramHandle,
} from "./sentinel-instagram-posts";

describe("sentinel-instagram-posts", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("aceita APIFY_API_TOKEN como alias do token Apify", () => {
    vi.stubEnv("APIFY_API_TOKEN", "token-apify");
    vi.stubEnv("SENTINEL_SOCIAL_ENABLED", "true");
    expect(getApifyToken()).toBe("token-apify");
    expect(isApifyConfigured()).toBe(true);
  });
  it("normaliza handle sem @", () => {
    expect(normalizeInstagramHandle("@KimKataguiri")).toBe("kimkataguiri");
  });

  it("inclui reels e ignora posts de outros usuarios", () => {
    const posts = normalizeApifyInstagramItems(
      [
        {
          ownerUsername: "kimkataguiri",
          url: "https://www.instagram.com/reel/abc123/",
          caption: "Reel relevante",
          type: "Video",
          productType: "clips",
          timestamp: "2026-07-08T12:00:00.000Z",
        },
        {
          ownerUsername: "folha",
          url: "https://www.instagram.com/p/xyz/",
          caption: "Kim Jong-un reeleito",
          type: "Image",
          timestamp: "2026-07-07T12:00:00.000Z",
        },
        {
          ownerUsername: "kimkataguiri",
          url: "https://www.instagram.com/p/realpost/",
          caption: "Voto impresso e transparencia nas urnas",
          type: "Image",
          likesCount: 1200,
          commentsCount: 88,
          timestamp: "2026-07-09T10:00:00.000Z",
        },
      ],
      "kimkataguiri",
    );

    expect(posts).toHaveLength(2);
    expect(posts.map((post) => post.url)).toEqual(
      expect.arrayContaining([
        "https://www.instagram.com/p/realpost/",
        "https://www.instagram.com/reel/abc123/",
      ]),
    );
  });
});
