import { isSentinelTrendProxyEnabled } from "@/lib/feature-flags";
import { COLLECTIONS, col } from "@/lib/firebase/collections";
import type { SentinelSearchTrend } from "@/lib/sentinel-mock-suggestions";

const TREND_WINDOW_DAYS = 7;

function computeChangePercent(current: number, previous: number) {
  if (previous <= 0) {
    return current > 0 ? 100 : 0;
  }

  return Math.round(((current - previous) / previous) * 100);
}

export async function resolveThemeVolumeTrend(input: {
  profileId: string;
  themeLabel: string;
  geoLabel?: string;
}): Promise<SentinelSearchTrend | null> {
  if (!isSentinelTrendProxyEnabled()) {
    return null;
  }

  const profileId = input.profileId.trim();
  const themeLabel = input.themeLabel.trim();

  if (!profileId || profileId === "default" || !themeLabel) {
    return null;
  }

  const now = Date.now();
  const windowMs = TREND_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const currentSince = new Date(now - windowMs).toISOString();
  const previousSince = new Date(now - windowMs * 2).toISOString();

  const snap = await col(COLLECTIONS.sentinelSignals)
    .where("profileId", "==", profileId)
    .where("themeLabel", "==", themeLabel)
    .where("scannedAt", ">=", previousSince)
    .get();

  if (snap.empty) {
    return null;
  }

  let currentCount = 0;
  let previousCount = 0;

  for (const doc of snap.docs) {
    const scannedAt = Date.parse(String(doc.data().scannedAt));
    if (!Number.isFinite(scannedAt)) {
      continue;
    }

    if (scannedAt >= Date.parse(currentSince)) {
      currentCount += 1;
    } else {
      previousCount += 1;
    }
  }

  if (currentCount === 0 && previousCount === 0) {
    return null;
  }

  return {
    keyword: themeLabel,
    geoLabel: input.geoLabel?.trim() || "Radar",
    changePercent: computeChangePercent(currentCount, previousCount),
    periodDays: TREND_WINDOW_DAYS,
  };
}

export function applyTrendScoreBoost(score: number, trend: SentinelSearchTrend | null | undefined) {
  if (!trend) {
    return score;
  }

  const boost =
    trend.changePercent >= 100
      ? 15
      : trend.changePercent >= 50
        ? 10
        : trend.changePercent >= 20
          ? 6
          : trend.changePercent >= 0
            ? 3
            : 0;

  return Math.min(99, score + boost);
}
