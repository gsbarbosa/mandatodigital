import { SentinelNetworkMetrics } from "@/components/product/sentinel-network-metrics";
import {
  formatSentinelSearchTrend,
  sentinelPipelineBadgeLabel,
  sentinelSignalKindLabel,
  type MockSentinelSuggestion,
} from "@/lib/sentinel-mock-suggestions";

export function SentinelInsightBody({
  suggestion,
}: {
  suggestion: MockSentinelSuggestion;
  compact?: boolean;
}) {
  const { evidence, topic, matchedThemes, editorial } = suggestion;

  return (
    <div className="persona-sentinel-insight">
      <p className="persona-sentinel-wire-topic">{topic}</p>

      {matchedThemes.length > 0 || editorial || suggestion.pipeline ? (
        <div className="persona-sentinel-insight-tags">
          {editorial?.signalKind ? (
            <span
              className="persona-sentinel-source-badge is-interest"
              data-testid="sentinel-signal-kind"
            >
              {sentinelSignalKindLabel(editorial.signalKind)}
            </span>
          ) : null}
          {suggestion.pipeline ? (
            <span className="persona-sentinel-source-badge is-interest">
              {sentinelPipelineBadgeLabel(suggestion.pipeline)}
            </span>
          ) : null}
          {matchedThemes.map((theme) => (
            <span
              key={theme}
              className="persona-sentinel-theme-badge"
              data-testid="sentinel-matched-theme"
              data-theme={theme}
            >
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
          {editorial?.viralScore !== undefined ? (
            <span className="persona-sentinel-source-badge is-opposition">
              viral {editorial.viralScore}
            </span>
          ) : null}
        </div>
      ) : null}

      {editorial?.factualSummary ? (
        <p className="persona-helper-text">{editorial.factualSummary}</p>
      ) : null}

      {editorial?.suggestedAngle ? (
        <p className="persona-helper-text">
          <strong>Ângulo:</strong> {editorial.suggestedAngle}
        </p>
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
