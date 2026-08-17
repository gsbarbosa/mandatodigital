import { afterEach, describe, expect, it, vi } from "vitest";

import { adaptCaptionsByChannel } from "@/lib/distribution/caption-adapter";
import { getChannelDef } from "@/lib/distribution/channels";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function mockOpenAi(captions: Record<string, string>) {
  globalThis.fetch = vi.fn(async () =>
    new Response(
      JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ captions }) } }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  ) as unknown as typeof fetch;
}

describe("adaptCaptionsByChannel", () => {
  it("cai no truncamento quando nao ha key de provider", async () => {
    globalThis.fetch = vi.fn(async () => new Response("{}", { status: 500 })) as never;

    const result = await adaptCaptionsByChannel({
      captionBase: "x".repeat(500),
      channels: ["twitter"],
    });

    expect(result.adapted).toBe(false);
    expect(result.captionsByChannel.twitter).toHaveLength(
      getChannelDef("twitter").captionLimit,
    );
  });

  it("respeita override do usuario sem chamar o modelo", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as never;

    const result = await adaptCaptionsByChannel({
      captionBase: "roteiro base",
      channels: ["linkedin"],
      overrides: { linkedin: "texto escrito a mao" },
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.captionsByChannel.linkedin).toBe("texto escrito a mao");
    expect(result.adapted).toBe(false);
  });

  it("usa a legenda adaptada por canal e corta no limite da rede", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    mockOpenAi({
      twitter: "y".repeat(400),
      linkedin: "Post institucional sobre a pauta.",
    });

    const result = await adaptCaptionsByChannel({
      captionBase: "roteiro base aprovado",
      channels: ["twitter", "linkedin"],
    });

    expect(result.adapted).toBe(true);
    expect(result.captionsByChannel.linkedin).toBe("Post institucional sobre a pauta.");
    expect(result.captionsByChannel.twitter).toHaveLength(
      getChannelDef("twitter").captionLimit,
    );
  });
});
