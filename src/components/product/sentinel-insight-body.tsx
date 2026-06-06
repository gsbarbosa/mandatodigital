import { SentinelNetworkMetrics } from "@/components/product/sentinel-network-metrics";
import type { MockSentinelSuggestion } from "@/lib/sentinel-mock-suggestions";

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
          {matchedThemes.map((theme) => (
            <span key={theme} className="persona-sentinel-theme-badge">
              {theme}
            </span>
          ))}
        </div>
      ) : null}

      {evidence.byNetwork.length > 0 ? (
        <div className="persona-sentinel-evidence-block">
          <p className="persona-sentinel-section-label">Engajamento por rede</p>
          <SentinelNetworkMetrics byNetwork={evidence.byNetwork} />
        </div>
      ) : null}
    </div>
  );
}
