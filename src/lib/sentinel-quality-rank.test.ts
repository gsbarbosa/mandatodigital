import { afterEach, describe, expect, it, vi } from "vitest";

import type { MockSentinelSuggestion } from "./sentinel-mock-suggestions";

const ENV_KEYS = ["SENTINEL_LLM_QUALITY_RANK"] as const;
const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  vi.resetModules();
  vi.clearAllMocks();
});

function newsCard(): MockSentinelSuggestion {
  return {
    id: "n1",
    themeLabel: "Desemprego",
    matchedThemes: ["Desemprego"],
    relevanceScore: 70,
    topic: "Desemprego · Taxa cai",
    evidence: {
      postsAnalyzed: 1,
      outletCount: 1,
      engagementTrendPercent: 0,
      byNetwork: [],
      actors: [],
      articles: [
        {
          title: "Taxa de desemprego cai a 5,6%, diz IBGE",
          url: "https://g1.globo.com/x",
          sourceName: "G1",
        },
      ],
    },
    engagement: {
      relevanceScore: 70,
      scoreTrendPercent: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      postsAnalyzed: 1,
      sources: [],
      byNetwork: [],
    },
  };
}

describe("applySentinelQualityRank", () => {
  it("no-op com flag desligada", async () => {
    delete process.env.SENTINEL_LLM_QUALITY_RANK;
    vi.resetModules();
    const { applySentinelQualityRank } = await import("./sentinel-quality-rank");
    const input = [newsCard()];
    const result = await applySentinelQualityRank(input);
    expect(result.suggestions).toEqual(input);
    expect(result.stats.llmCalls).toBe(0);
  });

  it("reordena com LLM quando flag ligada", async () => {
    process.env.SENTINEL_LLM_QUALITY_RANK = "true";
    vi.resetModules();
    vi.doMock("@/lib/llm", () => ({
      requestStructuredJson: vi.fn(async () => ({
        rawText: JSON.stringify({
          pautavel: true,
          score: 0.9,
          briefing: "IBGE confirma menor taxa da serie.",
          creativeAngle: "Emprego em alta: o que o mandato pode cobrar",
        }),
        provider: "openai",
        model: "test",
        latencyMs: 1,
        tokenUsage: null,
      })),
      parseJsonResponse: (text: string) => JSON.parse(text),
    }));
    const { applySentinelQualityRank } = await import("./sentinel-quality-rank");
    const result = await applySentinelQualityRank([newsCard()]);
    expect(result.stats.llmCalls).toBe(1);
    expect(result.stats.kept).toBe(1);
    expect(result.suggestions[0]?.topic).toContain("Emprego em alta");
    expect(result.suggestions[0]?.briefing).toContain("IBGE");
    expect(result.suggestions[0]?.creativeAngle).toContain("Emprego em alta");
  });

  it("respeita enabled=false mesmo com flag ligada", async () => {
    process.env.SENTINEL_LLM_QUALITY_RANK = "true";
    vi.resetModules();
    const { applySentinelQualityRank } = await import("./sentinel-quality-rank");
    const result = await applySentinelQualityRank([newsCard()], { enabled: false });
    expect(result.stats.llmCalls).toBe(0);
    expect(result.suggestions).toHaveLength(1);
  });
});
