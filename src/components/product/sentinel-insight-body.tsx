import { SentinelNetworkMetrics } from "@/components/product/sentinel-network-metrics";
import {
  formatSentinelSearchTrend,
  sentinelPipelineBadgeLabel,
  type MockSentinelSuggestion,
} from "@/lib/sentinel-mock-suggestions";

export function SentinelInsightBody({
  suggestion,
}: {
  suggestion: MockSentinelSuggestion;
  compact?: boolean;
}) {
  const { evidence, topic, matchedThemes } = suggestion;

  return (
    <div className="persona-sentinel-insight">
      <p className="persona-sentinel-wire-topic">{topic}</p>

      {matchedThemes.length > 0 ? (
        <div className="persona-sentinel-insight-tags">
          {suggestion.pipeline ? (
            <span className="persona-sentinel-source-badge is-interest">
              {sentinelPipelineBadgeLabel(suggestion.pipeline)}
            </span>
          ) : null}
          {matchedThemes.map((theme) => (
            <span key={theme} className="persona-sentinel-theme-badge">
              {theme}
            </span>
          ))}
          {evidence.searchTrend ? (
            <span className="persona-sentinel-source-badge is-opposition">
              ↑ {evidence.searchTrend.changePercent >= 0 ? "+" : ""}
              {evidence.searchTrend.changePercent}% volume
            </span>
          ) : null}
          {evidence.outletCount && evidence.outletCount > 1 ? (
            <span className="persona-sentinel-source-badge is-interest">
              {evidence.outletCount} veículos
            </span>
          ) : null}
        </div>
      ) : null}

      {evidence.searchTrend ? (
        <p className="persona-helper-text">
          Trend proxy: {formatSentinelSearchTrend(evidence.searchTrend)}
        </p>
      ) : null}

      {evidence.byNetwork.length > 0 ? (
        <div className="persona-sentinel-evidence-block">
          <p className="persona-sentinel-section-label">Engajamento por rede</p>
          <SentinelNetworkMetrics byNetwork={evidence.byNetwork} />
        </div>
      ) : null}

      {(evidence.articles ?? []).length > 0 ? (
        <div className="persona-sentinel-evidence-block">
          <p className="persona-sentinel-section-label">Matérias detectadas</p>
          <ul className="persona-sentinel-article-list">
            {(evidence.articles ?? []).map((article) => (
              <li key={article.url}>
                <a href={article.url} target="_blank" rel="noreferrer">
                  {article.title}
                </a>
                {article.sourceName ? (
                  <span className="persona-sentinel-article-source"> · {article.sourceName}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
