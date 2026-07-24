import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/feature-flags", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/feature-flags")>();
  return {
    ...actual,
    isSentinelLlmThemeVerifyEnabled: vi.fn(() => false),
  };
});

vi.mock("@/lib/sentinel-theme-verify-storage", () => ({
  readArticleThemeVerdicts: vi.fn(),
  writeArticleThemeVerdicts: vi.fn(),
}));

import { isSentinelLlmThemeVerifyEnabled } from "@/lib/feature-flags";
import {
  applyThemeVerificationBatch,
  buildArticleFingerprint,
  canonicalThemeSlug,
} from "@/lib/sentinel-theme-verify";
import {
  readArticleThemeVerdicts,
  writeArticleThemeVerdicts,
} from "@/lib/sentinel-theme-verify-storage";

const ENV_KEYS = ["SENTINEL_LLM_THEME_VERIFY", "SENTINEL_PERSIST_CACHE"] as const;
const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  vi.mocked(isSentinelLlmThemeVerifyEnabled).mockReturnValue(false);
  vi.mocked(readArticleThemeVerdicts).mockReset();
  vi.mocked(writeArticleThemeVerdicts).mockReset();
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe("sentinel-theme-verify", () => {
  it("gera fingerprint estavel por titulo e fonte", () => {
    const article = {
      title: "Falta de policiamento em Sao Paulo",
      sourceName: "CBN",
      pubDate: "Wed, 09 Jul 2026 10:44:00 GMT",
    };

    expect(buildArticleFingerprint(article)).toHaveLength(32);
    expect(buildArticleFingerprint(article)).toBe(buildArticleFingerprint(article));
    expect(canonicalThemeSlug("Segurança Pública")).toBe("seguranca-publica");
  });

  it("mantem classificacao por regras quando flag desligada", async () => {
    const result = await applyThemeVerificationBatch([
      {
        article: {
          title: "Falta de policiamento em Sao Paulo",
          link: "https://example.com/1",
          pubDate: null,
          publishedAt: null,
        },
        haystack: "Falta de policiamento em Sao Paulo CBN",
        themeLabel: "Segurança Pública",
        matchedThemes: ["Saneamento Básico", "Segurança Pública"],
      },
    ]);

    expect(result.items).toHaveLength(1);
    expect(result.stats.llmCalls).toBe(0);
  });

  it("usa cache global e rejeita tema reprovado pela IA", async () => {
    vi.mocked(isSentinelLlmThemeVerifyEnabled).mockReturnValue(true);

    const article = {
      title: "Falta de policiamento em Sao Paulo",
      link: "https://example.com/1",
      pubDate: "Wed, 09 Jul 2026 10:44:00 GMT",
      publishedAt: new Date("2026-07-09T10:44:00.000Z"),
      sourceName: "CBN",
    };
    const fingerprint = buildArticleFingerprint(article);

    vi.mocked(readArticleThemeVerdicts).mockResolvedValue([
      {
        articleFingerprint: fingerprint,
        articleTitle: article.title,
        articleUrl: article.link,
        articleSource: "CBN",
        themeCanonical: canonicalThemeSlug("Saneamento Básico"),
        themeLabel: "Saneamento Básico",
        approved: false,
        confidence: 0.05,
        rationale: "Materia trata de seguranca, nao saneamento.",
        modelVersion: "2",
        verifiedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      },
      {
        articleFingerprint: fingerprint,
        articleTitle: article.title,
        articleUrl: article.link,
        articleSource: "CBN",
        themeCanonical: canonicalThemeSlug("Segurança Pública"),
        themeLabel: "Segurança Pública",
        approved: true,
        confidence: 0.95,
        rationale: "Materia sobre policiamento.",
        modelVersion: "2",
        verifiedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      },
    ]);
    vi.mocked(writeArticleThemeVerdicts).mockResolvedValue();

    const result = await applyThemeVerificationBatch([
      {
        article,
        haystack: `${article.title} ${article.sourceName}`,
        themeLabel: "Saneamento Básico",
        matchedThemes: ["Saneamento Básico", "Segurança Pública"],
      },
    ]);

    expect(result.stats.cacheHits).toBe(2);
    expect(result.stats.llmCalls).toBe(0);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.themeLabel).toBe("Segurança Pública");
    expect(result.items[0]?.matchedThemes).toEqual(["Segurança Pública"]);
  });
});
