import { SentinelSocialIcon } from "@/components/product/sentinel-social-icon";
import {
  formatSentinelMetricShort,
  sentinelNetworkLabel,
  type SentinelNetworkEngagement,
} from "@/lib/sentinel-mock-suggestions";

export function SentinelNetworkMetrics({
  byNetwork,
}: {
  byNetwork: SentinelNetworkEngagement[];
}) {
  if (!byNetwork.length) {
    return null;
  }

  return (
    <ul className="persona-sentinel-network-metrics">
      {byNetwork.map((row) => (
        <li key={row.network} className={`persona-sentinel-network-metrics-item is-${row.network}`}>
          <span className="persona-sentinel-network-metrics-label">
            <SentinelSocialIcon network={row.network} />
            <span>{sentinelNetworkLabel(row.network)}:</span>
          </span>
          <span className="persona-sentinel-network-metrics-values">
            {formatSentinelMetricShort(row.likes)} curtidas,{" "}
            {formatSentinelMetricShort(row.comments)} comentários,{" "}
            {formatSentinelMetricShort(row.shares)} compartilhamentos
          </span>
        </li>
      ))}
    </ul>
  );
}
