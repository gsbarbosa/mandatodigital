import {
  DISTRIBUTION_CHANNELS,
  type DistributionChannelId,
  getChannelDef,
} from "@/lib/distribution/channels";

function truncateCaption(text: string, limit: number): string {
  const normalized = text.trim();
  if (normalized.length <= limit) {
    return normalized;
  }
  if (limit <= 1) {
    return normalized.slice(0, limit);
  }
  return `${normalized.slice(0, limit - 1).trimEnd()}…`;
}

/** Gera captions por canal a partir da base, respeitando limites. */
export function buildCaptionsByChannel(
  captionBase: string,
  channels: DistributionChannelId[],
  overrides?: Partial<Record<DistributionChannelId, string>>,
): Partial<Record<DistributionChannelId, string>> {
  const result: Partial<Record<DistributionChannelId, string>> = {};
  for (const channel of channels) {
    const def = getChannelDef(channel);
    const source = overrides?.[channel]?.trim() || captionBase;
    result[channel] = truncateCaption(source, def.captionLimit);
  }
  return result;
}

export function captionLimitsMap(): Record<DistributionChannelId, number> {
  const map = {} as Record<DistributionChannelId, number>;
  for (const channel of DISTRIBUTION_CHANNELS) {
    map[channel.id] = channel.captionLimit;
  }
  return map;
}
