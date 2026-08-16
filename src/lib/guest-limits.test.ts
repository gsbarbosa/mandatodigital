import { describe, expect, it } from "vitest";

import {
  buildGuestSentinelCredits,
  GUEST_SENTINEL_FORCE_CREDITS,
  getBrazilDateParts,
  guestSentinelCreditsExhaustedMessage,
  guestSentinelNextDailyRefreshLabel,
  guestVideoBucketFromAvatarTrack,
  guestVideosUsedForBucket,
  isGuestSentinelRefreshSourceFailure,
  needsDailySentinelRefresh,
  sentinelDailyCycleKey,
} from "./guest-limits";

/** Constrói um instante UTC cujo horário em Brasília é o informado. */
function brtInstant(input: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute?: number;
}) {
  const minute = input.minute ?? 0;
  // Procura um UTC que formate para o horário BRT desejado (offset −3 ou −2 no DST legado).
  for (let offsetHours = 2; offsetHours <= 4; offsetHours += 1) {
    const ms = Date.UTC(input.year, input.month - 1, input.day, input.hour + offsetHours, minute, 0);
    const parts = getBrazilDateParts(ms);
    if (
      parts.year === input.year &&
      parts.month === input.month &&
      parts.day === input.day &&
      parts.hour === input.hour
    ) {
      return ms;
    }
  }
  throw new Error(`não achou instante BRT para ${JSON.stringify(input)}`);
}

describe("sentinelDailyCycleKey", () => {
  it("antes das 8h BRT usa o ciclo de ontem", () => {
    const now = brtInstant({ year: 2026, month: 7, day: 20, hour: 7, minute: 59 });
    expect(sentinelDailyCycleKey(now)).toBe("2026-07-19");
  });

  it("às 8h BRT abre o ciclo de hoje", () => {
    const now = brtInstant({ year: 2026, month: 7, day: 20, hour: 8, minute: 0 });
    expect(sentinelDailyCycleKey(now)).toBe("2026-07-20");
  });
});

describe("needsDailySentinelRefresh", () => {
  it("pede refresh quando nunca atualizou", () => {
    expect(needsDailySentinelRefresh(null)).toBe(true);
  });

  it("não pede refresh se já atualizou no ciclo vigente (hoje pós-8h)", () => {
    const refreshedAt = new Date(
      brtInstant({ year: 2026, month: 7, day: 20, hour: 9, minute: 0 }),
    ).toISOString();
    const now = brtInstant({ year: 2026, month: 7, day: 20, hour: 15, minute: 0 });
    expect(needsDailySentinelRefresh(refreshedAt, now)).toBe(false);
  });

  it("pede refresh às 8h se o último foi ontem à noite", () => {
    const refreshedAt = new Date(
      brtInstant({ year: 2026, month: 7, day: 19, hour: 20, minute: 0 }),
    ).toISOString();
    const now = brtInstant({ year: 2026, month: 7, day: 20, hour: 8, minute: 0 });
    expect(needsDailySentinelRefresh(refreshedAt, now)).toBe(true);
  });

  it("não pede refresh às 7h se o último foi ontem à noite (mesmo ciclo)", () => {
    const refreshedAt = new Date(
      brtInstant({ year: 2026, month: 7, day: 19, hour: 20, minute: 0 }),
    ).toISOString();
    const now = brtInstant({ year: 2026, month: 7, day: 20, hour: 7, minute: 0 });
    expect(needsDailySentinelRefresh(refreshedAt, now)).toBe(false);
  });
});

describe("guestSentinelNextDailyRefreshLabel", () => {
  it("antes das 8h aponta para hoje", () => {
    const now = brtInstant({ year: 2026, month: 7, day: 20, hour: 7 });
    expect(guestSentinelNextDailyRefreshLabel(now)).toBe("hoje após as 8h");
  });

  it("depois das 8h aponta para amanhã", () => {
    const now = brtInstant({ year: 2026, month: 7, day: 20, hour: 9 });
    expect(guestSentinelNextDailyRefreshLabel(now)).toBe("amanhã após as 8h");
  });
});

describe("buildGuestSentinelCredits", () => {
  it("calcula remaining com teto", () => {
    expect(buildGuestSentinelCredits(0)).toEqual({
      used: 0,
      limit: GUEST_SENTINEL_FORCE_CREDITS,
      remaining: GUEST_SENTINEL_FORCE_CREDITS,
    });
    expect(buildGuestSentinelCredits(5).remaining).toBe(0);
    expect(buildGuestSentinelCredits(9).remaining).toBe(0);
  });
});

describe("guestSentinelCreditsExhaustedMessage", () => {
  it("menciona créditos e próximo ciclo", () => {
    const now = brtInstant({ year: 2026, month: 7, day: 20, hour: 10 });
    expect(guestSentinelCreditsExhaustedMessage(now)).toContain("5 créditos");
    expect(guestSentinelCreditsExhaustedMessage(now)).toContain("amanhã após as 8h");
  });
});

describe("isGuestSentinelRefreshSourceFailure", () => {
  it("detecta falha total de fonte", () => {
    expect(
      isGuestSentinelRefreshSourceFailure({
        articlesScanned: 0,
        rssFetchStats: { attempted: 10, succeeded: 0 },
      }),
    ).toBe(true);
  });

  it("trata cache legado sem rssFetchStats e 0 artigos como falha de fonte", () => {
    expect(
      isGuestSentinelRefreshSourceFailure({
        refreshedAt: "2026-07-10T11:00:00.000Z",
        articlesScanned: 0,
      }),
    ).toBe(true);
  });
});

describe("guestVideoBucketFromAvatarTrack", () => {
  it("mapeia o track do criativo para o generateMode da cota", () => {
    expect(guestVideoBucketFromAvatarTrack("caricature")).toBe("caricature");
    expect(guestVideoBucketFromAvatarTrack("photo_real")).toBe("photo_real");
    expect(guestVideoBucketFromAvatarTrack("realistic")).toBe("photo_real");
    expect(guestVideoBucketFromAvatarTrack("avatar")).toBe("avatar");
  });
});

describe("guestVideosUsedForBucket", () => {
  it("nao mistura buckets e ignora lixo", () => {
    expect(guestVideosUsedForBucket({ caricature: 1, photo_real: 2 }, "caricature")).toBe(1);
    expect(guestVideosUsedForBucket({ caricature: 1 }, "photo_real")).toBe(0);
    expect(guestVideosUsedForBucket(undefined, "avatar")).toBe(0);
  });
});
