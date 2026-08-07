import type { MockSentinelSuggestion } from "@/lib/sentinel-mock-suggestions";

export type SentinelMunicipalFallbackMeta = {
  reason: "themes_missed" | "few_local" | "portal_no_theme_match";
  /** Temas do radar sem card municipal temático. */
  themesMissed: string[];
  /** Tópicos/títulos promovidos no fallback geo. */
  foundTopics: string[];
  promotedCount: number;
  cities: string[];
};

export type SentinelSuggestionsMeta = {
  source: "google-news-rss+portals" | "sentinel-v2-pipelines";
  cached: boolean;
  refreshedAt: string;
  radarThemesCount: number;
  articlesScanned: number;
  portalsMonitored: number;
  pipelinesEnabled?: boolean;
  expansionTermsCount?: number;
  themeVerificationStats?: {
    articlesProcessed: number;
    cacheHits: number;
    llmCalls: number;
    articlesRejected: number;
  };
  /** Diagnóstico da coleta RSS (Google News + portais) no refresh. */
  rssFetchStats?: {
    attempted: number;
    succeeded: number;
    failed: number;
    emptyBody: number;
    httpErrors: number;
    aborted: number;
    items: number;
  };
  /** Spike qualidade — % pautável (heurística) + custo LLM estimado. */
  qualityReport?: {
    newsTotal: number;
    newsPautavel: number;
    newsPautavelPercent: number;
    oppositionTotal: number;
  };
  qualityRankStats?: {
    considered: number;
    ranked: number;
    llmCalls: number;
    kept: number;
    dropped: number;
  };
  llmCostEstimate?: {
    expansionCalls: number;
    verifyLlmCalls: number;
    qualityRankCalls: number;
    estimatedUsd: number;
    model: string;
  };
  emptyReason?: string;
  oppositionUnavailableReason?: string;
  /**
   * Esfera municipal: não achamos os temas do radar na cidade —
   * ampliamos para notícias locais e avisamos o usuário.
   */
  municipalFallback?: SentinelMunicipalFallbackMeta;
  /** Hash dos temas ativos no radar quando o cache foi gravado. */
  radarThemesSignature?: string;
};

export type SentinelSuggestionsResult = {
  suggestions: MockSentinelSuggestion[];
  meta: SentinelSuggestionsMeta;
};
