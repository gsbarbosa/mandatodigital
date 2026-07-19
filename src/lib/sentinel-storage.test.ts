import { describe, expect, it } from "vitest";

import { isSentinelCacheExpired } from "@/lib/sentinel-storage";
import type { MockSentinelSuggestion } from "@/lib/sentinel-mock-suggestions";
import type { SentinelSuggestionsMeta } from "@/lib/sentinel-types";

const sampleMeta: SentinelSuggestionsMeta = {
  source: "google-news-rss+portals",
  cached: false,
  refreshedAt: "2026-06-24T12:00:00.000Z",
  radarThemesCount: 1,
  articlesScanned: 1,
  portalsMonitored: 0,
};

const _sampleSuggestion: MockSentinelSuggestion = {
  id: "sentinela-rss-test",
  themeLabel: "Saude",
  matchedThemes: ["Saude"],
  relevanceScore: 80,
  topic: "Saude · teste",
  evidence: {
    postsAnalyzed: 1,
    engagementTrendPercent: 0,
    byNetwork: [],
    actors: [],
    articles: [],
  },
  engagement: {
    relevanceScore: 80,
    scoreTrendPercent: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    postsAnalyzed: 1,
    sources: [],
    byNetwork: [],
  },
};

describe("sentinel-storage", () => {
  it("detecta cache expirado", () => {
    expect(
      isSentinelCacheExpired({
        suggestions: [],
        meta: sampleMeta,
        expiresAt: "2020-01-01T00:00:00.000Z",
        refreshedAt: sampleMeta.refreshedAt,
      }),
    ).toBe(true);
  });
});

describe("sentinel api contract", () => {
  it("meta de sugestoes inclui campos obrigatorios", () => {
    expect(sampleMeta).toMatchObject({
      source: "google-news-rss+portals",
      cached: expect.any(Boolean),
      refreshedAt: expect.any(String),
      radarThemesCount: expect.any(Number),
      articlesScanned: expect.any(Number),
      portalsMonitored: expect.any(Number),
    });
  });
});
