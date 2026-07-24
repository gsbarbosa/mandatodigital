import { describe, expect, it } from "vitest";

import {
  ACTIVE_SEAT_MESSAGE,
  decideSeatAssignment,
  isSeatCappedPlan,
  MAX_SEATS_PER_PARTY_UF,
  normalizePartyKey,
  normalizeUfKey,
  RESERVE_QUEUE_MESSAGE,
} from "./party-uf-seats";

describe("isSeatCappedPlan", () => {
  it("aplica teto só em avançado e elite", () => {
    expect(isSeatCappedPlan("essencial")).toBe(false);
    expect(isSeatCappedPlan("avancado")).toBe(true);
    expect(isSeatCappedPlan("elite")).toBe(true);
    expect(isSeatCappedPlan("")).toBe(false);
  });
});

describe("normalize keys", () => {
  it("normaliza partido e UF", () => {
    expect(normalizePartyKey("  PT  ")).toBe("PT");
    expect(normalizeUfKey(" sp ")).toBe("SP");
  });
});

describe("decideSeatAssignment", () => {
  it("Essencial sempre recebe vaga completa", () => {
    const seat = decideSeatAssignment({
      planId: "essencial",
      activeSeatsExcludingSelf: 99,
    });
    expect(seat.status).toBe("complete");
    expect(seat.message).toBe(ACTIVE_SEAT_MESSAGE);
  });

  it("concede vaga ativa enquanto houver espaço", () => {
    for (let n = 0; n < MAX_SEATS_PER_PARTY_UF; n += 1) {
      const seat = decideSeatAssignment({
        planId: "avancado",
        activeSeatsExcludingSelf: n,
      });
      expect(seat.status).toBe("complete");
      expect(seat.activeSeats).toBe(n + 1);
    }
  });

  it("coloca na lista de reserva quando o teto está cheio", () => {
    const seat = decideSeatAssignment({
      planId: "elite",
      activeSeatsExcludingSelf: MAX_SEATS_PER_PARTY_UF,
    });
    expect(seat.status).toBe("reserve");
    expect(seat.activeSeats).toBe(MAX_SEATS_PER_PARTY_UF);
    expect(seat.message).toBe(RESERVE_QUEUE_MESSAGE);
  });

  it("mantém vaga ativa se o usuário já era complete", () => {
    const seat = decideSeatAssignment({
      planId: "avancado",
      activeSeatsExcludingSelf: MAX_SEATS_PER_PARTY_UF,
      existingStatus: "complete",
    });
    expect(seat.status).toBe("complete");
  });

  it("promove da lista de reserva se houver vaga livre", () => {
    const seat = decideSeatAssignment({
      planId: "avancado",
      activeSeatsExcludingSelf: 2,
      existingStatus: "reserve",
    });
    expect(seat.status).toBe("complete");
    expect(seat.activeSeats).toBe(3);
  });
});
