import type { EarlyAccessPlanId } from "@/lib/early-access-types";

export type EarlyAccessReservation = {
  fullName: string;
  party: string;
  cpf: string;
  uf: string;
  role: string;
  address: string;
  phone: string;
  email: string;
  teamEmail: string;
  teamPhone: string;
  planId: EarlyAccessPlanId;
  reservedAt: string;
  /** Vaga ativa vs lista de espera (teto 03/partido+UF). */
  seatStatus?: "active" | "reserve";
};

export type EarlyAccessState = {
  reservation: EarlyAccessReservation | null;
  cnpj: string;
  cnpjSignedAt: string;
  reservationPopupSeen: boolean;
};
