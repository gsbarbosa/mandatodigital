import type { MockSentinelSuggestion } from "@/lib/sentinel-mock-suggestions";

export type SentinelSuggestionsMeta = {
  source: "google-news-rss+portals" | "sentinel-v2-pipelines";
  cached: boolean;
  refreshedAt: string;
  radarThemesCount: number;
  articlesScanned: number;
  portalsMonitored: number;
  pipelinesEnabled?: boolean;
  expansionTermsCount?: number;
  emptyReason?: string;
};

export type SentinelSuggestionsResult = {
  suggestions: MockSentinelSuggestion[];
  meta: SentinelSuggestionsMeta;
};
