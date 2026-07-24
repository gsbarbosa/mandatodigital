import { createHash } from "node:crypto";

import { z } from "zod";

import { isSentinelLlmThemeVerifyEnabled } from "@/lib/feature-flags";
import { parseJsonResponse, requestStructuredJson } from "@/lib/llm";
import type { RssNewsItem } from "@/lib/sentinel-rss";
import {
  SENTINEL_THEME_VERIFY_MODEL_VERSION,
  SENTINEL_THEME_VERIFY_TTL_DAYS,
  SENTINEL_UMBRELLA_THEMES,
} from "@/lib/sentinel-theme-verify-constants";
import {
  readArticleThemeVerdicts,
  type ArticleThemeVerdictRecord,
  writeArticleThemeVerdicts,
} from "@/lib/sentinel-theme-verify-storage";
import { pickBestMatchedTheme } from "@/lib/sentinel-theme-synonyms";
import { normalizeSentinelText } from "@/lib/sentinel-text";

export {
  SENTINEL_THEME_VERIFY_MODEL_VERSION,
  SENTINEL_THEME_VERIFY_TTL_DAYS,
} from "@/lib/sentinel-theme-verify-constants";
export type { ArticleThemeVerdictRecord as ArticleThemeVerdict } from "@/lib/sentinel-theme-verify-storage";

const LLM_CONCURRENCY = 5;

const themeVerifyResponseSchema = z.object({
  primaryTheme: z.string().trim().optional().default(""),
  themes: z
    .array(
      z.object({
        theme: z.string().trim().min(2),
        approved: z.boolean(),
        confidence: z.number().min(0).max(1),
        rationale: z.string().trim().default(""),
      }),
    )
    .max(12),
});

export type ThemeVerificationStats = {
  articlesProcessed: number;
  cacheHits: number;
  llmCalls: number;
  articlesRejected: number;
};

export function canonicalThemeSlug(theme: string) {
  return normalizeSentinelText(theme).replace(/\s+/g, "-");
}

export function buildArticleFingerprint(article: {
  title: string;
  link?: string;
  sourceName?: string;
  pubDate?: string | null;
}) {
  const title = normalizeSentinelText(article.title);
  const source = normalizeSentinelText(article.sourceName ?? "");
  const pubDate = (article.pubDate ?? "").trim().slice(0, 10);
  const payload = [title, source, pubDate].filter(Boolean).join("|");

  return createHash("sha256").update(payload).digest("hex").slice(0, 32);
}

function verdictCacheKey(fingerprint: string, theme: string) {
  return `${fingerprint}|${canonicalThemeSlug(theme)}|${SENTINEL_THEME_VERIFY_MODEL_VERSION}`;
}

function expiresAtFromNow() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + SENTINEL_THEME_VERIFY_TTL_DAYS);
  return date.toISOString();
}

function isVerdictFresh(record: ArticleThemeVerdictRecord) {
  if (!record.expiresAt) {
    return true;
  }

  const expiresAt = new Date(record.expiresAt).getTime();
  return !Number.isNaN(expiresAt) && expiresAt > Date.now();
}

