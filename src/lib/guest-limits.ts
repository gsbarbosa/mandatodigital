/** Limites da versão para convidados (guest / free) — Sentinela. */

/** Créditos vitalícios para force-refresh (botão + save de temas). */
export const GUEST_SENTINEL_FORCE_CREDITS = 5;

/** Horário (America/Sao_Paulo) a partir do qual o ciclo diário automático libera. */
export const SENTINEL_DAILY_REFRESH_HOUR_BRT = 8;

export const SENTINEL_DAILY_TIMEZONE = "America/Sao_Paulo";

export type GuestSentinelCooldownMeta = {
  refreshedAt?: string | null;
  articlesScanned?: number;
  rssFetchStats?: {
    attempted?: number;
    succeeded?: number;
  } | null;
};

export type GuestSentinelCredits = {
  used: number;
  limit: number;
  remaining: number;
};

export type BrazilDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
};

/**
 * Refresh que zerou por falha de fonte (Google/portais) não consome crédito —
 * senão o convidado fica sem poder tentar de novo após um 503.
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

export function getBrazilDateParts(now: Date | number = Date.now()): BrazilDateParts {
  const date = typeof now === "number" ? new Date(now) : now;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: SENTINEL_DAILY_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  ) as Record<string, string>;

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
  };
}

function formatCycleKey(parts: Pick<BrazilDateParts, "year" | "month" | "day">) {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

/**
 * Chave do ciclo diário vigente: data (BRT) do corte das 8h que abriu o ciclo.
 * Antes das 8h, o ciclo ainda é o de ontem pós-8h.
 */
export function sentinelDailyCycleKey(now: Date | number = Date.now()): string {
  const parts = getBrazilDateParts(now);
  if (parts.hour >= SENTINEL_DAILY_REFRESH_HOUR_BRT) {
    return formatCycleKey(parts);
  }

  const previousDayUtc = Date.UTC(parts.year, parts.month - 1, parts.day - 1, 15, 0, 0);
  const previous = getBrazilDateParts(previousDayUtc);
  return formatCycleKey(previous);
}

/** True se o cache ainda não cobre o ciclo diário vigente (pós-8h BRT). */
export function needsDailySentinelRefresh(
  lastRefreshedAt: string | null | undefined,
  now: Date | number = Date.now(),
): boolean {
  if (!lastRefreshedAt) {
    return true;
  }
  const lastMs = Date.parse(lastRefreshedAt);
  if (!Number.isFinite(lastMs)) {
    return true;
  }
  return sentinelDailyCycleKey(lastMs) !== sentinelDailyCycleKey(now);
}

export function guestSentinelNextDailyRefreshLabel(now: Date | number = Date.now()): string {
  const parts = getBrazilDateParts(now);
  if (parts.hour < SENTINEL_DAILY_REFRESH_HOUR_BRT) {
    return "hoje após as 8h";
  }
  return "amanhã após as 8h";
}

export function guestSentinelCreditsExhaustedMessage(now: Date | number = Date.now()): string {
  return `Você usou seus ${GUEST_SENTINEL_FORCE_CREDITS} créditos. A próxima atualização das pautas é ${guestSentinelNextDailyRefreshLabel(now)}.`;
}

export function buildGuestSentinelCredits(used: number): GuestSentinelCredits {
  const safeUsed = Math.max(0, Math.floor(used));
  const limit = GUEST_SENTINEL_FORCE_CREDITS;
  return {
    used: safeUsed,
    limit,
    remaining: Math.max(0, limit - safeUsed),
  };
}

/** @deprecated Mantido só para compat de imports legados — preferir créditos. */
export const GUEST_SENTINEL_REFRESH_PER_DAY = GUEST_SENTINEL_FORCE_CREDITS;
/** @deprecated */
export const GUEST_SENTINEL_REFRESH_WINDOW_MS = 24 * 60 * 60 * 1000;

/** @deprecated Use needsDailySentinelRefresh / créditos. */
export function guestSentinelRefreshCooldownRemainingMs(
  lastRefreshedAt: string | null | undefined,
  now = Date.now(),
  _windowMs = GUEST_SENTINEL_REFRESH_WINDOW_MS,
  meta?: GuestSentinelCooldownMeta | null,
) {
  if (meta && isGuestSentinelRefreshSourceFailure(meta)) {
    return 0;
  }
  if (!needsDailySentinelRefresh(lastRefreshedAt, now)) {
    // Ainda no mesmo ciclo — “cooldown” simbólico até a próxima 8h (não usado na API nova).
    return 1;
  }
  return 0;
}
