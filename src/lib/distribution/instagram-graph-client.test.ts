import { afterEach, describe, expect, it, vi } from "vitest";

import {
  exchangeInstagramCode,
  publishInstagramReel,
} from "@/lib/distribution/instagram-graph-client";

describe("publishInstagramReel", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("cria container, espera FINISHED e publica o Reel", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/178414/media?") && !url.includes("media_publish")) {
        return new Response(JSON.stringify({ id: "container_1" }), { status: 200 });
      }
      if (url.includes("/container_1?")) {
        return new Response(JSON.stringify({ status_code: "FINISHED" }), { status: 200 });
      }
      if (url.includes("/media_publish")) {
        return new Response(JSON.stringify({ id: "media_9" }), { status: 200 });
      }
      if (url.includes("/media_9?")) {
        return new Response(
          JSON.stringify({ permalink: "https://www.instagram.com/reel/abc/" }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ error: { message: url } }), { status: 400 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await publishInstagramReel({
      igUserId: "178414",
      accessToken: "token",
      videoUrl: "https://cdn.example/video.mp4",
      caption: "ola",
      sleep: async () => undefined,
      maxAttempts: 2,
      intervalMs: 1,
    });

    expect(result.containerId).toBe("container_1");
    expect(result.mediaId).toBe("media_9");
    expect(result.permalink).toContain("/reel/");
    expect(fetchMock).toHaveBeenCalled();
  });

  it("propaga erro da Graph API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({ error: { message: "video_url is not accessible" } }),
          { status: 400 },
        );
      }),
    );

    await expect(
      publishInstagramReel({
        igUserId: "178414",
        accessToken: "token",
        videoUrl: "https://cdn.example/private.mp4",
        caption: "x",
        sleep: async () => undefined,
      }),
    ).rejects.toThrow(/nao acessivel|not accessible/i);
  });
});

describe("exchangeInstagramCode", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("le access_token no envelope data[] do Instagram Login", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            data: [{ access_token: "short_token", user_id: "178414" }],
          }),
          { status: 200 },
        );
      }),
    );

    const exchanged = await exchangeInstagramCode("abc");
    expect(exchanged.accessToken).toBe("short_token");
    expect(exchanged.userId).toBe("178414");
  });
});