function buildVerifyPrompt(input: {
  article: RssNewsItem;
  candidateThemes: string[];
}) {
  const themesList = input.candidateThemes.map((theme) => `- ${theme}`).join("\n");
  const umbrellaHit = input.candidateThemes.some((theme) =>
    SENTINEL_UMBRELLA_THEMES.some(
      (umbrella) => normalizeSentinelText(umbrella) === normalizeSentinelText(theme),
    ),
  );

  return {
    system:
      "Voce classifica se noticias brasileiras tratam de temas politicos especificos. " +
      "Responda apenas JSON valido: " +
      '{ "primaryTheme": "tema principal", "themes": [{ "theme": "...", "approved": true|false, "confidence": 0-1, "rationale": "..." }] }. ' +
      "Aprove somente quando a materia trata do tema de forma substantiva (nao basta mencao lateral). " +
      "primaryTheme deve ser um dos temas aprovados com maior aderencia, ou string vazia se nenhum. " +
      "Temas guarda-chuva (Fake News, Regulamentacao de Redes, Liberdade de Expressao, Transparencia): " +
      "so aprove se houver fato politico concreto (PL, TSE/TRE, governo, plataforma, decisao judicial). " +
      "Rejeite material educativo generico, 'como identificar fake news', Dia da Mentira, palestra academica " +
      "ou alerta municipal operacional sem angulo politico.",
    user: [
      `Titulo: ${input.article.title.trim()}`,
      input.article.sourceName ? `Fonte: ${input.article.sourceName}` : "",
      input.article.pubDate ? `Data: ${input.article.pubDate}` : "",
      `Temas candidatos:\n${themesList}`,
      umbrellaHit
        ? "ATENCAO: ha tema guarda-chuva na lista — seja rigoroso no approved."
        : "",
      "Para cada tema candidato, indique approved true/false.",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

async function verifyThemesWithLlm(input: {
  article: RssNewsItem;
  candidateThemes: string[];
}): Promise<ArticleThemeVerdictRecord[]> {
  const prompt = buildVerifyPrompt(input);
  const execution = await requestStructuredJson(prompt.system, prompt.user, {
    temperature: 0.1,
    maxTokens: 700,
  });

  if (!execution.rawText) {
    return [];
  }

  const parsed = parseJsonResponse<unknown>(execution.rawText);
  const validated = themeVerifyResponseSchema.safeParse(parsed);

  if (!validated.success) {
    return [];
  }

  const fingerprint = buildArticleFingerprint(input.article);
  const verifiedAt = new Date().toISOString();
  const expiresAt = expiresAtFromNow();
  const byTheme = new Map(
    validated.data.themes.map((row) => [canonicalThemeSlug(row.theme), row]),
  );

  return input.candidateThemes.flatMap((themeLabel) => {
    const row = byTheme.get(canonicalThemeSlug(themeLabel));
    if (!row) {
      return [];
    }

    return [
      {
        articleFingerprint: fingerprint,
        articleTitle: input.article.title.trim(),
        articleUrl: input.article.link?.trim() ?? "",
        articleSource: input.article.sourceName?.trim() ?? "",
        themeCanonical: canonicalThemeSlug(themeLabel),
        themeLabel,
        approved: row.approved,
        confidence: row.confidence,
        rationale: row.rationale.trim(),
        modelVersion: SENTINEL_THEME_VERIFY_MODEL_VERSION,
        verifiedAt,
        expiresAt,
      },
    ];
  });
}

export type ClassifiedArticleForVerification = {
  article: RssNewsItem;
  haystack: string;
  themeLabel: string;
  matchedThemes: string[];
};

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const results: R[] = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await mapper(items[current]);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function applyThemeVerificationBatch(
  classified: ClassifiedArticleForVerification[],
): Promise<{
  items: ClassifiedArticleForVerification[];
  stats: ThemeVerificationStats;
}> {
  const stats: ThemeVerificationStats = {
    articlesProcessed: classified.length,
    cacheHits: 0,
    llmCalls: 0,
    articlesRejected: 0,
  };

  if (!isSentinelLlmThemeVerifyEnabled() || classified.length === 0) {
    return { items: classified, stats };
  }

  const lookupKeys: Array<{ fingerprint: string; themeCanonical: string; themeLabel: string }> = [];

  for (const item of classified) {
    const fingerprint = buildArticleFingerprint(item.article);
    for (const theme of item.matchedThemes) {
      lookupKeys.push({
        fingerprint,
        themeCanonical: canonicalThemeSlug(theme),
        themeLabel: theme,
      });
    }
  }

  const cached = await readArticleThemeVerdicts(lookupKeys);
  const cacheByKey = new Map<string, ArticleThemeVerdictRecord>();

  for (const record of cached) {
    if (isVerdictFresh(record)) {
      cacheByKey.set(
        `${record.articleFingerprint}|${record.themeCanonical}|${record.modelVersion}`,
        record,
      );
    }
  }

  const articlesNeedingLlm: Array<{
    item: ClassifiedArticleForVerification;
    uncachedThemes: string[];
  }> = [];

  for (const item of classified) {
    const fingerprint = buildArticleFingerprint(item.article);
    const uncachedThemes = item.matchedThemes.filter((theme) => {
      const key = verdictCacheKey(fingerprint, theme);
      const hit = cacheByKey.get(key);
      if (hit) {
        stats.cacheHits += 1;
        return false;
      }
      return true;
    });

    if (uncachedThemes.length > 0) {
      articlesNeedingLlm.push({ item, uncachedThemes });
    }
  }

  const newVerdicts: ArticleThemeVerdictRecord[] = [];

  if (articlesNeedingLlm.length > 0) {
    const llmResults = await mapWithConcurrency(
      articlesNeedingLlm,
      LLM_CONCURRENCY,
      async ({ item, uncachedThemes }) => {
        stats.llmCalls += 1;
        return verifyThemesWithLlm({
          article: item.article,
          candidateThemes: uncachedThemes,
        });
      },
    );

    for (const verdicts of llmResults) {
      for (const verdict of verdicts) {
        cacheByKey.set(
          `${verdict.articleFingerprint}|${verdict.themeCanonical}|${verdict.modelVersion}`,
          verdict,
        );
        newVerdicts.push(verdict);
      }
    }

    if (newVerdicts.length > 0) {
      await writeArticleThemeVerdicts(newVerdicts);
    }
  }

  const refined: ClassifiedArticleForVerification[] = [];

  for (const item of classified) {
    const fingerprint = buildArticleFingerprint(item.article);
    const finalThemes = item.matchedThemes.filter((theme) => {
      const verdict = cacheByKey.get(verdictCacheKey(fingerprint, theme));
      if (!verdict) {
        return true;
      }
      return verdict.approved;
    });

    if (finalThemes.length === 0) {
      stats.articlesRejected += 1;
      continue;
    }

    const themeLabel = pickBestMatchedTheme(item.haystack, finalThemes);
    if (!themeLabel) {
      stats.articlesRejected += 1;
      continue;
    }

    refined.push({
      ...item,
      themeLabel,
      matchedThemes: finalThemes,
    });
  }

  return { items: refined, stats };
}
