import { createClient } from "@supabase/supabase-js";

import { isSentinelTrendProxyEnabled } from "@/lib/feature-flags";
import type { SentinelSearchTrend } from "@/lib/sentinel-mock-suggestions";

const TREND_WINDOW_DAYS = 7;

function isSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorios.");
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

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
  if (!isSentinelTrendProxyEnabled() || !isSupabaseConfigured()) {
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

  const client = getSupabaseClient();
  const { data, error } = await client
    .from("sentinel_signals")
    .select("scanned_at")
    .eq("profile_id", profileId)
    .eq("theme_label", themeLabel)
    .gte("scanned_at", previousSince);

  if (error || !data?.length) {
    return null;
  }

  let currentCount = 0;
  let previousCount = 0;

  for (const row of data) {
    const scannedAt = Date.parse(String(row.scanned_at));
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
