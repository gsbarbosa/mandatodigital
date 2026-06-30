import type { MockSentinelSuggestion } from "@/lib/sentinel-mock-suggestions";

export type SentinelSuggestionsMeta = {
  source: "google-news-rss+portals" | "sentinel-v2-pipelines";
  cached: boolean;
  refreshedAt: string;
  radarThemesCount: number;
  articlesScanned: number;
  /** Matérias que bateram em ao menos um tema do radar (pós-filtro de relevância). */
  articlesMatchedRadar?: number;
  portalsMonitored: number;
  pipelinesEnabled?: boolean;
  expansionTermsCount?: number;
  socialProfilesScanned?: number;
  socialPostsScanned?: number;
  socialEnabled?: boolean;
  /** Sugestões descartadas por tema fora do radar salvo. */
  themeViolationsFiltered?: number;
  /** Enriquecimento editorial via LLM ativo nesta execução. */
  enrichmentEnabled?: boolean;
  emptyReason?: string;
};

export type SentinelSuggestionsResult = {
  suggestions: MockSentinelSuggestion[];
  meta: SentinelSuggestionsMeta;
};
