import type { MockSentinelSuggestion } from "@/lib/sentinel-mock-suggestions";
import type { SentinelSuggestionsMeta } from "@/lib/sentinel-types";

export type SentinelSuggestionsPayload = {
  suggestions: MockSentinelSuggestion[];
  meta: SentinelSuggestionsMeta | null;
};

export function buildSentinelRefreshStatusMessage(
  suggestions: MockSentinelSuggestion[],
  meta: SentinelSuggestionsMeta | null,
) {
  const count = suggestions.length;
  if (count > 0) {
    const label = count === 1 ? "1 sinal atualizado" : `${count} sinais atualizados`;
    return `${label} no Sentinela.`;
  }

  return meta?.emptyReason || "Nenhum sinal novo para o radar atual.";
}

export async function fetchSentinelSuggestionsCache(): Promise<SentinelSuggestionsPayload> {
  const response = await fetch("/api/sentinel/suggestions");
  const payload = (await response.json()) as {
    suggestions?: MockSentinelSuggestion[];
    meta?: SentinelSuggestionsMeta;
    message?: string;
  };

  if (!response.ok) {
    throw new Error(payload.message || "Não foi possível carregar os sinais.");
  }

  return {
    suggestions: payload.suggestions ?? [],
    meta: payload.meta ?? null,
  };
}

export async function refreshSentinelSuggestionsRemote(): Promise<SentinelSuggestionsPayload> {
  const response = await fetch("/api/sentinel/refresh", { method: "POST" });
  const payload = (await response.json()) as {
    suggestions?: MockSentinelSuggestion[];
    meta?: SentinelSuggestionsMeta;
    message?: string;
  };

  if (!response.ok) {
    throw new Error(payload.message || "Não foi possível atualizar os sinais.");
  }

  return {
    suggestions: payload.suggestions ?? [],
    meta: payload.meta ?? null,
  };
}

export function isSentinelCacheNewer(
  previousRefreshedAt: string | null | undefined,
  nextMeta: SentinelSuggestionsMeta | null,
) {
  const next = nextMeta?.refreshedAt?.trim();
  if (!next) {
    return false;
  }

  if (!previousRefreshedAt?.trim()) {
    return true;
  }

  return new Date(next).getTime() > new Date(previousRefreshedAt).getTime();
}
