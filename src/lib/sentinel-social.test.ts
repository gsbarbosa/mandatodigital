import { describe, expect, it } from "vitest";

import { parseApifyInstagramItems, normalizeInstagramUsername } from "@/lib/sentinel-apify-instagram";
import {
  computeEngagementGrowthPercent,
  computePostEngagement,
} from "@/lib/sentinel-social-engagement";

describe("sentinel-social-engagement", () => {
  it("calcula engajamento com pesos de comentario e compartilhamento", () => {
    expect(computePostEngagement(100, 10, 2)).toBe(126);
  });

  it("calcula crescimento entre janelas de 24h", () => {
    const now = Date.now();
    const growth = computeEngagementGrowthPercent([
      {
        timestamp: new Date(now - 2 * 60 * 60 * 1000),
        engagement: 200,
      },
      {
        timestamp: new Date(now - 30 * 60 * 60 * 1000),
        engagement: 100,
      },
    ]);

    expect(growth).toBe(100);
  });
});

describe("sentinel-apify-instagram", () => {
  it("normaliza handles com ou sem arroba", () => {
    expect(normalizeInstagramUsername("@prefeitura_sp/")).toBe("prefeitura_sp");
  });

  it("faz parse de itens do dataset Apify", () => {
    const posts = parseApifyInstagramItems(
      [
        {
          caption: "Reforma da previdencia municipal avanca",
          url: "https://www.instagram.com/p/ABC123/",
          likesCount: 120,
          commentsCount: 8,
          ownerUsername: "vereador_teste",
          timestamp: "2026-06-24T12:00:00.000Z",
        },
      ],
      "vereador_teste",
    );

    expect(posts).toHaveLength(1);
    expect(posts[0]?.commentsCount).toBe(8);
    expect(posts[0]?.caption).toContain("previdencia");
  });
});
