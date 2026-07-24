import type { EarlyAccessPlanId } from "@/lib/early-access-types";
import type { SeatAssignment, UserRegistrationStatus } from "@/lib/user-registration-types";

/** Planos sujeitos ao teto de 03 vagas por partido/UF. */
export const SEAT_CAPPED_PLAN_IDS: readonly EarlyAccessPlanId[] = [
  "avancado",
  "elite",
];

export const MAX_SEATS_PER_PARTY_UF = 3;

export function isSeatCappedPlan(planId: string | null | undefined): boolean {
  return SEAT_CAPPED_PLAN_IDS.includes(planId as EarlyAccessPlanId);
}

export function normalizePartyKey(party: string) {
  return party.trim();
}

export function normalizeUfKey(uf: string) {
  return uf.trim().toUpperCase();
}

export const RESERVE_QUEUE_MESSAGE =
  "Neste Estado e Legenda, as 03 vagas antecipadas já estão preenchidas. Incluímos seu nome na lista de reserva e, se alguém desistir, avisaremos por e-mail.";

export const ACTIVE_SEAT_MESSAGE =
  "Sua vaga foi confirmada entre as 03 antecipadas deste partido/UF.";

/**
 * Decide vaga ativa vs lista de espera (puro — sem I/O).
 * `activeSeatsExcludingSelf` = seats `complete` em planos capped no mesmo partido/UF.
 */
export function decideSeatAssignment(input: {
  planId: EarlyAccessPlanId | string;
  activeSeatsExcludingSelf: number;
  existingStatus?: UserRegistrationStatus;
}): SeatAssignment {
  if (!isSeatCappedPlan(input.planId)) {
    return {
      status: "complete",
      activeSeats: 0,
      maxSeats: MAX_SEATS_PER_PARTY_UF,
      message: ACTIVE_SEAT_MESSAGE,
    };
  }

  // Já tinha vaga ativa: mantém (campos partido/UF ficam travados na UI).
  if (input.existingStatus === "complete") {
    return {
      status: "complete",
      activeSeats: input.activeSeatsExcludingSelf + 1,
      maxSeats: MAX_SEATS_PER_PARTY_UF,
      message: ACTIVE_SEAT_MESSAGE,
    };
  }

  if (input.activeSeatsExcludingSelf >= MAX_SEATS_PER_PARTY_UF) {
    return {
      status: "reserve",
      activeSeats: input.activeSeatsExcludingSelf,
      maxSeats: MAX_SEATS_PER_PARTY_UF,
      message: RESERVE_QUEUE_MESSAGE,
    };
  }

  return {
    status: "complete",
    activeSeats: input.activeSeatsExcludingSelf + 1,
    maxSeats: MAX_SEATS_PER_PARTY_UF,
    message: ACTIVE_SEAT_MESSAGE,
  };
}
