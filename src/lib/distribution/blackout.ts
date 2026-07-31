/**
 * Blackout eleitoral: 72h antes / 24h depois da data da eleição.
 * Referência: docs/status-desenvolvimento.md (compliance Fase 3.2).
 */

export const BLACKOUT_HOURS_BEFORE = 72;
export const BLACKOUT_HOURS_AFTER = 24;

export type BlackoutCheckResult =
  | { blocked: false }
  | {
      blocked: true;
      reason: string;
      electionDate: string;
      windowStart: string;
      windowEnd: string;
    };

function parseElectionDate(electionDate: string): Date | null {
  const trimmed = electionDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null;
  }
  const [year, month, day] = trimmed.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

export function getBlackoutWindow(electionDate: string): {
  start: Date;
  end: Date;
  electionMidday: Date;
} | null {
  const electionMidday = parseElectionDate(electionDate);
  if (!electionMidday) {
    return null;
  }
  const start = new Date(electionMidday.getTime() - BLACKOUT_HOURS_BEFORE * 60 * 60 * 1000);
  const end = new Date(electionMidday.getTime() + BLACKOUT_HOURS_AFTER * 60 * 60 * 1000);
  return { start, end, electionMidday };
}

/**
 * Verifica se `at` (default agora) cai no blackout da eleição.
 * Sem data válida → não bloqueia.
 */
export function checkElectoralBlackout(input: {
  electionDate: string | null | undefined;
  at?: Date;
}): BlackoutCheckResult {
  const raw = input.electionDate?.trim();
  if (!raw) {
    return { blocked: false };
  }

  const window = getBlackoutWindow(raw);
  if (!window) {
    return { blocked: false };
  }

  const at = input.at ?? new Date();
  if (at.getTime() < window.start.getTime() || at.getTime() > window.end.getTime()) {
    return { blocked: false };
  }

  return {
    blocked: true,
    reason: `Blackout eleitoral ativo (${BLACKOUT_HOURS_BEFORE}h antes / ${BLACKOUT_HOURS_AFTER}h depois da eleição em ${raw}). Publicação bloqueada.`,
    electionDate: raw,
    windowStart: window.start.toISOString(),
    windowEnd: window.end.toISOString(),
  };
}
