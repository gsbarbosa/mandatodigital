import type { EarlyAccessPlanId } from "@/lib/early-access-types";

export type UserRegistrationStatus = "incomplete" | "complete" | "reserve";

/** Cadastro real do usuário (fonte da verdade no Firestore). */
export type UserRegistration = {
  ownerUserId: string;
  profileId: string | null;
  status: UserRegistrationStatus;
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
  planId: EarlyAccessPlanId | "";
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

/** Payload de conclusão do cadastro (form de dados pessoais). */
export type UserRegistrationCompleteInput = {
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
};

export type SeatAssignment = {
  status: "complete" | "reserve";
  activeSeats: number;
  maxSeats: number;
  message: string;
};
