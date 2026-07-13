/** Limites da versão para convidados (guest / free). */

/** Atualizações manuais de pautas do monitoramento por dia. */
export const GUEST_SENTINEL_REFRESH_PER_DAY = 1;
export const GUEST_SENTINEL_REFRESH_WINDOW_MS = 24 * 60 * 60 * 1000;

export type GuestSentinelCooldownMeta = {
  refreshedAt?: string | null;
  articlesScanned?: number;
  rssFetchStats?: {
    attempted?: number;
    succeeded?: number;
  } | null;
};

/**
 * Refresh que zerou por falha de fonte (Google/portais) não consome a cota diária —
 * senão o convidado fica 24h sem poder tentar de novo após um 503.
 */
export function isGuestSentinelRefreshSourceFailure(meta: GuestSentinelCooldownMeta | null | undefined) {
  if (!meta) {
    return false;
  }

  const articlesScanned = meta.articlesScanned ?? 0;
  if (articlesScanned > 0) {
    return false;
  }

  if (meta.rssFetchStats) {
    const attempted = meta.rssFetchStats.attempted ?? 0;
    const succeeded = meta.rssFetchStats.succeeded ?? 0;
    return attempted > 0 && succeeded === 0;
  }

  // Cache legado (antes do rssFetchStats): 0 artigos costuma ser falha de fonte no Cloud Run.
  return Boolean(meta.refreshedAt);
}

export function guestSentinelRefreshCooldownRemainingMs(
  lastRefreshedAt: string | null | undefined,
  now = Date.now(),
  windowMs = GUEST_SENTINEL_REFRESH_WINDOW_MS,
  meta?: GuestSentinelCooldownMeta | null,
) {
  if (meta && isGuestSentinelRefreshSourceFailure(meta)) {
    return 0;
  }

  if (!lastRefreshedAt) {
    return 0;
  }

  const last = Date.parse(lastRefreshedAt);
  if (!Number.isFinite(last)) {
    return 0;
  }

  const elapsed = now - last;
  if (elapsed >= windowMs) {
    return 0;
  }

  return windowMs - elapsed;
}
