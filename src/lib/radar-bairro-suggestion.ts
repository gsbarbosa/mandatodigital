/**
 * Ponte entre o Radar de Bairro e a UI/fluxo já existentes do Monitoramento.
 *
 * O card (MonitorSignalCard) e o botão "Pautar" falam MockSentinelSuggestion —
 * então convertemos aqui, do mesmo jeito que a Notícias do Dia faz. Isso dá card,
 * gaveta de evidência e geração de conteúdo de graça, sem duplicar componente.
 */

import type { MockSentinelSuggestion } from "@/lib/sentinel-mock-suggestions";
import {
  RADAR_BAIRRO_THEME_LABELS,
  type RadarBairroResult,
  type RadarBairroSignal,
} from "@/lib/radar-bairro-types";

/** Prefixo dos ids — usado pelo fallback de lookup do botão "Pautar". */
export const RADAR_BAIRRO_ID_PREFIX = "rb-";

export function radarBairroSuggestionId(signal: RadarBairroSignal): string {
  return `${RADAR_BAIRRO_ID_PREFIX}${signal.id}`;
}

export function toRadarBairroSuggestion(signal: RadarBairroSignal): MockSentinelSuggestion {
  const themeLabel = RADAR_BAIRRO_THEME_LABELS[signal.theme];
  const sourceName = signal.groupTitle || signal.localityName;

  return {
    id: radarBairroSuggestionId(signal),
    themeLabel: signal.localityName,
    matchedThemes: [themeLabel],
    relevanceScore: 0,
    topic: `${signal.localityName} · ${themeLabel}`,
    // O "motivo" da IA explica em uma linha por que isso interessa ao mandato —
    // é o mesmo slot do briefing editorial do Sentinela.
    briefing: signal.reason || signal.text.slice(0, 220),
    evidence: {
      byNetwork: [],
      actors: [],
      articles: [
        {
          title: signal.text.slice(0, 180),
          url: signal.url,
          sourceName,
          publishedAt: signal.publishedAt ?? undefined,
        },
      ],
      postsAnalyzed: 1,
      engagementTrendPercent: 0,
    },
    engagement: {
      relevanceScore: 0,
      scoreTrendPercent: 0,
      likes: signal.likes,
      comments: signal.comments,
      postsAnalyzed: 1,
      sources: [],
      byNetwork: [],
    },
  };
}

export function findRadarBairroSuggestionById(
  result: Pick<RadarBairroResult, "signals">,
  id: string,
): MockSentinelSuggestion | null {
  const signal = result.signals.find((item) => radarBairroSuggestionId(item) === id);
  return signal ? toRadarBairroSuggestion(signal) : null;
}
